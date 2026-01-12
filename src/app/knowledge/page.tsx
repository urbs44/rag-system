"use client";

import { useState, useEffect } from "react";
import { UploadZone } from "@/components/knowledge/upload-zone";
import { FileList } from "@/components/knowledge/file-list";
import { getProvider, Provider } from "@/lib/settings";
import { cn } from "@/lib/utils";

export default function KnowledgePage() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [currentProvider, setCurrentProvider] = useState<Provider>("gemini");

    useEffect(() => {
        setCurrentProvider(getProvider());
    }, []);

    const handleUploadComplete = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage the documents your AI assistant uses for reference.
                    </p>
                </div>

                {/* Provider indicator */}
                <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                    currentProvider === "gemini"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-green-500/10 text-green-600"
                )}>
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold",
                        currentProvider === "gemini" ? "bg-blue-500" : "bg-green-500"
                    )}>
                        {currentProvider === "gemini" ? "G" : "O"}
                    </div>
                    <div>
                        <div>{currentProvider === "gemini" ? "Google Gemini" : "OpenAI"}</div>
                        <div className="text-xs opacity-70">Files stored here</div>
                    </div>
                </div>
            </div>

            <UploadZone onUploadComplete={handleUploadComplete} />

            <div>
                <h2 className="text-xl font-semibold mb-4">Indexed Documents</h2>
                <FileList refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
}
