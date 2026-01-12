// Settings storage utilities
// All settings stored in localStorage for client-side management

// Storage keys
const STORAGE_KEYS = {
    PROVIDER: "rag-provider",
    GEMINI_API_KEY: "rag-gemini-api-key",
    OPENAI_API_KEY: "rag-openai-api-key",
    MODEL: "rag-model",
    USAGE: "rag-usage",
} as const;

// Provider type
export type Provider = "gemini" | "openai";

// Gemini models with pricing (per 1M tokens)
export const GEMINI_MODELS = [
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Latest & fastest. Best for most use cases.",
        inputPrice: 0.15,
        outputPrice: 0.60,
        speed: "fast" as const,
    },
    {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Fast and cost-effective. Good balance.",
        inputPrice: 0.075,
        outputPrice: 0.30,
        speed: "fast" as const,
    },
    {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Most capable. Best for complex reasoning.",
        inputPrice: 1.25,
        outputPrice: 5.00,
        speed: "slow" as const,
    },
];

// OpenAI models with pricing (per 1M tokens)
export const OPENAI_MODELS = [
    {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Most capable. Best for complex tasks.",
        inputPrice: 2.50,
        outputPrice: 10.00,
        speed: "fast" as const,
    },
    {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Fast and affordable. Great for most tasks.",
        inputPrice: 0.15,
        outputPrice: 0.60,
        speed: "fast" as const,
    },
    {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Powerful with large context. Good for analysis.",
        inputPrice: 10.00,
        outputPrice: 30.00,
        speed: "slow" as const,
    },
];

// Combined models type - keeping for backward compatibility
export const MODELS = GEMINI_MODELS;

export type GeminiModelId = typeof GEMINI_MODELS[number]["id"];
export type OpenAIModelId = typeof OPENAI_MODELS[number]["id"];
export type ModelId = GeminiModelId | OpenAIModelId;

export interface UsageStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    lastReset: string;
    requestCount: number;
}

// Provider functions
export function getProvider(): Provider {
    if (typeof window === "undefined") return "gemini";
    const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER);
    if (stored === "openai") return "openai";
    return "gemini";
}

export function setProvider(provider: Provider): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
}

// API Key functions - now provider-specific
export function getApiKey(provider?: Provider): string | null {
    if (typeof window === "undefined") return null;
    const p = provider || getProvider();
    const key = p === "openai" ? STORAGE_KEYS.OPENAI_API_KEY : STORAGE_KEYS.GEMINI_API_KEY;
    return localStorage.getItem(key);
}

export function setApiKey(apiKey: string, provider?: Provider): void {
    if (typeof window === "undefined") return;
    const p = provider || getProvider();
    const key = p === "openai" ? STORAGE_KEYS.OPENAI_API_KEY : STORAGE_KEYS.GEMINI_API_KEY;
    localStorage.setItem(key, apiKey);
}

export function clearApiKey(provider?: Provider): void {
    if (typeof window === "undefined") return;
    const p = provider || getProvider();
    const key = p === "openai" ? STORAGE_KEYS.OPENAI_API_KEY : STORAGE_KEYS.GEMINI_API_KEY;
    localStorage.removeItem(key);
}

// Model selection functions
export function getSelectedModel(provider?: Provider): ModelId {
    if (typeof window === "undefined") return "gemini-2.5-flash";
    const stored = localStorage.getItem(STORAGE_KEYS.MODEL);
    const p = provider || getProvider();
    const models = p === "openai" ? OPENAI_MODELS : GEMINI_MODELS;

    // Validate stored model is valid for current provider
    if (stored && models.some(m => m.id === stored)) {
        return stored as ModelId;
    }
    // Return default for current provider
    return p === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash";
}

export function setSelectedModel(modelId: ModelId): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.MODEL, modelId);
}

// Get models for current or specified provider
export function getModelsForProvider(provider?: Provider) {
    const p = provider || getProvider();
    return p === "openai" ? OPENAI_MODELS : GEMINI_MODELS;
}

// Usage tracking functions
export function getUsageStats(): UsageStats {
    if (typeof window === "undefined") {
        return getDefaultUsageStats();
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.USAGE);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to parse usage stats:", e);
    }
    return getDefaultUsageStats();
}

function getDefaultUsageStats(): UsageStats {
    return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        lastReset: new Date().toISOString(),
        requestCount: 0,
    };
}

export function trackUsage(inputTokens: number, outputTokens: number, modelId: string): void {
    if (typeof window === "undefined") return;

    // Find model in either provider's list
    const allModels = [...GEMINI_MODELS, ...OPENAI_MODELS];
    const model = allModels.find(m => m.id === modelId);
    if (!model) return;

    const current = getUsageStats();

    // Calculate cost (prices are per 1M tokens)
    const inputCost = (inputTokens / 1_000_000) * model.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * model.outputPrice;

    const updated: UsageStats = {
        totalInputTokens: current.totalInputTokens + inputTokens,
        totalOutputTokens: current.totalOutputTokens + outputTokens,
        totalCost: current.totalCost + inputCost + outputCost,
        lastReset: current.lastReset,
        requestCount: current.requestCount + 1,
    };

    localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(updated));
}

export function resetUsageStats(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(getDefaultUsageStats()));
}

// Validate API key by making a test request
export async function validateApiKey(key: string, provider?: Provider): Promise<{ valid: boolean; error?: string }> {
    try {
        const p = provider || getProvider();
        const response = await fetch("/api/validate-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: key, provider: p }),
        });

        if (response.ok) {
            return { valid: true };
        }

        const data = await response.json();
        return { valid: false, error: data.error || "Invalid API key" };
    } catch (e) {
        return { valid: false, error: "Failed to validate key" };
    }
}
