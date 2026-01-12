
import { NextResponse } from "next/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";
import { listVectorStoreFiles } from "@/lib/openai-assistants";

export async function GET(request: Request) {
    try {
        // Get API key and provider from headers
        const apiKey = request.headers.get("x-api-key");
        const provider = request.headers.get("x-provider") || "gemini";
        const vectorStoreId = request.headers.get("x-vector-store-id");

        if (!apiKey) {
            return NextResponse.json({
                error: `No ${provider === "openai" ? "OpenAI" : "Gemini"} API key configured. Please add one in Settings.`,
                files: []
            }, { status: 400 });
        }

        if (provider === "openai") {
            return await handleOpenAIList(apiKey, vectorStoreId);
        } else {
            return await handleGeminiList(apiKey);
        }

    } catch (error: any) {
        console.error("Error fetching files:", error);

        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("invalid_api_key")) {
            return NextResponse.json({ error: "Invalid API key", files: [] }, { status: 401 });
        }

        return NextResponse.json({ error: "Failed to fetch files", files: [] }, { status: 500 });
    }
}

async function handleGeminiList(apiKey: string) {
    const fileManager = new GoogleAIFileManager(apiKey);
    const response = await fileManager.listFiles();
    console.log("Gemini files response:", response);

    if (!response.files) {
        return NextResponse.json({ files: [], provider: "gemini" });
    }

    const files = response.files.map((f) => ({
        uri: f.uri,
        name: f.displayName,
        mimeType: f.mimeType,
        createTime: f.createTime,
        expirationTime: f.expirationTime,
        state: f.state,
        provider: "gemini",
    }));

    return NextResponse.json({ files, provider: "gemini" });
}

async function handleOpenAIList(apiKey: string, vectorStoreId: string | null) {
    if (!vectorStoreId) {
        return NextResponse.json({
            files: [],
            provider: "openai",
            message: "No vector store created yet. Upload a file to create one."
        });
    }

    const openai = new OpenAI({ apiKey });

    try {
        const files = await listVectorStoreFiles(openai, vectorStoreId);

        const formattedFiles = files.map((f) => ({
            uri: f.id,
            name: f.name,
            mimeType: "application/octet-stream", // OpenAI doesn't provide mime type
            createTime: new Date(f.createdAt * 1000).toISOString(),
            state: f.status === "completed" ? "ACTIVE" : f.status,
            provider: "openai",
        }));

        return NextResponse.json({ files: formattedFiles, provider: "openai" });
    } catch (e: any) {
        // Vector store might not exist
        if (e.status === 404) {
            return NextResponse.json({
                files: [],
                provider: "openai",
                message: "Vector store not found. Upload a file to create one."
            });
        }
        throw e;
    }
}
