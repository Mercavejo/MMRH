import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

function isProtectedPath(pathname: string): boolean {
  if (
    pathname.startsWith("/api/v1/auth") ||
    pathname === "/api/v1/health" ||
    pathname === "/api/v1/employee/activation"
  ) {
    return false;
  }

  if (pathname.startsWith("/api/v1")) {
    return true;
  }

  return pathname.startsWith("/employee") || pathname.startsWith("/rh");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const hasSessionCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    if (pathname.startsWith("/api/v1")) {
      return NextResponse.json(
        errorResponse("UNAUTHORIZED", "Sessao obrigatoria.", correlationId),
        { status: 401 },
      );
    }

    const redirectUrl = new URL("/", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: "/:path*",
};
