import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "@/lib/api-client";

// Helper to create a mock fetch that returns JSON
function mockFetchJson(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status < 400,
    json: () => Promise.resolve(data),
    headers: new Headers({ "content-type": "application/json" }),
  });
}

describe("ApiClient", () => {
  let client: ApiClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    client = new ApiClient("/api");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should default baseUrl to /api", () => {
      const c = new ApiClient();
      // We can't access baseUrl directly, but we can test behavior
      expect(c).toBeInstanceOf(ApiClient);
    });

    it("should accept custom baseUrl", () => {
      const c = new ApiClient("/v1");
      expect(c).toBeInstanceOf(ApiClient);
    });
  });

  describe("get", () => {
    it("should make GET request and unwrap json.data", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: { id: 1, name: "Farm" } });
      const result = await client.get<{ id: number; name: string }>("/farms");
      expect(result).toEqual({ id: 1, name: "Farm" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/farms",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should return full json when json.data is undefined", async () => {
      globalThis.fetch = mockFetchJson({ items: [1, 2, 3] });
      const result = await client.get("/something");
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it("should throw on non-ok response with error message", async () => {
      globalThis.fetch = mockFetchJson(
        { success: false, error: { code: "NOT_FOUND", message: "Not found" } },
        404
      );
      await expect(client.get("/farms/999")).rejects.toThrow("Not found");
    });

    it("should throw generic message when error structure is unexpected", async () => {
      globalThis.fetch = mockFetchJson("something went wrong", 500);
      await expect(client.get("/fail")).rejects.toThrow("Request failed");
    });
  });

  describe("post", () => {
    it("should make POST request with JSON body", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: { id: 42 } });
      const body = { name: "New Farm" };
      const result = await client.post("/farms", body);
      expect(result).toEqual({ id: 42 });

      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[0]).toBe("/api/farms");
      expect(call[1].method).toBe("POST");
      expect(call[1].body).toBe(JSON.stringify(body));
    });

    it("should not set body when undefined", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: null });
      await client.post("/ping");
      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[1].body).toBeUndefined();
    });
  });

  describe("put", () => {
    it("should make PUT request with JSON body", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: { id: 1, updated: true } });
      const result = await client.put("/farms/1", { farm_name: "Updated" });
      expect(result).toEqual({ id: 1, updated: true });

      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[1].method).toBe("PUT");
      expect(call[1].body).toBe(JSON.stringify({ farm_name: "Updated" }));
    });
  });

  describe("patch", () => {
    it("should make PATCH request with JSON body", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: { marked: 5 } });
      const result = await client.patch("/notifications", { action: "mark_all_read" });
      expect(result).toEqual({ marked: 5 });

      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[1].method).toBe("PATCH");
    });
  });

  describe("del", () => {
    it("should make DELETE request", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: { ok: true } });
      const result = await client.del("/farms/1");
      expect(result).toEqual({ ok: true });

      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[0]).toBe("/api/farms/1");
      expect(call[1].method).toBe("DELETE");
    });
  });

  describe("204 handling", () => {
    it("should return undefined for 204 responses", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 204,
        ok: true,
      });
      const result = await client.del("/farms/1");
      expect(result).toBeUndefined();
    });
  });

  describe("Content-Type header", () => {
    it("should set Content-Type to application/json", async () => {
      globalThis.fetch = mockFetchJson({ success: true, data: {} });
      await client.get("/test");
      const call = (globalThis.fetch as ReturnType<typeof mockFetchJson>).mock.calls[0];
      expect(call[1].headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/json" })
      );
    });
  });
});