"use client";

import { useState, useEffect } from "react";
import { Settings, Key, Zap, DollarSign, Eye, EyeOff, Check, X, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getApiKey, setApiKey, clearApiKey, validateApiKey,
    getSelectedModel, setSelectedModel,
    getUsageStats, resetUsageStats,
    getProvider, setProvider,
    getModelsForProvider,
    GEMINI_MODELS, OPENAI_MODELS,
    Provider, ModelId, UsageStats
} from "@/lib/settings";
import { toast } from "sonner";

export default function SettingsPage() {
    // Provider state
    const [currentProvider, setCurrentProvider] = useState<Provider>("gemini");

    // API Key state (one per provider)
    const [geminiKey, setGeminiKeyState] = useState("");
    const [openaiKey, setOpenaiKeyState] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [keyStatus, setKeyStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
    const [keyError, setKeyError] = useState("");

    // Model state
    const [selectedModel, setSelectedModelState] = useState<ModelId>("gemini-2.5-flash");

    // Usage state
    const [usage, setUsage] = useState<UsageStats | null>(null);

    // Load settings on mount
    useEffect(() => {
        const provider = getProvider();
        setCurrentProvider(provider);

        const gemKey = getApiKey("gemini");
        const oaiKey = getApiKey("openai");
        if (gemKey) setGeminiKeyState(gemKey);
        if (oaiKey) setOpenaiKeyState(oaiKey);

        setSelectedModelState(getSelectedModel(provider));
        setUsage(getUsageStats());

        // Set initial key status if key exists
        const currentKey = provider === "openai" ? oaiKey : gemKey;
        if (currentKey) setKeyStatus("valid");
    }, []);

    // Update model when provider changes
    useEffect(() => {
        setSelectedModelState(getSelectedModel(currentProvider));
        const currentKey = currentProvider === "openai" ? openaiKey : geminiKey;
        setKeyStatus(currentKey ? "valid" : "idle");
        setKeyError("");
    }, [currentProvider, geminiKey, openaiKey]);

    const currentKey = currentProvider === "openai" ? openaiKey : geminiKey;
    const setCurrentKey = currentProvider === "openai" ? setOpenaiKeyState : setGeminiKeyState;
    const models = getModelsForProvider(currentProvider);

    const handleProviderChange = (provider: Provider) => {
        setCurrentProvider(provider);
        setProvider(provider);
        toast.success(`Switched to ${provider === "openai" ? "OpenAI" : "Google Gemini"}`);
    };

    const handleSaveKey = async () => {
        if (!currentKey.trim()) {
            setKeyError("Please enter an API key");
            setKeyStatus("invalid");
            return;
        }

        setKeyStatus("validating");
        setKeyError("");

        const result = await validateApiKey(currentKey, currentProvider);

        if (result.valid) {
            setApiKey(currentKey, currentProvider);
            setKeyStatus("valid");
            toast.success("API key saved and validated!");
        } else {
            setKeyStatus("invalid");
            setKeyError(result.error || "Invalid API key");
            toast.error(result.error || "Invalid API key");
        }
    };

    const handleClearKey = () => {
        clearApiKey(currentProvider);
        setCurrentKey("");
        setKeyStatus("idle");
        setKeyError("");
        toast.info("API key removed");
    };

    const handleModelChange = (modelId: ModelId) => {
        setSelectedModelState(modelId);
        setSelectedModel(modelId);
        const model = [...GEMINI_MODELS, ...OPENAI_MODELS].find(m => m.id === modelId);
        toast.success(`Model changed to ${model?.name}`);
    };

    const handleResetUsage = () => {
        resetUsageStats();
        setUsage(getUsageStats());
        toast.info("Usage stats reset");
    };

    const formatCost = (cost: number) => {
        if (cost < 0.01) return `$${cost.toFixed(4)}`;
        return `$${cost.toFixed(2)}`;
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return tokens.toString();
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                    <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">Configure your AI provider and preferences</p>
                </div>
            </div>

            {/* Provider Selection */}
            <section className="bg-card border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">AI Provider</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => handleProviderChange("gemini")}
                        className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border transition-all",
                            currentProvider === "gemini"
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold",
                            currentProvider === "gemini" ? "bg-blue-500 text-white" : "bg-muted"
                        )}>
                            G
                        </div>
                        <div className="text-left">
                            <div className="font-medium">Google Gemini</div>
                            <div className="text-xs text-muted-foreground">Best for document RAG</div>
                        </div>
                    </button>

                    <button
                        onClick={() => handleProviderChange("openai")}
                        className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border transition-all",
                            currentProvider === "openai"
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold",
                            currentProvider === "openai" ? "bg-green-500 text-white" : "bg-muted"
                        )}>
                            O
                        </div>
                        <div className="text-left">
                            <div className="font-medium">OpenAI</div>
                            <div className="text-xs text-muted-foreground">GPT-4o & GPT-4 Turbo</div>
                        </div>
                    </button>
                </div>

                {currentProvider === "openai" && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400">
                        <strong>Note:</strong> OpenAI doesn't support direct file uploads. Document content will be extracted and included in the prompt context.
                    </div>
                )}
            </section>

            {/* API Key Section */}
            <section className="bg-card border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">
                        {currentProvider === "openai" ? "OpenAI" : "Gemini"} API Key
                    </h2>
                </div>

                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showKey ? "text" : "password"}
                                value={currentKey}
                                onChange={(e) => {
                                    setCurrentKey(e.target.value);
                                    setKeyStatus("idle");
                                }}
                                placeholder={currentProvider === "openai" ? "sk-..." : "AIza..."}
                                className="w-full px-4 py-3 pr-12 bg-muted rounded-lg border focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <button
                            onClick={handleSaveKey}
                            disabled={keyStatus === "validating"}
                            className="px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
                        >
                            {keyStatus === "validating" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Save
                        </button>
                        {currentKey && (
                            <button
                                onClick={handleClearKey}
                                className="px-4 py-3 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Status indicator - always show */}
                    <div className={cn(
                        "flex items-center gap-2 text-sm",
                        keyStatus === "valid" && "text-green-500",
                        keyStatus === "invalid" && "text-red-500",
                        keyStatus === "validating" && "text-yellow-500",
                        keyStatus === "idle" && !currentKey && "text-muted-foreground"
                    )}>
                        {keyStatus === "valid" && <Check className="w-4 h-4" />}
                        {keyStatus === "invalid" && <AlertCircle className="w-4 h-4" />}
                        {keyStatus === "validating" && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {keyStatus === "idle" && !currentKey && <AlertCircle className="w-4 h-4" />}
                        <span>
                            {keyStatus === "valid" && "✓ API key saved and validated"}
                            {keyStatus === "invalid" && (keyError || "Invalid API key")}
                            {keyStatus === "validating" && "Validating..."}
                            {keyStatus === "idle" && !currentKey && "No API key saved"}
                            {keyStatus === "idle" && currentKey && "Key entered but not saved — click Save to validate"}
                        </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Your API key is stored locally in your browser. Get one from{" "}
                        {currentProvider === "openai" ? (
                            <a href="https://platform.openai.com/api-keys" target="_blank" className="text-primary hover:underline">
                                OpenAI Platform
                            </a>
                        ) : (
                            <a href="https://aistudio.google.com/apikey" target="_blank" className="text-primary hover:underline">
                                Google AI Studio
                            </a>
                        )}
                    </p>

                </div>
            </section>

            {/* Model Selection Section */}
            <section className="bg-card border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Model Selection</h2>
                </div>

                <div className="grid gap-3">
                    {models.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => handleModelChange(model.id as ModelId)}
                            className={cn(
                                "flex items-start gap-4 p-4 rounded-lg border text-left transition-all",
                                selectedModel === model.id
                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                                selectedModel === model.id ? "border-primary" : "border-muted-foreground"
                            )}>
                                {selectedModel === model.id && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{model.name}</span>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        model.speed === "fast"
                                            ? "bg-green-500/10 text-green-500"
                                            : "bg-yellow-500/10 text-yellow-500"
                                    )}>
                                        {model.speed === "fast" ? "Fast" : "Slower"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{model.description}</p>
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>Input: ${model.inputPrice}/1M tokens</span>
                                    <span>Output: ${model.outputPrice}/1M tokens</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* Usage & Costs Section */}
            <section className="bg-card border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">Usage & Costs</h2>
                    </div>
                    <button
                        onClick={handleResetUsage}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reset
                    </button>
                </div>

                {usage && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-2xl font-bold">{usage.requestCount}</div>
                            <div className="text-sm text-muted-foreground">Requests</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-2xl font-bold">{formatTokens(usage.totalInputTokens)}</div>
                            <div className="text-sm text-muted-foreground">Input Tokens</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-2xl font-bold">{formatTokens(usage.totalOutputTokens)}</div>
                            <div className="text-sm text-muted-foreground">Output Tokens</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-primary">{formatCost(usage.totalCost)}</div>
                            <div className="text-sm text-muted-foreground">Est. Cost</div>
                        </div>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    Usage is tracked locally across all providers. Costs are estimates based on current pricing.
                    Last reset: {usage ? new Date(usage.lastReset).toLocaleDateString() : "Never"}
                </p>
            </section>
        </div>
    );
}
