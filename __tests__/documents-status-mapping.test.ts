import { describe, expect, it } from "vitest";
import {
  DOCUMENT_STATUS_VALUES,
  getDocumentStatusPresentation,
} from "@/lib/documents/status-mapping";

describe("documents status mapping", () => {
  it("maps all functional statuses to readable labels", () => {
    const labels = DOCUMENT_STATUS_VALUES.map(
      (status) => getDocumentStatusPresentation(status).label,
    );

    expect(labels).toEqual([
      "Publicado",
      "Pendente",
      "Em processamento",
      "Indisponivel",
      "Erro",
    ]);
  });

  it("returns semantic metadata to avoid color-only communication", () => {
    const published = getDocumentStatusPresentation("published");

    expect(published.icon).toBe("check_circle");
    expect(published.a11yText).toContain("Publicado");
  });
});