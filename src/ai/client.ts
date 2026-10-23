import type { AiConfig } from "./types";
import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";

export class AiError extends Error {}

/** 是否为原生 App 环境（Capacitor WebView）——走原生 HTTP，无 CORS 限制 */
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 归一化 Base URL：仅当没有 /v1、/v4 等版本后缀时才补 /v1（智谱等用 /v4） */
export function resolveBaseUrl(raw: string): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/v\d+$/i.test(trimmed)) return trimmed;
  return trimmed + "/v1";
}

async function request(url: string, init: RequestInit, apiKey: string): Promise<any> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let status = 0;
  let text = "";
  try {
    if (isNative()) {
      // 原生 App：CapacitorHttp 走系统网络栈，不受浏览器 CORS 限制
      const res = await CapacitorHttp.request({
        url,
        method: (init.method as string) || "GET",
        headers,
        data: init.body ? JSON.parse(init.body as string) : undefined,
        connectTimeout: 30000,
        readTimeout: 300000
      });
      status = res.status;
      text = typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? "");
    } else {
      const res = await fetch(url, { ...init, headers });
      status = res.status;
      text = await res.text();
    }
  } catch (e) {
    throw new AiError(
      `网络请求失败：${(e as Error).message}。请检查 API Base URL、Key 或网络环境。`
    );
  }
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON 响应，保留原文用于报错 */
  }
  if (status < 200 || status >= 300) {
    const snippet = (data?.error?.message || data?.message || text || "").toString().slice(0, 300);
    throw new AiError(`API 请求失败（HTTP ${status}）：${snippet || "未知错误"}`);
  }
  return data;
}

export async function fetchModels(cfg: AiConfig): Promise<string[]> {
  const base = resolveBaseUrl(cfg.baseUrl);
  if (!base) throw new AiError("请先填写 API Base URL。");
  const data = await request(`${base}/models`, { method: "GET" }, cfg.apiKey);
  const ids: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => m?.id).filter((id: unknown): id is string => typeof id === "string")
    : [];
  return Array.from(new Set(ids)).sort();
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** finish_reason === "length"：输出被 max_tokens 截断，内容不完整 */
  truncated: boolean;
}

export async function chat(
  cfg: AiConfig,
  messages: { role: string; content: string }[],
  opts: ChatOptions = {}
): Promise<ChatResult> {
  const base = resolveBaseUrl(cfg.baseUrl);
  if (!base) throw new AiError("请先填写 API Base URL。");
  if (!cfg.model) throw new AiError("请先选择或填写模型名称。");
  const data = await request(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 8192
      })
    },
    cfg.apiKey
  );
  const message = data?.choices?.[0]?.message;
  // 推理模型（如 glm-4.7-flash）可能把正文放在 reasoning_content，content 为空——做回退
  const content = typeof message?.content === "string" && message.content.trim()
    ? message.content
    : typeof message?.reasoning_content === "string"
      ? message.reasoning_content
      : "";
  if (!content.trim()) {
    throw new AiError("API 返回内容为空，请重试或更换模型。");
  }
  const usage = data?.usage || {};
  const promptTokens = Number(usage.prompt_tokens) || 0;
  const completionTokens = Number(usage.completion_tokens) || 0;
  return {
    content: content.trim(),
    promptTokens,
    completionTokens,
    totalTokens: Number(usage.total_tokens) || promptTokens + completionTokens,
    truncated: data?.choices?.[0]?.finish_reason === "length"
  };
}
