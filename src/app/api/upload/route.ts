
import { NextResponse } from "next/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { uploadFileToVectorStore, getOrCreateAssistant } from "@/lib/openai-assistants";

export async function POST(request: Request) {
    try {
        // Get API key and provider from headers
        const apiKey = request.headers.get("x-api-key");
        const provider = request.headers.get("x-provider") || "gemini";
        const assistantId = request.headers.get("x-assistant-id");
        const vectorStoreId = request.headers.get("x-vector-store-id");

        if (!apiKey) {
            return NextResponse.json({
                error: `No ${provider === "openai" ? "OpenAI" : "Gemini"} API key configured. Please add one in Settings.`
            }, { status: 400 });
        }

        const formData = await request.formData();
        const files = formData.getAll("files") as File[];

        if (!files.length) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        if (provider === "openai") {
            // Upload to OpenAI Vector Store
            return await handleOpenAIUpload(apiKey, files, assistantId, vectorStoreId);
        } else {
            // Upload to Gemini File API
            return await handleGeminiUpload(apiKey, files);
        }

    } catch (error: any) {
        console.error("Upload error:", error);

        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("invalid_api_key")) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        return NextResponse.json({ error: "Upload failed: " + error.message }, { status: 500 });
    }
}

async function handleGeminiUpload(apiKey: string, files: File[]) {
    const fileManager = new GoogleAIFileManager(apiKey);

    const uploadPromises = files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const tempPath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
        await writeFile(tempPath, buffer);

        try {
            const uploadResponse = await fileManager.uploadFile(tempPath, {
                mimeType: file.type,
                displayName: file.name,
            });
            return uploadResponse.file;
        } finally {
            await unlink(tempPath).catch(console.error);
        }
    });

    const results = await Promise.all(uploadPromises);
    return NextResponse.json({ uploaded: results, provider: "gemini" });
}

async function handleOpenAIUpload(
    apiKey: string,
    files: File[],
    assistantIdParam: string | null,
    vectorStoreIdParam: string | null
) {
    const openai = new OpenAI({ apiKey });

    // Ensure assistant and vector store exist
    const { assistantId, vectorStoreId } = await getOrCreateAssistant(
        openai,
        assistantIdParam,
        vectorStoreIdParam
    );

    const uploadPromises = files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const result = await uploadFileToVectorStore(
            openai,
            vectorStoreId,
            buffer,
            file.name,
            file.type
        );

        return {
            id: result.fileId,
            name: file.name,
            status: "completed",
        };
    });

    const results = await Promise.all(uploadPromises);

    return NextResponse.json({
        uploaded: results,
        provider: "openai",
        assistantId,
        vectorStoreId,
    });
}
