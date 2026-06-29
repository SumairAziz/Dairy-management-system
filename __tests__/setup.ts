// Vitest global setup — mock Next.js server-only modules and Prisma
vi.mock("next/server", () => {
  class MockNextResponse {
    static json(data: unknown, init?: { status?: number }) {
      const body = JSON.stringify(data);
      return {
        body,
        status: init?.status ?? 200,
        ok: (init?.status ?? 200) < 400,
        json: async () => JSON.parse(body),
        headers: new Headers({ "content-type": "application/json" }),
      };
    }
    constructor(_body: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200;
      this.body = _body;
    }
    status: number;
    body: unknown;
  }
  return { NextResponse: MockNextResponse };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  NextAuth: vi.fn(),
  default: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// Mock Prisma — lib/errors.ts imports Prisma for instanceof check
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, options: { code: string }) {
      super(message);
      this.code = options.code;
      this.name = "PrismaClientKnownRequestError";
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
    PrismaClient: class {},
  };
});

// Mock lib/db so no real database connection is attempted
vi.mock("@/lib/db", () => ({
  prisma: {},
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock next-auth providers
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
}));