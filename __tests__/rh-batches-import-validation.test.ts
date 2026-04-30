import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateBatchImportFile } from "@/lib/rh/batches/import-validation";

const { getDocumentProxyMock, extractTextMock } = vi.hoisted(() => ({
  getDocumentProxyMock: vi.fn(),
  extractTextMock: vi.fn(),
}));

vi.mock("unpdf", () => ({
  getDocumentProxy: getDocumentProxyMock,
  extractText: extractTextMock,
}));

function mockParsedPdf(input: { text: string; numpages: number }) {
  const documentProxy = { id: "pdf-proxy" };
  getDocumentProxyMock.mockResolvedValue(documentProxy);
  extractTextMock.mockResolvedValue({
    totalPages: input.numpages,
    text: input.text.split("\f"),
  });
}

describe("rh batch import validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("accepts multipage pdf and itemizes each page as one routing row", async () => {
    mockParsedPdf({
      text: [
        "codigo_colaborador: EMP-001\nperiodo: 2026-03\nnome: Ana Souza",
        "codigo_colaborador: EMP-002\nperiodo: 2026-03\nnome: Bruno Lima",
      ].join("\f"),
      numpages: 2,
    });

    const file = new File(["%PDF-1.4 mock"], "relatorio-geral.pdf", {
      type: "application/pdf",
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(true);
    expect(result.summary.source_format).toBe("pdf");
    expect(result.summary.total_rows).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].page_index).toBe(1);
    expect(result.rows[1].page_index).toBe(2);
    expect(result.rows[0].codigo_colaborador).toBe("EMP-001");
    expect(result.rows[1].codigo_colaborador).toBe("EMP-002");
  });

  it("blocks password protected pdf with explicit rejection code", async () => {
    getDocumentProxyMock.mockRejectedValue(new Error("Encrypted PDF - password required"));

    const file = new File(["%PDF-1.4 encrypted"], "protegido.pdf", {
      type: "application/pdf",
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.validation_status).toBe("blocked");
    expect(result.summary.issues.some((issue) => issue.code === "PDF_PASSWORD_PROTECTED")).toBe(true);
  });

  it("blocks pdf over operational page limit", async () => {
    mockParsedPdf({
      text: "pagina",
      numpages: 501,
    });

    const file = new File(["%PDF-1.4"], "lote-gigante.pdf", {
      type: "application/pdf",
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.summary.issues.some((issue) => issue.code === "PDF_PAGE_LIMIT_EXCEEDED")).toBe(true);
  });

  it("blocks pdf pages without a valid period", async () => {
    mockParsedPdf({
      text: "codigo_colaborador: EMP-001\nnome: Ana Souza",
      numpages: 1,
    });

    const file = new File(["%PDF-1.4"], "sem-periodo.pdf", {
      type: "application/pdf",
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(false);
    expect(result.summary.issues.some((issue) => issue.code === "MISSING_PERIOD_REF")).toBe(true);
    expect(result.rows).toHaveLength(0);
  });

  it("extracts employee reference beside the collaborator name from the real payroll layout", async () => {
    mockParsedPdf({
      text: [
        "Recibo de Pagamento de Salário\t15.605.489/0001-00",
        "FRS MONTAGENS E MANUTENÇÃO INDUSTRIAL LTDA \tdezembro de 2023",
        "Avenida Doutora Maria Inês Dal'Antonia C, 387",
        "0212 MOISÉS IGNÁCIO GARCIA \t9113-05 LIDER MANUTENÇÃO INDUSTRIAL",
      ].join("\n"),
      numpages: 1,
    });

    const file = new File(["%PDF-1.4"], "holerite-real.pdf", {
      type: "application/pdf",
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].employee_identifier).toBe("0212");
    expect(result.rows[0].codigo_colaborador).toBe("0212");
    expect(result.rows[0].nome_normalizado).toBe("moises ignacio garcia");
    expect(result.rows[0].period_ref).toBe("2023-12");
    expect(result.rows[0].document_type).toBe("holerite");
  });

  it("does not depend on file.text() for pdf validation", async () => {
    mockParsedPdf({
      text: "codigo_colaborador: EMP-001\nperiodo: 2026-03\nnome: Ana Souza",
      numpages: 1,
    });

    const file = new File(["%PDF-1.4"], "relatorio-geral.pdf", {
      type: "application/pdf",
    });
    file.text = vi.fn(async () => {
      throw new Error("pdf text should not be read before binary parsing");
    });

    const result = await validateBatchImportFile(file);

    expect(result.is_valid).toBe(true);
    expect(file.text).not.toHaveBeenCalled();
  });
});
