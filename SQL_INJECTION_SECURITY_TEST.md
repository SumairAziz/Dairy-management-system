# TerraDairy SQL Injection Security Test

**Test date:** 2026-09-17  
**Scope:** Local application only: `http://localhost:3000`  
**Target:** NextAuth credentials login callback  
**Database safety:** No SQL write, destructive statement, record dump, or database modification was attempted.

## Executive Result

**PASS - No SQL injection vulnerability was observed in the login flow.**

Every valid-CSRF test case failed authentication with an HTTP `302` redirect to:

`/api/auth/error?error=CredentialsSignin&provider=credentials`

No test produced a successful session, authentication bypass, SQL/database error, stack trace, query text, or unexpected database behavior.

## Implementation Review

### Login route

- `app/api/auth/[...nextauth]/route.ts` exports the NextAuth GET and POST handlers.
- The browser login mutation in `hooks/use-auth.ts` calls `signIn("credentials", { email, password, redirect: false })`.
- `middleware.ts` permits `/api/auth`; NextAuth performs the credentials verification.

### Authentication query and verification

`lib/auth.ts` uses:

```ts
const user = await prisma.users.findUnique({
  where: { email: credentials.email },
});
```

The password is verified with:

```ts
const isValid = await bcrypt.compare(credentials.password, user.password_hash);
```

The query is Prisma's structured model API. User input is supplied as a value, not concatenated into SQL. No `queryRawUnsafe` or `executeRawUnsafe` usage was found. No raw SQL construction using login input was found.

### Validation and sanitization

- `validators/auth.validator.ts` requires a syntactically valid email and a password of at least six characters.
- `app/login/page.tsx` applies this schema before calling `signIn`.
- Direct requests were also tested against the callback, so the result does not depend only on client-side validation.
- The callback returns a generic credentials failure rather than exposing database details.

### Database and session layers

- `lib/db.ts` creates a Prisma client using `PrismaPg` and `DATABASE_URL`.
- `lib/auth.ts` uses JWT sessions (`session.strategy = "jwt"`).
- A successful authorization would populate the JWT with user ID, role, and permissions. None of the injection cases reached that path.
- `services/auth.service.ts` also uses Prisma model methods for registration, lookup, and password changes, and uses bcrypt hashing/comparison.

## Controlled Test Cases

All requests used the local callback and a valid NextAuth CSRF token. Payloads were sent as form values only. `PASS` means the payload did not bypass authentication and did not cause an application/database error.

| ID | Field(s) | Payload | HTTP result | Authentication bypass | Error/data disclosure | Result |
|---|---|---|---|---|---|---|
| 1 | Email | `' OR '1'='1` | 302, `CredentialsSignin` | No | No | PASS |
| 2 | Email | `' OR 1=1 --` | 302, `CredentialsSignin` | No | No | PASS |
| 3 | Email | `admin' --` | 302, `CredentialsSignin` | No | No | PASS |
| 4 | Email | `' UNION SELECT NULL --@example.com` | 302, `CredentialsSignin` | No | No | PASS |
| 5 | Email | `attacker'@example.com` | 302, `CredentialsSignin` | No | No | PASS |
| 6 | Email | `test@example.com' OR 1=1 --` | 302, `CredentialsSignin` | No | No | PASS |
| 7 | Password | `' OR '1'='1` | 302, `CredentialsSignin` | No | No | PASS |
| 8 | Password | `' OR 1=1 --` | 302, `CredentialsSignin` | No | No | PASS |
| 9 | Password | `admin' --` | 302, `CredentialsSignin` | No | No | PASS |
| 10 | Password | `' UNION SELECT NULL --` | 302, `CredentialsSignin` | No | No | PASS |
| 11 | Email and password | `' OR 1=1 --@example.com` / `' OR 1=1 --` | 302, `CredentialsSignin` | No | No | PASS |

The response headers included only the normal NextAuth callback URL cookie. No session token was issued by any test.

## Findings

### SQL injection vulnerability

**None identified. Severity: Informational / Pass.**

The tests fail safely because Prisma parameterizes the email value in `findUnique`, and the password is never used as SQL. The password is compared against the stored bcrypt hash after the user lookup. Quotes, comments, operators, and UNION-shaped input therefore remain ordinary string data and cannot change the query predicate.

### Recommended hardening

No application fix is required for SQL injection based on this audit. Continue to:

1. Keep authentication lookups on Prisma model APIs or tagged parameterized queries.
2. Do not introduce `queryRawUnsafe` or `executeRawUnsafe` with request data.
3. Preserve generic authentication errors and keep `NEXTAUTH_SECRET` configured in deployed environments.
4. Keep server-side validation for any future custom authentication endpoint; client-side Zod validation alone is not a security boundary.

## Limitations

This was a focused login SQL injection audit. It did not test authenticated application endpoints, authorization logic, rate limiting, CSRF policy beyond obtaining the required local NextAuth token, or non-login query parameters. Raw SQL elsewhere in the application should receive a separate review if those endpoints accept user-controlled input.