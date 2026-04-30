import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getSessionExpiration } from "@/lib/auth/cookies";

export type ActiveSession = {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
};

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(48).toString("hex");
}

type SessionWriter = Pick<typeof db, "insert">;

export async function createSession(params: {
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}, dbClient: SessionWriter = db): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiration();

  await dbClient.insert(sessions).values({
    userId: params.userId,
    tenantId: params.tenantId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    isValid: true,
  });

  return { token, expiresAt };
}

export async function validateSession(
  token: string,
): Promise<ActiveSession | null> {
  const tokenHash = hashSessionToken(token);
  const rows = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      tenantId: sessions.tenantId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.isValid, true)))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  if (found.expiresAt.getTime() <= Date.now()) {
    await invalidateSession(token);
    return null;
  }

  return found;
}

export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);

  await db
    .update(sessions)
    .set({ isValid: false, rotatedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.isValid, true)));
}

export async function rotateSession(params: {
  token: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; expiresAt: Date; session: ActiveSession } | null> {
  const currentSession = await validateSession(params.token);
  if (!currentSession) return null;

  await invalidateSession(params.token);

  const next = await createSession({
    userId: currentSession.userId,
    tenantId: currentSession.tenantId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return {
    token: next.token,
    expiresAt: next.expiresAt,
    session: currentSession,
  };
}
