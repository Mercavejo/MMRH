import { describe, expect, it } from "vitest";
import { minimizeDataForRole } from "@/lib/compliance/minimization";

describe("compliance minimization", () => {
  it("removes non-essential fields for strict profile", () => {
    const payload = {
      employee_name: "Maria",
      employee_email: "maria.souza@acme.com.br",
      cpf: "12345678901",
      salary: 9500,
      tenant_id: "tenant-1",
    };

    const result = minimizeDataForRole(payload, {
      minimizationProfile: "strict",
      role: "colaborador",
    });

    expect(result).toEqual({
      employee_name: "Maria",
      employee_email: "m***@acme.com.br",
      tenant_id: "tenant-1",
    });
  });

  it("keeps additional business fields for standard profile", () => {
    const payload = {
      employee_name: "Carlos",
      employee_email: "carlos@acme.com.br",
      period: "2026-03",
      document_status: "published",
      salary: 10000,
    };

    const result = minimizeDataForRole(payload, {
      minimizationProfile: "standard",
      role: "rh_operator",
    });

    expect(result.period).toBe("2026-03");
    expect(result.document_status).toBe("published");
    expect(result).not.toHaveProperty("salary");
  });

  it("removes sensitive key variations", () => {
    const payload = {
      employee_name: "Ana",
      salary_amount: 7000,
      cpf_hash: "abc123",
      access_token: "secret",
      tenant_id: "tenant-1",
    };

    const result = minimizeDataForRole(payload, {
      minimizationProfile: "standard",
      role: "rh_operator",
    });

    expect(result).not.toHaveProperty("salary_amount");
    expect(result).not.toHaveProperty("cpf_hash");
    expect(result).not.toHaveProperty("access_token");
    expect(result.tenant_id).toBe("tenant-1");
  });

  it("does not bypass strict profile for platform admin", () => {
    const payload = {
      employee_name: "Luiza",
      period: "2026-04",
      payroll_total: 12345,
      tenant_id: "tenant-1",
    };

    const result = minimizeDataForRole(payload, {
      minimizationProfile: "strict",
      role: "admin_plataforma",
    });

    expect(result.period).toBe("2026-04");
    expect(result.tenant_id).toBe("tenant-1");
    expect(result).not.toHaveProperty("payroll_total");
  });
});
