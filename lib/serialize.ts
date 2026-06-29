// Prisma returns Decimal/BigInt that JSON.stringify can't handle directly.
interface DecimalLike {
  toFixed(): string;
  constructor?: { name?: string };
}

export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => {
      if (typeof v === "bigint") return Number(v);
      if (v && typeof v === "object" && typeof (v as DecimalLike).toFixed === "function") {
        return Number((v as DecimalLike).toFixed());
      }
      return v;
    })
  );
}
