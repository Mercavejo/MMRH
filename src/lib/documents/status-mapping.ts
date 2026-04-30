export const DOCUMENT_STATUS_VALUES = [
  "published",
  "pending",
  "processing",
  "unavailable",
  "error",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUS_VALUES)[number];

type StatusPresentation = {
  label: string;
  icon: string;
  tone: "success" | "warning" | "info" | "neutral" | "error";
  a11yText: string;
};

const STATUS_PRESENTATION: Record<DocumentStatus, StatusPresentation> = {
  published: {
    label: "Publicado",
    icon: "check_circle",
    tone: "success",
    a11yText: "Publicado: documento disponivel para consulta.",
  },
  pending: {
    label: "Pendente",
    icon: "schedule",
    tone: "warning",
    a11yText: "Pendente: documento ainda nao foi liberado.",
  },
  processing: {
    label: "Em processamento",
    icon: "sync",
    tone: "info",
    a11yText: "Em processamento: documento em preparacao.",
  },
  unavailable: {
    label: "Indisponivel",
    icon: "block",
    tone: "neutral",
    a11yText: "Indisponivel: documento nao esta acessivel no momento.",
  },
  error: {
    label: "Erro",
    icon: "error",
    tone: "error",
    a11yText: "Erro: houve falha e e necessaria acao adicional.",
  },
};

export function getDocumentStatusPresentation(status: DocumentStatus) {
  return STATUS_PRESENTATION[status];
}
