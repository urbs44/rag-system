
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
    try {
        // const list = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).getGenerativeModel().listModels();
        // Wait, listModels is on the client info or similar? 
        // Actually the SDK has a model manager? 
        // Let's use the fetch directly if SDK is confusing, but SDK usually has `getGenerativeModel`.
        // Actually `genAI.getGenerativeModel` returns a model.
        // There isn't a top level `listModels` in the simplified SDK structure?
        // Let's try to query via simple fetch if strict SDK typing is annoying.

        // SDK way:
        // This might not expose listModels easily in the node SDK wrapper without looking at docs.
        // Falling back to direct REST call if needed, but let's try the simple script first.

        // Actually, checking docs: `getGenerativeModel` doesn't list.
        // But `GoogleGenerativeAI` class doesn't have list method.
        // It's usually `fetch("https://generativelanguage.googleapis.com/v1beta/models?key=...")`

        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("No key found");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        console.log("Available Models:");
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log("- " + m.name);
                }
            });
        } else {
            console.log("No models returned", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
