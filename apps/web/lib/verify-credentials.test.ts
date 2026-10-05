import { hashPassword } from "@ddn-portal/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `verifyCredentials` is the pure logic behind the Credentials provider's
 * `authorize()` -- mocking `./db`'s `prisma` here (rather than pointing at
 * a real database, the convention `seed-admin.test.ts` and `password.test.ts`
 * use for the DB-backed/no-DB-needed pieces this delegates to) keeps this
 * fast and deterministic: the thing actually under test is the
 * normalization and null-handling branches, not the Prisma wiring or the
 * hash comparison, which those other suites already cover against both a
 * real DB and in isolation.
 */
vi.mock("./db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "./db";
import { verifyCredentials } from "./verify-credentials";

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

describe("verifyCredentials", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns null when email or password is missing", async () => {
    expect(await verifyCredentials(undefined, "pw")).toBeNull();
    expect(await verifyCredentials("a@example.com", undefined)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null when no user exists for the email", async () => {
    findUnique.mockResolvedValue(null);
    expect(await verifyCredentials("nobody@example.com", "pw")).toBeNull();
  });

  it("returns null when the user has no password set yet", async () => {
    findUnique.mockResolvedValue({ id: "1", email: "a@example.com", name: null, passwordHash: null });
    expect(await verifyCredentials("a@example.com", "pw")).toBeNull();
  });

  it("returns null on a wrong password", async () => {
    findUnique.mockResolvedValue({
      id: "1",
      email: "a@example.com",
      name: null,
      passwordHash: await hashPassword("correct-password"),
    });
    expect(await verifyCredentials("a@example.com", "wrong-password")).toBeNull();
  });

  it("returns the user's id/email/name on a correct password", async () => {
    findUnique.mockResolvedValue({
      id: "1",
      email: "a@example.com",
      name: "Alice",
      passwordHash: await hashPassword("correct-password"),
    });
    expect(await verifyCredentials("a@example.com", "correct-password")).toEqual({
      id: "1",
      email: "a@example.com",
      name: "Alice",
    });
  });

  it("normalizes email by trimming and lowercasing before lookup", async () => {
    findUnique.mockResolvedValue(null);
    await verifyCredentials("  Alice@Example.com  ", "pw");
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "alice@example.com" } });
  });
});
