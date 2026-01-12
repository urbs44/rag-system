
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GeminiFile {
    state: string;
    mimeType: string;
    uri: string;
    displayName: string;
}


export async function POST(req: Request) {
    try {
        const { messages, apiKey, model: modelId, provider = "gemini", assistantId, threadId } = await req.json();

        // API key must be provided from client (stored in localStorage)
        const effectiveApiKey = apiKey || "";
        const effectiveModel = modelId || (provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash");

        if (!effectiveApiKey) {
            return new Response(JSON.stringify({
                error: `No ${provider === "openai" ? "OpenAI" : "Gemini"} API key configured. Please add one in Settings.`
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`Provider: ${provider}, Model: ${effectiveModel}`);

        if (provider === "openai") {
            return handleOpenAI(messages, effectiveApiKey, effectiveModel, assistantId, threadId);
        } else {
            return handleGemini(messages, effectiveApiKey, effectiveModel);
        }


    } catch (error: any) {
        console.error("Chat error:", error);

        let errorMessage = "Failed to generate response";
        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("invalid_api_key")) {
            errorMessage = "Invalid API key. Please check your key in Settings.";
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

// ============ GEMINI HANDLER ============
async function handleGemini(messages: any[], apiKey: string, modelId: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    // Fetch active files for RAG
    const fileList = await fileManager.listFiles();
    const files = (fileList.files || []) as GeminiFile[];
    const activeFiles = files
        .filter((f) => f.state === "ACTIVE")
        .map((f) => ({
            fileData: {
                mimeType: f.mimeType,
                fileUri: f.uri,
            },
        }));

    const fileNames = files
        .filter((f) => f.state === "ACTIVE")
        .map((f) => f.displayName)
        .join(", ");

    console.log(`Gemini: Using ${activeFiles.length} files for context`);

    const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: `You are a helpful expert editorial assistant. You have access to the following knowledge base documents: ${fileNames || "none"}.

IMPORTANT RULES:
1. Use the provided documents to answer questions accurately
2. ALWAYS cite your sources using the format: [Source: document_name]
3. If information comes from multiple documents, cite all relevant sources
4. If you cannot find information in the documents, clearly state that
5. Match the company's style and tone based on the documents`
    });

    const historyMessages = messages.slice(0, messages.length - 1);
    const lastMessage = messages[messages.length - 1];

    const formattedHistory = historyMessages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [
                    { text: "Here is the knowledge base containing all relevant documents for our session:" },
                    ...activeFiles,
                    { text: "Please use these documents to answer my future questions." }
                ]
            },
            {
                role: "model",
                parts: [{ text: "Understood. I have processed the knowledge base and am ready to assist you." }]
            },
            ...formattedHistory
        ],
    });

    const result = await chat.sendMessageStream(lastMessage.content);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        const data = `0:${JSON.stringify(text)}\n`;
                        controller.enqueue(encoder.encode(data));
                    }
                    const usage = chunk.usageMetadata;
                    if (usage) {
                        totalInputTokens = usage.promptTokenCount || 0;
                        totalOutputTokens = usage.candidatesTokenCount || 0;
                    }
                }

                const usageData = `2:${JSON.stringify({
                    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: modelId }
                })}\n`;
                controller.enqueue(encoder.encode(usageData));
                controller.close();
            } catch (e) {
                console.error("Gemini streaming error", e);
                controller.error(e);
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1"
        },
    });
}

// ============ OPENAI HANDLER (Assistants API with File Search) ============
async function handleOpenAI(messages: any[], apiKey: string, modelId: string, assistantId?: string, threadId?: string) {
    const openai = new OpenAI({ apiKey });

    // If no assistant configured, fall back to simple chat
    if (!assistantId) {
        return handleOpenAISimple(messages, openai, modelId);
    }

    // Use Assistants API with Threads
    let currentThreadId = threadId;

    // Create thread if needed
    if (!currentThreadId) {
        const thread = await openai.beta.threads.create();
        currentThreadId = thread.id;
    }

    // Add user message to thread
    const lastMessage = messages[messages.length - 1];
    await openai.beta.threads.messages.create(currentThreadId, {
        role: "user",
        content: lastMessage.content,
    });

    // Create run and stream response
    const run = openai.beta.threads.runs.stream(currentThreadId, {
        assistant_id: assistantId,
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const event of run) {
                    if (event.event === "thread.message.delta") {
                        const delta = event.data.delta;
                        if (delta.content) {
                            for (const block of delta.content) {
                                if (block.type === "text" && block.text?.value) {
                                    const data = `0:${JSON.stringify(block.text.value)}\n`;
                                    controller.enqueue(encoder.encode(data));
                                }
                            }
                        }
                    } else if (event.event === "thread.run.completed") {
                        const usage = event.data.usage;
                        if (usage) {
                            totalInputTokens = usage.prompt_tokens || 0;
                            totalOutputTokens = usage.completion_tokens || 0;
                        }
                    }
                }

                const usageData = `2:${JSON.stringify({
                    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: modelId },
                    threadId: currentThreadId,
                })}\n`;
                controller.enqueue(encoder.encode(usageData));
                controller.close();
            } catch (e) {
                console.error("OpenAI Assistants streaming error", e);
                controller.error(e);
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1"
        },
    });
}

// Simple OpenAI Chat (fallback when no assistant configured)
async function handleOpenAISimple(messages: any[], openai: OpenAI, modelId: string) {
    const formattedMessages = [
        {
            role: "system" as const,
            content: `You are a helpful expert editorial assistant. 

IMPORTANT RULES:
1. Answer questions accurately and helpfully
2. If you reference information, cite it clearly
3. Be concise but thorough`
        },
        ...messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content
        }))
    ];

    const response = await openai.chat.completions.create({
        model: modelId,
        messages: formattedMessages,
        stream: true,
        stream_options: { include_usage: true },
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        const data = `0:${JSON.stringify(content)}\n`;
                        controller.enqueue(encoder.encode(data));
                    }
                    if (chunk.usage) {
                        totalInputTokens = chunk.usage.prompt_tokens || 0;
                        totalOutputTokens = chunk.usage.completion_tokens || 0;
                    }
                }

                const usageData = `2:${JSON.stringify({
                    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: modelId }
                })}\n`;
                controller.enqueue(encoder.encode(usageData));
                controller.close();
            } catch (e) {
                console.error("OpenAI streaming error", e);
                controller.error(e);
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1"
        },
    });
}

