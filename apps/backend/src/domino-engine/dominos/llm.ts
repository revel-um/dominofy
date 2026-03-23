import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { PipelineStep } from "../../../../../shared/types/pipelineStepType";
import { DominoExecutable, ExecuteContext, DominoResult } from "../domino-engine.type";

type VertexGeneratePart = { text?: string };
type VertexGenerateContent = { parts?: VertexGeneratePart[] };
type VertexGenerateCandidate = { content?: VertexGenerateContent };
type VertexGenerateResponse = { candidates?: VertexGenerateCandidate[] };

export class LLMDomino implements DominoExecutable {
  id: string;
  type = "llm" as const;
  private promptTemplate: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.promptTemplate = String(node.data?.Prompt?.value ?? "").trim();
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();

    const promptInput = ctx.input?.Prompt;
    const prompt = this.toPrompt(promptInput, this.promptTemplate);
    if (!prompt) {
      return {
        id: this.id,
        output: "",
        startedAt,
        finishedAt: Date.now(),
      };
    }

    const configuredModel =
      process.env.VERTEX_MODEL?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      "gemini-2.0-flash";
    const apiKey = process.env.GOOGLE_API_KEY?.trim();

    const res = apiKey
      ? await this.callGeminiWithApiKeyWithFallback(prompt, configuredModel, apiKey, ctx.abortSignal)
      : await this.callVertexWithAdc(prompt, configuredModel, ctx.abortSignal);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`AI request failed (${res.status}): ${errorBody}`);
    }

    const data = (await res.json()) as VertexGenerateResponse;
    const outputText = this.extractText(data);

    return {
      id: this.id,
      output: outputText,
      startedAt,
      finishedAt: Date.now(),
    };
  }

  private extractText(data: VertexGenerateResponse): string {
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    return text;
  }

  private async callGeminiWithApiKey(
    prompt: string,
    model: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal,
    });
  }

  private async callGeminiWithApiKeyWithFallback(
    prompt: string,
    configuredModel: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const candidates = Array.from(
      new Set([configuredModel, "gemini-2.0-flash", "gemini-2.5-flash"])
    );

    let lastResponse: Response | null = null;
    for (const model of candidates) {
      const res = await this.callGeminiWithApiKey(prompt, model, apiKey, signal);
      if (res.ok) return res;

      // Retry with fallback model only when the model isn't found.
      if (res.status !== 404) {
        return res;
      }
      lastResponse = res;
    }

    if (lastResponse) return lastResponse;
    throw new Error("Gemini request failed before receiving a response");
  }

  private async callVertexWithAdc(
    prompt: string,
    model: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const projectId = this.resolveProjectId();
    const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";
    if (!projectId) {
      throw new Error(
        "Missing Google project id. Set VERTEX_PROJECT_ID (or GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT) when using ADC."
      );
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    if (!accessToken) {
      throw new Error("Failed to acquire Google access token for Vertex AI");
    }

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal,
    });
  }

  private resolveProjectId(): string | null {
    const explicit =
      process.env.VERTEX_PROJECT_ID?.trim() ||
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCLOUD_PROJECT?.trim();
    if (explicit) return explicit;

    const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (!credsPath) return null;

    try {
      const raw = readFileSync(credsPath, "utf8");
      const parsed = JSON.parse(raw) as { project_id?: string };
      return parsed.project_id?.trim() || null;
    } catch {
      return null;
    }
  }

  private toPrompt(inputPrompt: unknown, fallbackPrompt: string): string {
    if (typeof inputPrompt === "string") return inputPrompt.trim();
    if (inputPrompt === undefined || inputPrompt === null) return fallbackPrompt;
    if (typeof inputPrompt === "number" || typeof inputPrompt === "boolean") {
      return String(inputPrompt);
    }
    try {
      return JSON.stringify(inputPrompt);
    } catch {
      return fallbackPrompt;
    }
  }
}
