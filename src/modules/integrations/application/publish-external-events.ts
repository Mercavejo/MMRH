import { db } from "@/lib/db/client";
import { publishDomainEvent } from "@/lib/events/publisher";
import {
  buildExternalEvent,
  classifyExternalEventDeliveryFailure,
  computeExternalEventDeliveryFingerprint,
  type ExternalEventState,
} from "../domain/external-events";
import {
  getExternalEventDeliveryByFingerprintFromDb,
  upsertExternalEventDeliveryStateInDb,
} from "../infrastructure/external-event-deliveries-repository";
import { listAuthorizedExternalEventConsumersFromDb } from "../infrastructure/external-event-consumers-repository";

type DbLike = typeof db;

const DELIVERY_STALE_THRESHOLD_MS = 2 * 60 * 1000;
const POST_PUBLISH_PERSISTENCE_FAILURE_PREFIX = "POST_PUBLISH_PERSISTENCE_FAILED:";

export type PublishExternalEventsResult = {
  event_name: string;
  event_version: string;
  tenant_id: string;
  correlation_id: string;
  source_reference: string;
  consumer_count: number;
  delivered_count: number;
  failed_count: number;
  attempt_count: number;
  idempotency_key: string;
  fingerprint: string;
  failure_code: string | null;
  recommended_action: string | null;
  last_error: string | null;
  status: "pending" | "delivering" | "delivered" | "failed";
};

function buildFailureResult(input: {
  eventName: string;
  tenantId: string;
  correlationId: string;
  sourceReference: string;
  fingerprint: string;
  idempotencyKey: string;
  failureCode: string;
  recommendedAction: string;
  lastError: string | null;
  attemptCount: number;
}): PublishExternalEventsResult {
  return {
    event_name: input.eventName,
    event_version: "v1",
    tenant_id: input.tenantId,
    correlation_id: input.correlationId,
    source_reference: input.sourceReference,
    consumer_count: 0,
    delivered_count: 0,
    failed_count: 1,
    attempt_count: input.attemptCount,
    idempotency_key: input.idempotencyKey,
    fingerprint: input.fingerprint,
    failure_code: input.failureCode,
    recommended_action: input.recommendedAction,
    last_error: input.lastError,
    status: "failed",
  };
}

function isStaleDelivery(lastAttemptAt: string | null): boolean {
  if (!lastAttemptAt) {
    return true;
  }

  const parsed = Date.parse(lastAttemptAt);
  if (Number.isNaN(parsed)) {
    return true;
  }

  return Date.now() - parsed > DELIVERY_STALE_THRESHOLD_MS;
}

async function publishToConsumer(input: {
  tenantId: string;
  correlationId: string;
  sourceReference: string;
  eventState: ExternalEventState;
  actorId: string;
  actorRole: string;
  consumerKey: string;
  payload: Record<string, unknown>;
}, dbClient: DbLike): Promise<PublishExternalEventsResult> {
  const event = buildExternalEvent({
    state: input.eventState,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    sourceReference: input.sourceReference,
    payload: input.payload,
  });

  const fingerprint = computeExternalEventDeliveryFingerprint({
    tenantId: input.tenantId,
    eventName: event.event_name,
    eventVersion: event.event_version,
    sourceReference: input.sourceReference,
    consumerKey: input.consumerKey,
  });

  const idempotencyKey = fingerprint;
  const previousDelivery = await getExternalEventDeliveryByFingerprintFromDb(
    {
      tenantId: input.tenantId,
      consumerKey: input.consumerKey,
      fingerprint,
    },
    dbClient,
  );

  if (previousDelivery?.status === "delivered") {
    return {
      event_name: event.event_name,
      event_version: event.event_version,
      tenant_id: input.tenantId,
      correlation_id: input.correlationId,
      source_reference: input.sourceReference,
      consumer_count: 1,
      delivered_count: 1,
      failed_count: 0,
      attempt_count: previousDelivery.attempt_count,
      idempotency_key: previousDelivery.idempotency_key,
      fingerprint: previousDelivery.fingerprint,
      failure_code: null,
      recommended_action: null,
      last_error: previousDelivery.last_error,
      status: previousDelivery.status,
    };
  }

  if (previousDelivery?.status === "delivering") {
    if (previousDelivery.last_error?.startsWith(POST_PUBLISH_PERSISTENCE_FAILURE_PREFIX)) {
      try {
        const reconciled = await upsertExternalEventDeliveryStateInDb(
          {
            tenantId: input.tenantId,
            consumerKey: input.consumerKey,
            eventName: event.event_name,
            eventVersion: event.event_version,
            sourceReference: input.sourceReference,
            fingerprint,
            idempotencyKey,
            status: "delivered",
            attemptCount: previousDelivery.attempt_count,
            correlationId: input.correlationId,
            payloadSummary: previousDelivery.payload_summary,
            lastAttemptAt: new Date().toISOString(),
            lastError: null,
            failureCode: null,
            recommendedAction: null,
            deliveredAt: new Date().toISOString(),
          },
          dbClient,
        );

        return {
          event_name: event.event_name,
          event_version: event.event_version,
          tenant_id: input.tenantId,
          correlation_id: input.correlationId,
          source_reference: input.sourceReference,
          consumer_count: 1,
          delivered_count: 1,
          failed_count: 0,
          attempt_count: reconciled.attempt_count,
          idempotency_key: reconciled.idempotency_key,
          fingerprint: reconciled.fingerprint,
          failure_code: null,
          recommended_action: null,
          last_error: null,
          status: "delivered",
        };
      } catch {
        return {
          event_name: event.event_name,
          event_version: event.event_version,
          tenant_id: input.tenantId,
          correlation_id: input.correlationId,
          source_reference: input.sourceReference,
          consumer_count: 1,
          delivered_count: 0,
          failed_count: 0,
          attempt_count: previousDelivery.attempt_count,
          idempotency_key: previousDelivery.idempotency_key,
          fingerprint: previousDelivery.fingerprint,
          failure_code: null,
          recommended_action: null,
          last_error: previousDelivery.last_error,
          status: previousDelivery.status,
        };
      }
    }

    if (isStaleDelivery(previousDelivery.last_attempt_at)) {
      // stale delivering records are retried to avoid permanent lock state
    } else {
      return {
        event_name: event.event_name,
        event_version: event.event_version,
        tenant_id: input.tenantId,
        correlation_id: input.correlationId,
        source_reference: input.sourceReference,
        consumer_count: 1,
        delivered_count: 0,
        failed_count: 0,
        attempt_count: previousDelivery.attempt_count,
        idempotency_key: previousDelivery.idempotency_key,
        fingerprint: previousDelivery.fingerprint,
        failure_code: null,
        recommended_action: null,
        last_error: previousDelivery.last_error,
        status: previousDelivery.status,
      };
    }

  }

  const startingAttempt = previousDelivery?.attempt_count ?? 0;

  for (let attemptCount = startingAttempt + 1; attemptCount <= 3; attemptCount += 1) {
    await upsertExternalEventDeliveryStateInDb(
      {
        tenantId: input.tenantId,
        consumerKey: input.consumerKey,
        eventName: event.event_name,
        eventVersion: event.event_version,
        sourceReference: input.sourceReference,
        fingerprint,
        idempotencyKey,
        status: "delivering",
        attemptCount,
        correlationId: input.correlationId,
        payloadSummary: event.payload,
        lastAttemptAt: new Date().toISOString(),
      },
      dbClient,
    );

    try {
      await publishDomainEvent(event);
    } catch (error) {
      const lastError = error instanceof Error ? error.message : "Falha na publicacao de evento externo.";
      const failure =
        attemptCount >= 3
          ? classifyExternalEventDeliveryFailure("RETRY_EXHAUSTED")
          : classifyExternalEventDeliveryFailure("TRANSPORT_FAILURE");

      await upsertExternalEventDeliveryStateInDb(
        {
          tenantId: input.tenantId,
          consumerKey: input.consumerKey,
          eventName: event.event_name,
          eventVersion: event.event_version,
          sourceReference: input.sourceReference,
          fingerprint,
          idempotencyKey,
          status: attemptCount >= 3 ? "failed" : "pending",
          attemptCount,
          correlationId: input.correlationId,
          payloadSummary: event.payload,
          lastAttemptAt: new Date().toISOString(),
          lastError,
          failureCode: failure.failure_code,
          recommendedAction: failure.recommended_action,
          deliveredAt: null,
        },
        dbClient,
      );

      if (attemptCount >= 3) {
        return {
          event_name: event.event_name,
          event_version: event.event_version,
          tenant_id: input.tenantId,
          correlation_id: input.correlationId,
          source_reference: input.sourceReference,
          consumer_count: 1,
          delivered_count: 0,
          failed_count: 1,
          attempt_count: attemptCount,
          idempotency_key: idempotencyKey,
          fingerprint,
          failure_code: failure.failure_code,
          recommended_action: failure.recommended_action,
          last_error: lastError,
          status: "failed",
        };
      }

      continue;
    }

    try {
      await upsertExternalEventDeliveryStateInDb(
        {
          tenantId: input.tenantId,
          consumerKey: input.consumerKey,
          eventName: event.event_name,
          eventVersion: event.event_version,
          sourceReference: input.sourceReference,
          fingerprint,
          idempotencyKey,
          status: "delivered",
          attemptCount,
          correlationId: input.correlationId,
          payloadSummary: event.payload,
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
          failureCode: null,
          recommendedAction: null,
          deliveredAt: new Date().toISOString(),
        },
        dbClient,
      );

      return {
        event_name: event.event_name,
        event_version: event.event_version,
        tenant_id: input.tenantId,
        correlation_id: input.correlationId,
        source_reference: input.sourceReference,
        consumer_count: 1,
        delivered_count: 1,
        failed_count: 0,
        attempt_count: attemptCount,
        idempotency_key: idempotencyKey,
        fingerprint,
        failure_code: null,
        recommended_action: null,
        last_error: null,
        status: "delivered",
      };
    } catch (error) {
      const postPublishPersistenceError =
        error instanceof Error ? error.message : "Falha ao registrar estado entregue apos publicacao.";

      await upsertExternalEventDeliveryStateInDb(
        {
          tenantId: input.tenantId,
          consumerKey: input.consumerKey,
          eventName: event.event_name,
          eventVersion: event.event_version,
          sourceReference: input.sourceReference,
          fingerprint,
          idempotencyKey,
          status: "delivering",
          attemptCount,
          correlationId: input.correlationId,
          payloadSummary: event.payload,
          lastAttemptAt: new Date().toISOString(),
          lastError: `${POST_PUBLISH_PERSISTENCE_FAILURE_PREFIX} ${postPublishPersistenceError}`,
          failureCode: null,
          recommendedAction: null,
          deliveredAt: null,
        },
        dbClient,
      );

      return {
        event_name: event.event_name,
        event_version: event.event_version,
        tenant_id: input.tenantId,
        correlation_id: input.correlationId,
        source_reference: input.sourceReference,
        consumer_count: 1,
        delivered_count: 0,
        failed_count: 0,
        attempt_count: attemptCount,
        idempotency_key: idempotencyKey,
        fingerprint,
        failure_code: null,
        recommended_action: null,
        last_error: `${POST_PUBLISH_PERSISTENCE_FAILURE_PREFIX} ${postPublishPersistenceError}`,
        status: "delivering",
      };
    }
  }

  const fallbackFailure = classifyExternalEventDeliveryFailure("RETRY_EXHAUSTED");
  return {
    event_name: event.event_name,
    event_version: event.event_version,
    tenant_id: input.tenantId,
    correlation_id: input.correlationId,
    source_reference: input.sourceReference,
    consumer_count: 1,
    delivered_count: 0,
    failed_count: 1,
    attempt_count: 3,
    idempotency_key: idempotencyKey,
    fingerprint,
    failure_code: fallbackFailure.failure_code,
    recommended_action: fallbackFailure.recommended_action,
    last_error: "Falha na publicacao de evento externo.",
    status: "failed",
  };
}

export async function publishExternalEvents(input: {
  tenantId: string;
  correlationId: string;
  sourceReference: string;
  eventState: ExternalEventState;
  actorId: string;
  actorRole: string;
  payload: Record<string, unknown>;
}, dbClient: DbLike = db): Promise<PublishExternalEventsResult> {
  const event = buildExternalEvent({
    state: input.eventState,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    sourceReference: input.sourceReference,
    payload: input.payload,
  });

  const consumers = await listAuthorizedExternalEventConsumersFromDb(
    {
      tenantId: input.tenantId,
      eventName: event.event_name,
      eventVersion: event.event_version,
    },
    dbClient,
  );

  if (consumers.length === 0) {
    const fingerprint = computeExternalEventDeliveryFingerprint({
      tenantId: input.tenantId,
      eventName: event.event_name,
      eventVersion: event.event_version,
      sourceReference: input.sourceReference,
      consumerKey: "__allowlist__",
    });

    const failure = classifyExternalEventDeliveryFailure("FORBIDDEN_CONSUMER");
    await upsertExternalEventDeliveryStateInDb(
      {
        tenantId: input.tenantId,
        consumerKey: "__allowlist__",
        eventName: event.event_name,
        eventVersion: event.event_version,
        sourceReference: input.sourceReference,
        fingerprint,
        idempotencyKey: fingerprint,
        status: "failed",
        attemptCount: 1,
        correlationId: input.correlationId,
        payloadSummary: event.payload,
        lastAttemptAt: new Date().toISOString(),
        lastError: "Nenhum consumidor autorizado encontrado para este evento.",
        failureCode: failure.failure_code,
        recommendedAction: failure.recommended_action,
        deliveredAt: null,
      },
      dbClient,
    );

    return buildFailureResult({
      eventName: event.event_name,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sourceReference: input.sourceReference,
      fingerprint,
      idempotencyKey: fingerprint,
      failureCode: failure.failure_code,
      recommendedAction: failure.recommended_action,
      lastError: "Nenhum consumidor autorizado encontrado para este evento.",
      attemptCount: 1,
    });
  }

  const results = [] as PublishExternalEventsResult[];

  for (const consumer of consumers) {
    const result = await publishToConsumer(
      {
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        sourceReference: input.sourceReference,
        eventState: input.eventState,
        actorId: input.actorId,
        actorRole: input.actorRole,
        consumerKey: consumer.consumer_key,
        payload: event.payload,
      },
      dbClient,
    );

    results.push(result);
  }

  const deliveredCount = results.filter((result) => result.status === "delivered").length;
  const failedResults = results.filter((result) => result.status === "failed");
  const firstFailed = failedResults[0] ?? null;

  return {
    event_name: event.event_name,
    event_version: event.event_version,
    tenant_id: input.tenantId,
    correlation_id: input.correlationId,
    source_reference: input.sourceReference,
    consumer_count: consumers.length,
    delivered_count: deliveredCount,
    failed_count: failedResults.length,
    attempt_count: Math.max(...results.map((result) => result.attempt_count), 0),
    idempotency_key: results[0]?.idempotency_key ?? computeExternalEventDeliveryFingerprint({
      tenantId: input.tenantId,
      eventName: event.event_name,
      eventVersion: event.event_version,
      sourceReference: input.sourceReference,
      consumerKey: consumers[0]?.consumer_key ?? "__allowlist__",
    }),
    fingerprint: results[0]?.fingerprint ?? computeExternalEventDeliveryFingerprint({
      tenantId: input.tenantId,
      eventName: event.event_name,
      eventVersion: event.event_version,
      sourceReference: input.sourceReference,
      consumerKey: consumers[0]?.consumer_key ?? "__allowlist__",
    }),
    failure_code: firstFailed?.failure_code ?? null,
    recommended_action: firstFailed?.recommended_action ?? null,
    last_error: firstFailed?.last_error ?? null,
    status: failedResults.length > 0 ? "failed" : "delivered",
  };
}