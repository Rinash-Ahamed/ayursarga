type ConsultantListRecord = { id: string; employeeId?: string; employeeSequence?: number; status?: string };

/** Numeric IDs keep AS1000 after AS999, including locally saved records. */
export function orderConsultants<T extends ConsultantListRecord>(items: readonly T[]): T[] {
  const sequence = (item: T) => typeof item.employeeSequence === "number" && Number.isFinite(item.employeeSequence)
    ? item.employeeSequence : Number(/^AS(\d+)$/i.exec(item.employeeId ?? item.id)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return [...items].sort((left, right) => Number(left.status === "inactive") - Number(right.status === "inactive")
    || sequence(left) - sequence(right) || left.id.localeCompare(right.id, undefined, { numeric: true }));
}
