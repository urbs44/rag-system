"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiKey, getProvider } from "@/lib/settings";
import { OPENAI_STORAGE_KEYS } from "@/lib/openai-assistants";

export function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const provider = getProvider();
        const apiKey = getApiKey(provider);

        if (!apiKey) {
            toast.error(`No ${provider === "openai" ? "OpenAI" : "Gemini"} API key. Add one in Settings.`);
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        acceptedFiles.forEach((file) => {
            formData.append("files", file);
        });

        try {
            // Build headers based on provider
            const headers: Record<string, string> = {
                "x-api-key": apiKey,
                "x-provider": provider,
            };

            // Add OpenAI-specific headers if needed
            if (provider === "openai") {
                const assistantId = localStorage.getItem(OPENAI_STORAGE_KEYS.ASSISTANT_ID);
                const vectorStoreId = localStorage.getItem(OPENAI_STORAGE_KEYS.VECTOR_STORE_ID);
                if (assistantId) headers["x-assistant-id"] = assistantId;
                if (vectorStoreId) headers["x-vector-store-id"] = vectorStoreId;
            }

            const response = await fetch("/api/upload", {
                method: "POST",
                headers,
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Upload failed");
            }

            // Store OpenAI resource IDs if returned
            if (data.assistantId) {
                localStorage.setItem(OPENAI_STORAGE_KEYS.ASSISTANT_ID, data.assistantId);
            }
            if (data.vectorStoreId) {
                localStorage.setItem(OPENAI_STORAGE_KEYS.VECTOR_STORE_ID, data.vectorStoreId);
            }

            toast.success(`Files uploaded to ${provider === "openai" ? "OpenAI" : "Gemini"}`);
            onUploadComplete();
        } catch (error: any) {
            toast.error(error.message || "Failed to upload files");
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "text/plain": [".txt", ".md"],
        },
        disabled: isUploading,
    });

    return (
        <div
            {...getRootProps()}
            className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                isUploading && "opacity-50 cursor-not-allowed"
            )}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                {isUploading ? (
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                    <UploadCloud className="h-10 w-10 text-muted-foreground" />
                )}
                <div className="text-sm text-muted-foreground">
                    {isUploading ? (
                        <p>Uploading to Knowledge Base...</p>
                    ) : (
                        <>
                            <p className="font-semibold text-foreground">Click to upload or drag and drop</p>
                            <p>PDF, TXT, or MD (max 10MB)</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
