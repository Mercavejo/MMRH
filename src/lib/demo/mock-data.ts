/**
 * mock-data.ts
 *
 * Dados fictícios para demonstração no playtesting.
 * Usado em demonstrações controladas quando o gestor cliente acessa a visão de colaborador.
 * NUNCA importar fora de server-components de demonstração.
 */

import type { EmployeeDocumentListItem } from "@/lib/documents/list-documents";

// ---------- Documentos Mock ----------

export const MOCK_DOCUMENTS: EmployeeDocumentListItem[] = [
  {
    document_id: "demo-doc-001",
    tenant_id: "demo",
    user_id: "demo",
    document_type: "holerite",
    period_ref: "2026-03",
    status: "published",
    status_label: "Publicado",
    status_a11y_text: "Publicado: documento disponivel para consulta.",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    document_id: "demo-doc-002",
    tenant_id: "demo",
    user_id: "demo",
    document_type: "holerite",
    period_ref: "2026-02",
    status: "published",
    status_label: "Publicado",
    status_a11y_text: "Publicado: documento disponivel para consulta.",
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    document_id: "demo-doc-003",
    tenant_id: "demo",
    user_id: "demo",
    document_type: "cartao_ponto",
    period_ref: "2026-03",
    status: "published",
    status_label: "Publicado",
    status_a11y_text: "Publicado: documento disponivel para consulta.",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    document_id: "demo-doc-004",
    tenant_id: "demo",
    user_id: "demo",
    document_type: "holerite",
    period_ref: "2026-01",
    status: "pending",
    status_label: "Pendente",
    status_a11y_text: "Pendente: documento ainda nao foi liberado.",
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    document_id: "demo-doc-005",
    tenant_id: "demo",
    user_id: "demo",
    document_type: "cartao_ponto",
    period_ref: "2026-02",
    status: "published",
    status_label: "Publicado",
    status_a11y_text: "Publicado: documento disponivel para consulta.",
    created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ---------- Notificações Mock ----------

export interface MockNotificationItem {
  notification_id: string;
  tenant_id: string;
  user_id: string;
  channel: "in_app";
  event_type: string;
  context_type: "document" | "contestation";
  context_id: string;
  status_from: string;
  status_to: string;
  recommended_action: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export const MOCK_NOTIFICATIONS: MockNotificationItem[] = [
  {
    notification_id: "demo-notif-001",
    tenant_id: "demo",
    user_id: "demo",
    channel: "in_app",
    event_type: "document_published",
    context_type: "document",
    context_id: "demo-doc-001",
    status_from: "processing",
    status_to: "published",
    recommended_action: "Baixe seu holerite na aba Meus Documentos.",
    message: "Seu holerite de Março/2026 está disponível para download.",
    read_at: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    notification_id: "demo-notif-002",
    tenant_id: "demo",
    user_id: "demo",
    channel: "in_app",
    event_type: "document_published",
    context_type: "document",
    context_id: "demo-doc-003",
    status_from: "processing",
    status_to: "published",
    recommended_action: "Confira seu espelho de ponto na aba Meus Documentos.",
    message: "Cartão de ponto de Março/2026 validado com sucesso.",
    read_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    notification_id: "demo-notif-003",
    tenant_id: "demo",
    user_id: "demo",
    channel: "in_app",
    event_type: "document_published",
    context_type: "document",
    context_id: "demo-doc-002",
    status_from: "processing",
    status_to: "published",
    recommended_action: "Baixe seu holerite na aba Meus Documentos.",
    message: "Holerite de Fevereiro/2026 publicado. Confira os detalhes.",
    read_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
  {
    notification_id: "demo-notif-004",
    tenant_id: "demo",
    user_id: "demo",
    channel: "in_app",
    event_type: "contestation_resolved",
    context_type: "contestation",
    context_id: "demo-contest-001",
    status_from: "open",
    status_to: "resolved",
    recommended_action: "Verifique o documento atualizado.",
    message: "Sua contestação sobre o holerite de Janeiro foi resolvida.",
    read_at: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
