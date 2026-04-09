import { describe, expect, it } from "vitest";
import { validateBatchImportFile } from "@/lib/rh/batches/import-validation";

describe("rh batch import validation", () => {
  it("accepts a valid csv batch report", async () => {
    const file = new File(
      ["employee_identifier,document_type,period_ref\n123,holerite,2026-03\n456,cartao_ponto,2026-03"],
      "lote-rh.csv",
      { type: "text/csv" },
    );

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(true);
    expect(result.validation_status).toBe("validated");
    expect(result.summary.total_rows).toBe(2);
    expect(result.summary.critical_issue_count).toBe(0);
    expect(result.rows).toHaveLength(2);
  });

  it("blocks batch reports with missing required columns", async () => {
    const file = new File(
      ["employee_identifier,period_ref\n123,2026-03"],
      "lote-incompleto.csv",
      { type: "text/csv" },
    );

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.validation_status).toBe("blocked");
    expect(result.summary.critical_issue_count).toBeGreaterThan(0);
    expect(result.summary.issues[0].code).toBe("missing_column");
  });

  it("blocks csv batch reports with header only", async () => {
    const file = new File(
      ["employee_identifier,document_type,period_ref"],
      "lote-vazio.csv",
      { type: "text/csv" },
    );

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.validation_status).toBe("blocked");
    expect(result.summary.total_rows).toBe(0);
    expect(result.summary.issues.some((issue) => issue.code === "missing_rows")).toBe(true);
  });

  it("keeps summary counts aligned with source rows", async () => {
    const file = new File(
      [[
        "employee_identifier,document_type,period_ref",
        "123,holerite,2026-03",
        "456,holerite,03-2026",
      ].join("\n")],
      "lote-parcial.csv",
      { type: "text/csv" },
    );

    const result = await validateBatchImportFile(file);

    expect(result.summary.total_rows).toBe(2);
    expect(result.summary.valid_rows).toBe(1);
    expect(result.summary.invalid_rows).toBe(1);
  });

  it("blocks invalid json batch payloads", async () => {
    const file = new File(
      [JSON.stringify([{ employee_identifier: "123", document_type: "invalid", period_ref: "2026-03" }])],
      "lote-rh.json",
      { type: "application/json" },
    );

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.validation_status).toBe("blocked");
    expect(result.summary.critical_issue_count).toBeGreaterThan(0);
  });
});
