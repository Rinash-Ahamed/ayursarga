/** Stable partition: preserve the existing order within both groups. */
export function inactiveLast<T>(items: readonly T[]): T[] {
  const inactive = (item: T) => item !== null && typeof item === "object" && "status" in item && item.status === "inactive";
  return [...items.filter(item => !inactive(item)), ...items.filter(inactive)];
}
