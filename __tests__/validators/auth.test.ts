import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/validators/auth.validator";

describe("loginSchema", () => {
  it("should accept valid email + password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("should reject missing email", () => {
    const result = loginSchema.safeParse({ password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("should reject short password (< 6 chars)", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "abc" });
    expect(result.success).toBe(false);
  });

  it("should reject missing password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com" });
    expect(result.success).toBe(false);
  });

  it("should accept 6-char password (boundary)", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "123456" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  const valid = { name: "John Doe", email: "john@test.com", password: "password123", role: "VIEWER" };

  it("should accept valid registration data", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should default role to VIEWER when omitted", () => {
    const { role, ...withoutRole } = valid;
    const result = registerSchema.safeParse(withoutRole);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("VIEWER");
  });

  it("should accept all valid roles", () => {
    for (const role of ["ADMIN", "MANAGER", "VETERINARIAN", "WORKER", "VIEWER"]) {
      const result = registerSchema.safeParse({ ...valid, role });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid role", () => {
    const result = registerSchema.safeParse({ ...valid, role: "SUPERADMIN" });
    expect(result.success).toBe(false);
  });

  it("should reject empty name", () => {
    const result = registerSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject name over 100 chars", () => {
    const result = registerSchema.safeParse({ ...valid, name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should accept name at exactly 100 chars", () => {
    const result = registerSchema.safeParse({ ...valid, name: "x".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("should reject missing email", () => {
    const { email, ...noEmail } = valid;
    const result = registerSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "bad" });
    expect(result.success).toBe(false);
  });
});