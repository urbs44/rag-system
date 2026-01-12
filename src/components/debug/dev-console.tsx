
import React, { useState, useEffect } from 'react';
import { X, Terminal, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from 'ai/react';

interface DevConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    status: string;
    error: undefined | Error;
}

export function DevConsole({ isOpen, onClose, messages, status, error }: DevConsoleProps) {
    const [rawLog, setRawLog] = useState<string[]>([]);
    const [isTestLoading, setIsTestLoading] = useState(false);

    // Auto-log status changes
    useEffect(() => {
        setRawLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Status changed: ${status}`]);
        if (error) {
            setRawLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${JSON.stringify(error)}`]);
        }
    }, [status, error]);

    const runRawTest = async () => {
        setIsTestLoading(true);
        setRawLog(prev => [...prev, `\n--- STARTING RAW FETCH TEST ---`]);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                body: JSON.stringify({ messages: [{ role: 'user', content: 'Test from DevConsole' }] })
            });

            setRawLog(prev => [...prev, `Response Status: ${res.status}`]);

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No reader available");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                setRawLog(prev => [...prev, `CHUNK: ${text.trim()}`]);
            }
            setRawLog(prev => [...prev, `--- STREAM COMPLETE ---`]);

        } catch (e: any) {
            setRawLog(prev => [...prev, `TEST ERROR: ${e.message}`]);
        } finally {
            setIsTestLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-black/95 text-green-400 font-mono text-xs p-4 shadow-2xl z-50 flex flex-col border-l border-green-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 border-b border-green-900/50 pb-2">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    <span className="font-bold">DEV CONSOLE</span>
                </div>
                <button onClick={onClose} className="hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {/* Status Section */}
                <section>
                    <h3 className="text-white/50 mb-2 uppercase tracking-wider text-[10px]">Current State</h3>
                    <div className="grid grid-cols-2 gap-2 bg-green-900/10 p-2 rounded border border-green-900/30">
                        <div>Status: <span className={status === 'streaming' ? 'text-yellow-400 animate-pulse' : 'text-white'}>{status}</span></div>
                        <div>Messages: <span className="text-white">{messages.length}</span></div>
                        <div>Has Error: <span className={error ? 'text-red-500' : 'text-white'}>{error ? 'YES' : 'NO'}</span></div>
                    </div>
                </section>

                {/* Manual Test Section */}
                <section>
                    <h3 className="text-white/50 mb-2 uppercase tracking-wider text-[10px]">Diagnostics</h3>
                    <button
                        onClick={runRawTest}
                        disabled={isTestLoading}
                        className="w-full bg-green-900/20 hover:bg-green-900/40 border border-green-700/50 text-green-400 py-2 px-3 rounded flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isTestLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Run Raw Stream Test
                    </button>
                    <p className="mt-2 text-[10px] text-green-600">
                        Sends a direct fetch to /api/chat and dumps raw chunks below. Verifies backend protocol.
                    </p>
                </section>

                {/* Logs Section */}
                <section className="flex flex-col h-[300px]">
                    <h3 className="text-white/50 mb-2 uppercase tracking-wider text-[10px]">Console Output</h3>
                    <div className="flex-1 bg-black/50 border border-green-900/30 rounded p-2 overflow-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                        {rawLog.length === 0 ? <span className="text-green-900 italic">// Waiting for events...</span> : rawLog.map((l, i) => (
                            <div key={i} className="mb-1 border-b border-green-900/10 pb-1 last:border-0">{l}</div>
                        ))}
                    </div>
                </section>

                {/* Raw Messages State */}
                <section>
                    <h3 className="text-white/50 mb-2 uppercase tracking-wider text-[10px]">useChat Messages State</h3>
                    <pre className="bg-black/50 border border-green-900/30 rounded p-2 overflow-auto max-h-[200px] text-[10px]">
                        {JSON.stringify(messages, null, 2)}
                    </pre>
                </section>
            </div>
        </div>
    );
}
