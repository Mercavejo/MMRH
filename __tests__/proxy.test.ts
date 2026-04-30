import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("allows unauthenticated first-access activation endpoint", () => {
    const request = new NextRequest("http://localhost/api/v1/employee/activation", {
      method: "POST",
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
  });
});
