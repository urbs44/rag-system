"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiKey, getProvider } from "@/lib/settings";
import { OPENAI_STORAGE_KEYS } from "@/lib/openai-assistants";

interface KnowledgeFile {
    uri: string;
    name: string;
    mimeType: string;
    createTime: string;
    expirationTime?: string;
    state: string;
    provider?: string;
}

export function FileList({ refreshTrigger }: { refreshTrigger: number }) {
    const [files, setFiles] = useState<KnowledgeFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFiles = async () => {
        setIsLoading(true);
        try {
            const provider = getProvider();
            const apiKey = getApiKey(provider);

            if (!apiKey) {
                toast.error(`No ${provider === "openai" ? "OpenAI" : "Gemini"} API key. Add one in Settings.`);
                setIsLoading(false);
                return;
            }

            // Build headers based on provider
            const headers: Record<string, string> = {
                "x-api-key": apiKey,
                "x-provider": provider,
            };

            if (provider === "openai") {
                const vectorStoreId = localStorage.getItem(OPENAI_STORAGE_KEYS.VECTOR_STORE_ID);
                if (vectorStoreId) headers["x-vector-store-id"] = vectorStoreId;
            }

            const res = await fetch("/api/files", { headers });
            if (!res.ok) throw new Error("Failed to fetch files");
            const data = await res.json();
            setFiles(data.files || []);
        } catch (error) {
            console.error(error);
            toast.error("Could not load knowledge base");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [refreshTrigger]);

    const getStateColor = (state: string) => {
        switch (state) {
            case "ACTIVE":
            case "completed": return "bg-green-500/10 text-green-500";
            case "PROCESSING":
            case "in_progress": return "bg-yellow-500/10 text-yellow-500";
            case "FAILED":
            case "failed": return "bg-red-500/10 text-red-500";
            default: return "bg-primary/10 text-primary";
        }
    };

    if (isLoading && files.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-lg bg-muted/20">
                No documents found. Upload some files to get started.
            </div>
        );
    }

    const provider = getProvider();

    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3">File Name</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Added</th>
                        {provider === "gemini" && <th className="px-6 py-3">Expires</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {files.map((file) => {
                        const expiresIn = file.expirationTime
                            ? formatDistanceToNow(new Date(file.expirationTime), { addSuffix: true })
                            : "—";
                        const isExpiringSoon = file.expirationTime
                            && new Date(file.expirationTime).getTime() - Date.now() < 6 * 60 * 60 * 1000;

                        return (
                            <tr key={file.uri} className="hover:bg-muted/50 transition-colors">
                                <td className="px-6 py-4 font-medium flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    {file.name}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">{file.mimeType}</td>
                                <td className="px-6 py-4">
                                    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", getStateColor(file.state))}>
                                        {file.state === "completed" ? "ACTIVE" : file.state}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {format(new Date(file.createTime), "MMM d, yyyy")}
                                </td>
                                {provider === "gemini" && (
                                    <td className={cn("px-6 py-4", isExpiringSoon ? "text-orange-500 font-medium" : "text-muted-foreground")}>
                                        {expiresIn}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
