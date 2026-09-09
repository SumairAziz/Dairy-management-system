export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, "VALIDATION_ERROR", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export function handleApiError(error: unknown): NextResponse {
  if (isStructuredAssistantError(error)) {
    logStructuredAssistantError(error);
    return NextResponse.json(
      { success: false, error: error.toClientPayload() },
      { status: error.statusCode },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFLICT",
              message: "A record with this value already exists",
            },
          },
          { status: 409 },
        );
      case "P2025":
        return NextResponse.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Record not found" },
          },
          { status: 404 },
        );
      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DATABASE_ERROR",
              message: "A database error occurred",
            },
          },
          { status: 500 },
        );
    }
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 },
  );
}

interface StructuredAssistantErrorLike {
  statusCode: number;
  toClientPayload: () => Record<string, unknown>;
}

function isStructuredAssistantError(error: unknown): error is StructuredAssistantErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as StructuredAssistantErrorLike).toClientPayload === "function"
  );
}

function logStructuredAssistantError(
  error: StructuredAssistantErrorLike & {
    code?: string;
    message?: string;
    context?: {
      provider?: string;
      model?: string;
      tool?: string;
      httpStatus?: number;
      httpStatusText?: string;
      details?: string;
    };
  },
): void {
  console.error(
    "[AI ERROR]",
    JSON.stringify({
      code: "code" in error ? error.code : null,
      message: "message" in error ? error.message : null,
      provider: error.context?.provider ?? null,
      model: error.context?.model ?? null,
      tool: error.context?.tool ?? null,
      httpStatus: error.context?.httpStatus ?? null,
      httpStatusText: error.context?.httpStatusText ?? null,
      details: error.context?.details ?? null,
    }),
  );
}
