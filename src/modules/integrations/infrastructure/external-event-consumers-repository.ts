import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { externalEventConsumers } from "@/lib/db/schema";

type DbLike = typeof db;

export type ExternalEventConsumerRecord = {
  tenant_id: string;
  consumer_key: string;
  event_name: string;
  event_version: string;
  is_active: boolean;
};

export async function listAuthorizedExternalEventConsumersFromDb(input: {
  tenantId: string;
  eventName: string;
  eventVersion: string;
}, dbClient: DbLike = db): Promise<ExternalEventConsumerRecord[]> {
  const rows = await dbClient
    .select({
      tenantId: externalEventConsumers.tenantId,
      consumerKey: externalEventConsumers.consumerKey,
      eventName: externalEventConsumers.eventName,
      eventVersion: externalEventConsumers.eventVersion,
      isActive: externalEventConsumers.isActive,
    })
    .from(externalEventConsumers)
    .where(
      and(
        eq(externalEventConsumers.tenantId, input.tenantId),
        eq(externalEventConsumers.eventName, input.eventName),
        eq(externalEventConsumers.eventVersion, input.eventVersion),
        eq(externalEventConsumers.isActive, true),
      ),
    );

  return rows.map((row) => ({
    tenant_id: row.tenantId,
    consumer_key: row.consumerKey,
    event_name: row.eventName,
    event_version: row.eventVersion,
    is_active: row.isActive,
  }));
}