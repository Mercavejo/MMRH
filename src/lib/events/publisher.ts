export type DomainEvent = {
  event_name: string;
  event_version: string;
  occurred_at: string;
  correlation_id: string;
  tenant_id: string;
  actor: {
    actor_id: string;
    actor_role: string;
  };
  payload: Record<string, unknown>;
};

export function buildDomainEvent(input: DomainEvent): DomainEvent {
  return input;
}

export async function publishDomainEvent(event: DomainEvent): Promise<DomainEvent> {
  return event;
}