export const SESSION_COOKIE_NAME = "session_id";

const SESSION_INACTIVITY_MINUTES = 30;

export function getSessionExpiration(baseDate = new Date()): Date {
  return new Date(baseDate.getTime() + SESSION_INACTIVITY_MINUTES * 60 * 1000);
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
