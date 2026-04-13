import type { AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function StatusTimeline({ items }: { items: AuditTimelineEntry[] }) {
  return (
    <section aria-label="Linha do tempo">
      <h2>Linha do tempo</h2>
      {items.length === 0 ? (
        <p>Nenhum evento cronologico para os filtros atuais.</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.event_id}>
              <strong>{item.action}</strong>
              <div>Status: {item.status}</div>
              <div>Ocorrido em: {formatDateTime(item.occurred_at)}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
