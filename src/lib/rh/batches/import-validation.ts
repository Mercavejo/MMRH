import { z } from "zod";

export const BATCH_DOCUMENT_TYPES = ["holerite", "cartao_ponto"] as const;

export const batchImportMetadataSchema = z.object({
  originalFilename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
});

export const batchImportRowSchema = z.object({
  employee_identifier: z.string().trim().min(1),
  document_type: z.enum(BATCH_DOCUMENT_TYPES),
  period_ref: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export type BatchImportDocumentType = (typeof BATCH_DOCUMENT_TYPES)[number];

export type BatchImportRow = z.infer<typeof batchImportRowSchema>;

export type BatchImportIssueSeverity = "critical" | "warning";

export type BatchImportIssue = {
  code: string;
  message: string;
  severity: BatchImportIssueSeverity;
  row?: number;
  column?: string;
};

export type BatchImportValidationSummary = {
  source_format: "csv" | "json";
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  critical_issue_count: number;
  warning_issue_count: number;
  issues: BatchImportIssue[];
};

export type BatchImportValidationResult = {
  is_valid: boolean;
  validation_status: "validated" | "blocked";
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  rows: BatchImportRow[];
  summary: BatchImportValidationSummary;
};

const MAX_BATCH_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isJsonSource(mimeType: string, originalFilename: string): boolean {
  return (
    mimeType === "application/json" || originalFilename.toLowerCase().endsWith(".json")
  );
}

function isCsvSource(mimeType: string, originalFilename: string): boolean {
  return (
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    originalFilename.toLowerCase().endsWith(".csv")
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(text: string): Array<Record<string, string>> {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length === 0) {
    return [];
  }

  const headers = parseCsvLine(rows[0]).map((header) => header.trim().toLowerCase());
  const bodyRows = rows.slice(1);

  return bodyRows.map((row) => {
    const values = parseCsvLine(row);
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});
  });
}

function normalizeJsonRows(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function buildBlockedSummary(params: {
  sourceFormat: "csv" | "json";
  issues: BatchImportIssue[];
  validRows: number;
  totalRows: number;
}): BatchImportValidationSummary {
  const criticalIssueCount = params.issues.filter((issue) => issue.severity === "critical").length;
  const warningIssueCount = params.issues.filter((issue) => issue.severity === "warning").length;

  return {
    source_format: params.sourceFormat,
    total_rows: params.totalRows,
    valid_rows: params.validRows,
    invalid_rows: Math.max(params.totalRows - params.validRows, 0),
    critical_issue_count: criticalIssueCount,
    warning_issue_count: warningIssueCount,
    issues: params.issues,
  };
}

export async function validateBatchImportFile(file: File): Promise<BatchImportValidationResult> {
  const metadataParsed = batchImportMetadataSchema.safeParse({
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
  });

  if (!metadataParsed.success) {
    return {
      is_valid: false,
      validation_status: "blocked",
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      rows: [],
      summary: buildBlockedSummary({
        sourceFormat: "csv",
        issues: [
          {
            code: "invalid_metadata",
            message: "Metadados do arquivo de lote invalidos.",
            severity: "critical",
          },
        ],
        totalRows: 0,
        validRows: 0,
      }),
    };
  }

  const originalFilename = metadataParsed.data.originalFilename;
  const mimeType = metadataParsed.data.mimeType;
  const fileSizeBytes = metadataParsed.data.fileSizeBytes;

  if (fileSizeBytes > MAX_BATCH_IMPORT_FILE_SIZE_BYTES) {
    return {
      is_valid: false,
      validation_status: "blocked",
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      rows: [],
      summary: buildBlockedSummary({
        sourceFormat: "csv",
        issues: [
          {
            code: "file_too_large",
            message: "O arquivo de lote excede o tamanho maximo permitido.",
            severity: "critical",
          },
        ],
        totalRows: 0,
        validRows: 0,
      }),
    };
  }

  const text = await file.text();
  const sourceFormat = isJsonSource(mimeType, originalFilename)
    ? "json"
    : isCsvSource(mimeType, originalFilename)
      ? "csv"
      : null;

  if (!sourceFormat) {
    return {
      is_valid: false,
      validation_status: "blocked",
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      rows: [],
      summary: buildBlockedSummary({
        sourceFormat: "csv",
        issues: [
          {
            code: "unsupported_format",
            message: "Formato de arquivo nao suportado. Use CSV ou JSON.",
            severity: "critical",
          },
        ],
        totalRows: 0,
        validRows: 0,
      }),
    };
  }

  const issues: BatchImportIssue[] = [];
  const rows: BatchImportRow[] = [];
  let sourceTotalRows = 0;

  if (!text.trim()) {
    issues.push({
      code: "empty_file",
      message: "O arquivo de lote esta vazio.",
      severity: "critical",
    });

    return {
      is_valid: false,
      validation_status: "blocked",
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      rows,
      summary: buildBlockedSummary({
        sourceFormat,
        issues,
        totalRows: 0,
        validRows: 0,
      }),
    };
  }

  if (sourceFormat === "json") {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(text) as unknown;
    } catch {
      return {
        is_valid: false,
        validation_status: "blocked",
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        rows,
        summary: buildBlockedSummary({
          sourceFormat,
          issues: [
            {
              code: "invalid_json",
              message: "O JSON do relatorio geral nao pode ser lido.",
              severity: "critical",
            },
          ],
          totalRows: 0,
          validRows: 0,
        }),
      };
    }

    const jsonRows = normalizeJsonRows(parsedJson);
    sourceTotalRows = jsonRows.length;

    if (jsonRows.length === 0) {
      issues.push({
        code: "missing_rows",
        message: "O JSON nao contem uma lista de registros valida.",
        severity: "critical",
      });
    }

    jsonRows.forEach((row, index) => {
      const parsed = batchImportRowSchema.safeParse(row);
      if (!parsed.success) {
        issues.push({
          code: "invalid_row",
          message: "Linha invalida no relatorio importado.",
          severity: "critical",
          row: index + 1,
        });
        return;
      }

      rows.push(parsed.data);
    });
  } else {
    const csvRows = parseCsvRows(text);
    sourceTotalRows = csvRows.length;
    const headerRow = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)[0];

    const requiredHeaders = ["employee_identifier", "document_type", "period_ref"];
    const parsedHeaders = headerRow ? parseCsvLine(headerRow).map((header) => header.trim().toLowerCase()) : [];

    for (const requiredHeader of requiredHeaders) {
      if (!parsedHeaders.includes(requiredHeader)) {
        issues.push({
          code: "missing_column",
          message: `Coluna obrigatoria ausente: ${requiredHeader}.`,
          severity: "critical",
          column: requiredHeader,
        });
      }
    }

    if (csvRows.length === 0) {
      issues.push({
        code: "missing_rows",
        message: "O CSV nao contem linhas de dados para processamento.",
        severity: "critical",
      });
    }

    csvRows.forEach((row, index) => {
      const parsed = batchImportRowSchema.safeParse(row);
      if (!parsed.success) {
        issues.push({
          code: "invalid_row",
          message: "Linha invalida no relatorio importado.",
          severity: "critical",
          row: index + 1,
        });
        return;
      }

      rows.push(parsed.data);
    });
  }

  const duplicateKeys = new Set<string>();
  let duplicateRowCount = 0;

  rows.forEach((row, index) => {
    const duplicateKey = [row.employee_identifier, row.document_type, row.period_ref].join("|");
    if (duplicateKeys.has(duplicateKey)) {
      issues.push({
        code: "duplicate_row",
        message: "O relatorio contem linhas duplicadas para o mesmo colaborador, tipo e periodo.",
        severity: "critical",
        row: index + 1,
      });
      duplicateRowCount += 1;
      return;
    }

    duplicateKeys.add(duplicateKey);
  });

  const totalRows = rows.length;
  const validRows = Math.max(totalRows - duplicateRowCount, 0);
  const invalidRows = Math.max(sourceTotalRows - validRows, 0);
  const criticalIssueCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningIssueCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    is_valid: criticalIssueCount === 0,
    validation_status: criticalIssueCount === 0 ? "validated" : "blocked",
    original_filename: originalFilename,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
    rows,
    summary: {
      source_format: sourceFormat,
      total_rows: sourceTotalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      critical_issue_count: criticalIssueCount,
      warning_issue_count: warningIssueCount,
      issues,
    },
  };
}
