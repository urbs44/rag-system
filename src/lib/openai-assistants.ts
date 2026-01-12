// OpenAI Assistants API helper functions
// Manages Assistants, Vector Stores, and Threads for RAG

import OpenAI from "openai";

const ASSISTANT_NAME = "Editorial RAG Assistant";
const ASSISTANT_INSTRUCTIONS = `You are a helpful expert editorial assistant. 

IMPORTANT RULES:
1. Use the provided documents to answer questions accurately
2. ALWAYS cite your sources using the format: [Source: document_name]
3. If information comes from multiple documents, cite all relevant sources
4. If you cannot find information in the documents, clearly state that
5. Match the company's style and tone based on the documents`;

// LocalStorage keys for OpenAI resources (stored on client, passed to server)
export const OPENAI_STORAGE_KEYS = {
    ASSISTANT_ID: "rag-openai-assistant-id",
    VECTOR_STORE_ID: "rag-openai-vector-store-id",
    THREAD_ID: "rag-openai-thread-id",
} as const;

// Get or create an Assistant with file_search enabled
export async function getOrCreateAssistant(
    openai: OpenAI,
    assistantId?: string | null,
    vectorStoreId?: string | null
): Promise<{ assistantId: string; vectorStoreId: string }> {

    // Try to retrieve existing assistant
    if (assistantId) {
        try {
            const existing = await openai.beta.assistants.retrieve(assistantId);
            console.log("Found existing assistant:", existing.id);

            // Ensure vector store is attached
            const vsId = vectorStoreId || await ensureVectorStore(openai, existing.id);

            return { assistantId: existing.id, vectorStoreId: vsId };
        } catch (e) {
            console.log("Assistant not found, creating new one");
        }
    }

    // Create vector store first using the beta API
    // @ts-ignore - vectorStores is part of beta API
    const vectorStore = await openai.beta.vectorStores.create({
        name: "Editorial Knowledge Base",
    });
    console.log("Created vector store:", vectorStore.id);

    // Create new assistant with file_search
    const assistant = await openai.beta.assistants.create({
        name: ASSISTANT_NAME,
        instructions: ASSISTANT_INSTRUCTIONS,
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: {
            file_search: {
                vector_store_ids: [vectorStore.id],
            },
        },
    });
    console.log("Created assistant:", assistant.id);

    return { assistantId: assistant.id, vectorStoreId: vectorStore.id };
}

// Ensure a vector store exists and is attached to the assistant
async function ensureVectorStore(openai: OpenAI, assistantId: string): Promise<string> {
    const assistant = await openai.beta.assistants.retrieve(assistantId);

    // Check if vector store is already attached
    const existingVsIds = assistant.tool_resources?.file_search?.vector_store_ids;
    if (existingVsIds && existingVsIds.length > 0) {
        return existingVsIds[0];
    }

    // Create new vector store and attach
    // @ts-ignore - vectorStores is part of beta API
    const vectorStore = await openai.beta.vectorStores.create({
        name: "Editorial Knowledge Base",
    });

    await openai.beta.assistants.update(assistantId, {
        tool_resources: {
            file_search: {
                vector_store_ids: [vectorStore.id],
            },
        },
    });

    return vectorStore.id;
}

// Upload a file to OpenAI and add to vector store
export async function uploadFileToVectorStore(
    openai: OpenAI,
    vectorStoreId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<{ fileId: string; vectorStoreFileId: string }> {

    // 1. Upload file to OpenAI using Blob (works better with Node.js)
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    const file = await openai.files.create({
        file: new File([blob], fileName, { type: mimeType }),
        purpose: "assistants",
    });
    console.log("Uploaded file to OpenAI:", file.id);

    // 2. Add file to vector store
    // @ts-ignore - vectorStores is part of beta API
    const vectorStoreFile = await openai.beta.vectorStores.files.create(
        vectorStoreId,
        { file_id: file.id }
    );
    console.log("Added file to vector store:", vectorStoreFile.id);

    // 3. Wait for processing (poll status)
    let status = vectorStoreFile.status;
    while (status === "in_progress") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // @ts-ignore - vectorStores is part of beta API
        const updated = await openai.beta.vectorStores.files.retrieve(
            vectorStoreId,
            vectorStoreFile.id
        );
        status = updated.status;
    }

    if (status !== "completed") {
        throw new Error(`File processing failed: ${status}`);
    }

    return { fileId: file.id, vectorStoreFileId: vectorStoreFile.id };
}

// List files in a vector store
export async function listVectorStoreFiles(
    openai: OpenAI,
    vectorStoreId: string
): Promise<Array<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
}>> {

    // @ts-ignore - vectorStores is part of beta API
    const files = await openai.beta.vectorStores.files.list(vectorStoreId);

    // Get file details for each
    const fileDetails = await Promise.all(
        files.data.map(async (vsFile: { id: string; file_id: string; status: string }) => {
            try {
                const file = await openai.files.retrieve(vsFile.file_id);
                return {
                    id: vsFile.id,
                    fileId: vsFile.file_id,
                    name: file.filename,
                    status: vsFile.status,
                    createdAt: file.created_at,
                };
            } catch (e) {
                return {
                    id: vsFile.id,
                    fileId: vsFile.file_id,
                    name: "Unknown",
                    status: vsFile.status,
                    createdAt: 0,
                };
            }
        })
    );

    return fileDetails;
}

// Delete a file from vector store and OpenAI
export async function deleteVectorStoreFile(
    openai: OpenAI,
    vectorStoreId: string,
    fileId: string
): Promise<void> {
    // Get the vector store file ID
    // @ts-ignore - vectorStores is part of beta API
    const files = await openai.beta.vectorStores.files.list(vectorStoreId);
    const vsFile = files.data.find((f: { file_id: string }) => f.file_id === fileId);

    if (vsFile) {
        // Remove from vector store
        // @ts-ignore - vectorStores is part of beta API
        await openai.beta.vectorStores.files.del(vectorStoreId, vsFile.id);
    }

    // Delete the file itself
    await openai.files.delete(fileId);
}

// Create or get a thread for the current session
export async function getOrCreateThread(
    openai: OpenAI,
    threadId?: string | null
): Promise<string> {
    if (threadId) {
        try {
            await openai.beta.threads.retrieve(threadId);
            return threadId;
        } catch (e) {
            // Thread expired or doesn't exist
        }
    }

    const thread = await openai.beta.threads.create();
    return thread.id;
}

// Send a message and stream the response
export async function* streamAssistantResponse(
    openai: OpenAI,
    assistantId: string,
    threadId: string,
    userMessage: string
): AsyncGenerator<{ type: "text" | "usage"; content: string; usage?: { input: number; output: number } }> {

    // Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage,
    });

    // Create run and stream
    const run = openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId,
    });

    for await (const event of run) {
        if (event.event === "thread.message.delta") {
            const delta = event.data.delta;
            if (delta.content) {
                for (const block of delta.content) {
                    if (block.type === "text" && block.text?.value) {
                        yield { type: "text", content: block.text.value };
                    }
                }
            }
        } else if (event.event === "thread.run.completed") {
            const usage = event.data.usage;
            if (usage) {
                yield {
                    type: "usage",
                    content: "",
                    usage: {
                        input: usage.prompt_tokens,
                        output: usage.completion_tokens,
                    },
                };
            }
        }
    }
}
