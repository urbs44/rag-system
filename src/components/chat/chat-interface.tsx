"use client";

import { Send, User, Bot, Paperclip, Sparkles, History, Bug, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { getApiKey, getSelectedModel, getProvider, trackUsage } from "@/lib/settings";
import { OPENAI_STORAGE_KEYS } from "@/lib/openai-assistants";


const STORAGE_KEY = "rag-chat-messages";

// Simple message type - no AI SDK dependencies
interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showDevConsole, setShowDevConsole] = useState(false);
    const [devLogs, setDevLogs] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasLoadedRef = useRef(false);

    // Load messages from localStorage on mount
    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setMessages(parsed);
                    log(`Loaded ${parsed.length} messages from storage`);
                }
            }
        } catch (e) {
            console.error("Failed to load messages:", e);
        }
    }, []);

    // Save messages to localStorage when they change
    useEffect(() => {
        if (!hasLoadedRef.current) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch (e) {
            console.error("Failed to save messages:", e);
        }
    }, [messages]);

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
        log("Chat cleared");
    };

    const log = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        setDevLogs(prev => [...prev, `[${ts}] ${msg}`]);
        console.log(`[DevConsole] ${msg}`);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userContent = input;
        setInput("");

        // Add user message
        const userMsg: Message = { id: Date.now().toString(), role: "user", content: userContent };
        const currentMessages = [...messages, userMsg];
        setMessages(currentMessages);
        setIsLoading(true);
        log(`Sending: "${userContent}"`);

        try {
            // Get settings
            const apiKey = getApiKey();
            const model = getSelectedModel();
            const provider = getProvider();

            // Prepare request body with settings
            const requestBody: Record<string, unknown> = {
                messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
                apiKey,
                model,
                provider,
            };

            // Add OpenAI-specific IDs if available
            if (provider === "openai") {
                const assistantId = localStorage.getItem(OPENAI_STORAGE_KEYS.ASSISTANT_ID);
                const threadId = localStorage.getItem(OPENAI_STORAGE_KEYS.THREAD_ID);
                if (assistantId) requestBody.assistantId = assistantId;
                if (threadId) requestBody.threadId = threadId;
            }
            log(`Request: provider=${provider}, model=${model}, msgs=${currentMessages.length}`);


            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            log(`Response status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No reader available");

            const assistantMsgId = (Date.now() + 1).toString();
            let assistantContent = "";
            let chunkCount = 0;

            // Add empty assistant message
            setMessages([...currentMessages, { id: assistantMsgId, role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    log(`Stream complete. Total chunks: ${chunkCount}`);
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                chunkCount++;
                log(`Chunk ${chunkCount}: ${chunk.substring(0, 50)}...`);

                // Parse Vercel AI Data Stream Protocol: 0:"text"\n or 2:{usage:...}\n
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('0:')) {
                        try {
                            const text = JSON.parse(line.slice(2));
                            assistantContent += text;
                        } catch (e) {
                            log(`Parse error on line: ${line}`);
                        }
                    } else if (line.startsWith('2:')) {
                        // Usage metadata at end of stream
                        try {
                            const meta = JSON.parse(line.slice(2));
                            if (meta.usage) {
                                const { inputTokens, outputTokens, model } = meta.usage;
                                trackUsage(inputTokens, outputTokens, model);
                                log(`Usage: ${inputTokens} in, ${outputTokens} out`);
                            }
                        } catch (e) {
                            log(`Usage parse error: ${line}`);
                        }
                    }
                }

                // Update assistant message with accumulated content
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].id === assistantMsgId) {
                        updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
                    }
                    return updated;
                });
            }

            log(`Final content length: ${assistantContent.length} chars`);

        } catch (error: any) {
            log(`ERROR: ${error.message}`);
            setMessages(prev => [...prev, {
                id: 'error-' + Date.now(),
                role: "assistant",
                content: `Error: ${error.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-lg">Editorial RAG Assistant</h1>
                        <p className="text-xs text-muted-foreground">AI-Powered Knowledge Base</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearChat}
                        className="px-4 py-2 bg-muted hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                        title="Clear conversation"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Clear Chat</span>
                    </button>

                    <button
                        onClick={() => setShowDevConsole(!showDevConsole)}
                        className={cn("p-2 rounded-lg", showDevConsole ? "bg-red-500/10 text-red-500" : "hover:bg-muted text-muted-foreground")}
                        title="Toggle Dev Console"
                    >
                        <Bug className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.length === 0 && (
                        <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-4">
                            <Sparkles className="w-12 h-12 text-primary/50" />
                            <h2 className="text-xl font-semibold">How can I help you today?</h2>
                            <p className="text-muted-foreground max-w-md">
                                Ask questions about your knowledge base or request content drafts.
                            </p>
                        </div>
                    )}

                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={cn(
                                "flex gap-4",
                                m.role === "user" ? "flex-row-reverse" : ""
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                m.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                            )}>
                                {m.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
                            </div>
                            <div className={cn(
                                "px-4 py-3 rounded-2xl max-w-[80%] text-sm whitespace-pre-wrap",
                                m.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-muted rounded-tl-sm"
                            )}>
                                {m.content || <span className="text-muted-foreground italic">...</span>}
                            </div>
                        </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <Bot className="w-5 h-5 text-primary animate-pulse" />
                            </div>
                            <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background border-t">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-2 bg-muted rounded-xl p-2">
                    <button type="button" className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 py-2 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className={cn(
                            "p-2 rounded-lg",
                            input.trim() && !isLoading
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
                <p className="text-center text-xs text-muted-foreground mt-2">
                    AI-generated content. Verify important information.
                </p>
            </div>

            {/* Dev Console Panel */}
            {showDevConsole && (
                <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-black text-green-400 font-mono text-xs p-4 shadow-2xl z-50 flex flex-col border-l border-green-900">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-green-900">
                        <span className="font-bold">DEV CONSOLE</span>
                        <button onClick={() => setShowDevConsole(false)} className="hover:text-white">✕</button>
                    </div>
                    <div className="flex-1 overflow-auto space-y-4">
                        <div>
                            <h3 className="text-green-600 mb-1">Messages State ({messages.length})</h3>
                            <pre className="bg-green-900/20 p-2 rounded text-[10px] max-h-32 overflow-auto">
                                {JSON.stringify(messages, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h3 className="text-green-600 mb-1">Logs</h3>
                            <div className="bg-green-900/20 p-2 rounded max-h-64 overflow-auto text-[10px]">
                                {devLogs.length === 0 ? (
                                    <span className="text-green-700 italic">No logs yet...</span>
                                ) : (
                                    devLogs.map((l, i) => <div key={i} className="border-b border-green-900/30 py-1">{l}</div>)
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setDevLogs([])}
                            className="w-full py-2 bg-green-900/30 hover:bg-green-900/50 rounded text-green-400"
                        >
                            Clear Logs
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
