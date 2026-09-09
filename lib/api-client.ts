import type { AiAssistantErrorPayload } from "@/lib/ai/assistant-errors";

export interface ApiErrorPayload extends AiAssistantErrorPayload {}

export class ApiRequestError extends Error {
  public readonly payload: ApiErrorPayload;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiRequestError";
    this.payload = payload;
  }
}

export class ApiClient {
  private baseUrl: string;
  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${url}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (res.status === 204) return undefined as unknown as T;
    const json = await res.json();
    if (!res.ok) {
      const payload = (json?.error ?? {
        code: "UNKNOWN_ERROR",
        message: "Request failed",
      }) as ApiErrorPayload;
      throw new ApiRequestError(payload);
    }
    return json.data !== undefined && json.total === undefined
      ? json.data
      : json;
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: "DELETE" });
  }
}

export const api = new ApiClient();
