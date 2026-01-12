
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Allow build execution without key.
// In runtime, this will fail if key is missing when we try to use it.
const apiKey = process.env.GEMINI_API_KEY || "BUILD_PLACEHOLDER";

export const fileManager = new GoogleAIFileManager(apiKey);
