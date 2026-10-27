import type { ServiceDocument } from "@/features/firestore/models";

export type PackageDraft = Pick<ServiceDocument, "name" | "description" | "price" | "packageDurationDays" | "procedures" | "otherProcedures" | "otherProcedureName" | "otherProcedureDays">;

/** Missing review metadata identifies existing, previously published packages. */
export function hasPublishedPackage(service: { reviewStatus?: unknown; publishedAt?: unknown }) {
  return service.reviewStatus === undefined || service.publishedAt != null;
}

export function workingPackage<T extends ServiceDocument>(service: T): T {
  return service.draftPackage ? { ...service, ...service.draftPackage } : service;
}

export function packageReviewLabel(service: { reviewStatus?: ServiceDocument["reviewStatus"] }) {
  return ({ draft: "Draft", pending: "Pending review", approved: "Approved", changes_requested: "Changes requested" } as const)[service.reviewStatus ?? "approved"];
}
