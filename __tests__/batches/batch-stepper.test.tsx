import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BatchStepper } from "@/components/batches/batch-stepper";
import { buildPendingBatchRoutingProgress } from "@/lib/rh/batches/batch-progress";

describe("BatchStepper", () => {
  const completedSummary = {
    batch_id: "test-batch",
    tenant_id: "tenant-1",
    total_documents: 10,
    matched_documents: 10,
    pending_documents: 0,
    failed_documents: 0,
    ambiguous_documents: 0,
    blocked_documents: 0,
    processed_at: "2026-04-22T12:00:00.000Z",
    blocked_reason: null,
    routing_status: "completed" as const,
    publication_status: "pending" as const,
  };

  it("keeps every step pending when there is no validated batch", () => {
    const html = renderToStaticMarkup(<BatchStepper summary={null} />);

    expect(html).toContain('data-step-state="pending">Validacao');
    expect(html).toContain('data-step-state="pending">Roteamento');
    expect(html).not.toContain('data-step-state="active">Roteamento');
  });

  it("renders validation step as active when batch is pending", () => {
    const summary = buildPendingBatchRoutingProgress({
      batchId: "test-batch",
      tenantId: "tenant-1",
      totalDocuments: 10
    });
    const html = renderToStaticMarkup(<BatchStepper summary={summary} />);

    expect(html).toContain("Validacao");
    expect(html).toContain("Roteamento");
    expect(html).toContain("Publicacao");
  });

  it("renders publication step as active when routing is completed but not published", () => {
    const html = renderToStaticMarkup(<BatchStepper summary={completedSummary} />);

    expect(html).toContain('data-step-state="active">Publicacao');
  });

  it("keeps blocked routing on the routing step with error state", () => {
    const html = renderToStaticMarkup(
      <BatchStepper
        summary={{
          ...completedSummary,
          routing_status: "blocked",
          publication_status: "pending",
          matched_documents: 7,
          ambiguous_documents: 3,
          blocked_documents: 3,
          blocked_reason: "ambiguity",
        }}
      />
    );

    expect(html).toContain('data-step-state="error">Roteamento');
    expect(html).not.toContain('data-step-state="active">Publicacao');
  });

  it("keeps failed routing on the routing step with error state", () => {
    const html = renderToStaticMarkup(
      <BatchStepper
        summary={{
          ...completedSummary,
          routing_status: "failed",
          publication_status: "pending",
          matched_documents: 0,
          failed_documents: 10,
        }}
      />
    );

    expect(html).toContain('data-step-state="error">Roteamento');
  });

  it("keeps processing routing on the routing step as active", () => {
    const html = renderToStaticMarkup(
      <BatchStepper
        summary={{
          ...completedSummary,
          routing_status: "processing",
          publication_status: "pending",
          matched_documents: 5,
          pending_documents: 5,
        }}
      />
    );

    expect(html).toContain('data-step-state="active">Roteamento');
  });

  it("shows publication failure on publication step", () => {
    const html = renderToStaticMarkup(
      <BatchStepper
        summary={{
          ...completedSummary,
          publication_status: "failed",
        }}
      />
    );

    expect(html).toContain('data-step-state="error">Publicacao');
  });

  it("renders all steps as completed when published", () => {
    const html = renderToStaticMarkup(
      <BatchStepper
        summary={{
          ...completedSummary,
          publication_status: "published",
          published_at: "2026-04-22T12:01:00.000Z",
        }}
      />
    );

    expect(html).toContain("Publicacao");
  });
});
