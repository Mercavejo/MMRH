export const Capability = {
  BATCH_INGESTION: "BATCH_INGESTION",
  EXTERNAL_INTEGRATIONS: "EXTERNAL_INTEGRATIONS",
  PDF_MULTIPAGE_PROCESSING: "PDF_MULTIPAGE_PROCESSING",
  ADVANCED_AUDIT: "ADVANCED_AUDIT",
  PORTAL_EMPLOYEE_ACCESS: "PORTAL_EMPLOYEE_ACCESS",
  COMMERCIAL_GOVERNANCE: "COMMERCIAL_GOVERNANCE",
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];

export type CapabilityCheckResult = {
  allowed: boolean;
  planCode: string;
  capability: Capability;
  upgradeRequired?: boolean;
};

export type PlanCode = "base" | "professional" | "enterprise";

export const PLAN_CAPABILITIES: Readonly<Record<PlanCode, ReadonlySet<Capability>>> = Object.freeze({
  base: Object.freeze(new Set<Capability>([Capability.PORTAL_EMPLOYEE_ACCESS])),
  professional: Object.freeze(new Set<Capability>([
    Capability.PORTAL_EMPLOYEE_ACCESS,
    Capability.BATCH_INGESTION,
    Capability.PDF_MULTIPAGE_PROCESSING,
  ])),
  enterprise: Object.freeze(new Set<Capability>([
    Capability.PORTAL_EMPLOYEE_ACCESS,
    Capability.BATCH_INGESTION,
    Capability.PDF_MULTIPAGE_PROCESSING,
    Capability.EXTERNAL_INTEGRATIONS,
    Capability.ADVANCED_AUDIT,
    Capability.COMMERCIAL_GOVERNANCE,
  ])),
});

export class CapabilityForbiddenError extends Error {
  public readonly capability: Capability;
  public readonly planCode: string;
  public readonly upgradeHint?: string;

  constructor(params: {
    capability: Capability;
    planCode: string;
    upgradeHint?: string;
  }) {
    super(
      `Capability ${params.capability} not available on plan ${params.planCode}.`,
    );
    this.name = "CapabilityForbiddenError";
    this.capability = params.capability;
    this.planCode = params.planCode;
    this.upgradeHint = params.upgradeHint;
  }
}
