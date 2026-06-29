import { describe, it, expect } from "vitest";
import { serialize } from "@/lib/serialize";

describe("serialize", () => {
  it("should pass through plain objects unchanged", () => {
    const input = { a: 1, b: "hello", c: true, d: null };
    expect(serialize(input)).toEqual(input);
  });

  it("should convert bigint to number", () => {
    const input = { big: BigInt(9007199254740991) };
    const result = serialize(input);
    expect(typeof result.big).toBe("number");
    expect(result.big).toBe(9007199254740991);
  });

  it("should convert Decimal-like objects (with toFixed) to number", () => {
    const decimalLike = { value: 15.75, toFixed: () => "15.75" };
    const input = { amount: decimalLike };
    const result = serialize(input);
    expect(typeof result.amount).toBe("number");
    expect(result.amount).toBe(15.75);
  });

  it("should handle nested Decimal-like objects", () => {
    const input = {
      items: [
        { price: { toFixed: () => "9.99" } },
        { price: { toFixed: () => "20.00" } },
      ],
    };
    const result = serialize(input);
    expect(result.items[0].price).toBe(9.99);
    expect(result.items[1].price).toBe(20);
  });

  it("should handle arrays", () => {
    const input = [1, "two", BigInt(3), null];
    const result = serialize(input);
    expect(result).toEqual([1, "two", 3, null]);
  });

  it("should handle deeply nested structures", () => {
    const input = { level1: { level2: { big: BigInt(42), normal: "value" } } };
    const result = serialize(input);
    expect(result.level1.level2.big).toBe(42);
    expect(result.level1.level2.normal).toBe("value");
  });

  it("should return a new object (not same reference)", () => {
    const input = { x: 1 };
    const result = serialize(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("should handle null top-level value", () => {
    expect(serialize(null)).toBe(null);
  });

  it("should throw on undefined top-level value (JSON.stringify limitation)", () => {
    // JSON.stringify(undefined) returns undefined (not a string), so JSON.parse throws
    expect(() => serialize(undefined)).toThrow();
  });

  it("should omit undefined values inside objects (JSON.stringify behavior)", () => {
    // JSON.stringify strips undefined values from objects
    expect(serialize({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });
});