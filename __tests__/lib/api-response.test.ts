import { describe, it, expect } from "vitest";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
} from "@/lib/api-response";

describe("successResponse", () => {
  it("should return 200 with success:true and data", async () => {
    const res = successResponse({ id: 1, name: "test" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: 1, name: "test" });
  });

  it("should accept custom status code", async () => {
    const res = successResponse("ok", 202);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.data).toBe("ok");
  });
});

describe("errorResponse", () => {
  it("should return 400 by default with success:false", async () => {
    const res = errorResponse("BAD_REQUEST", "Invalid input");
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Invalid input");
  });

  it("should accept custom status code", async () => {
    const res = errorResponse("CUSTOM", "Oops", 422);
    expect(res.status).toBe(422);
  });
});

describe("paginatedResponse", () => {
  it("should return paginated structure with metadata", async () => {
    const data = [{ id: 1 }, { id: 2 }];
    const res = paginatedResponse(data, 50, 1, 20);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(50);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it("should handle empty data array", async () => {
    const res = paginatedResponse([], 0, 1, 10);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });
});

describe("createdResponse", () => {
  it("should return 201 with data", async () => {
    const res = createdResponse({ id: 42 });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(42);
  });
});

describe("noContentResponse", () => {
  it("should return 204 with no body", () => {
    const res = noContentResponse();
    expect(res.status).toBe(204);
  });
});