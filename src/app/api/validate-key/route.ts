import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export async function POST(request: Request) {
    try {
        const { apiKey, provider = "gemini" } = await request.json();

        if (!apiKey || typeof apiKey !== "string") {
            return NextResponse.json({ error: "API key required" }, { status: 400 });
        }

        if (provider === "openai") {
            // Validate OpenAI key
            const openai = new OpenAI({ apiKey });
            await openai.models.list();
            return NextResponse.json({ valid: true });
        } else {
            // Validate Gemini key
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            await model.generateContent("Say 'OK' if you can read this.");
            return NextResponse.json({ valid: true });
        }
    } catch (error: any) {
        console.error("API key validation error:", error);

        // Rate limit means the key IS valid (got past auth), just quota exceeded
        if (error.status === 429) {
            return NextResponse.json({ valid: true, warning: "Rate limited, but key is valid" });
        }

        let errorMessage = "Invalid API key";
        if (error.message?.includes("API_KEY_INVALID")) {
            errorMessage = "Gemini API key is invalid";
        } else if (error.message?.includes("invalid_api_key") || error.code === "invalid_api_key") {
            errorMessage = "OpenAI API key is invalid";
        } else if (error.message?.includes("PERMISSION_DENIED")) {
            errorMessage = "API key doesn't have required permissions";
        } else if (error.status === 401) {
            errorMessage = "Invalid API key";
        }

        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
}

