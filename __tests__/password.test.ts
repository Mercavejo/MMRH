import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes password and verifies correctly", async () => {
    const plain = "TempPassw0rd!";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    await expect(verifyPassword(plain, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-pass", hash)).resolves.toBe(false);
  });
});
