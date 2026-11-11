export type HospitalPackageSummary = { total: number; pending: number; approved: number; draft: number; changesRequested: number };

/** Network-bound work: at most two bounded requests, not one request per card. */
export async function loadHospitalPackageSummaryBatches(
  ids: string[],
  request: (ids: string[], signal: AbortSignal) => Promise<{ summaries: Record<string, HospitalPackageSummary> }>,
  onBatch: (summaries: Record<string, HospitalPackageSummary>) => void,
  signal: AbortSignal,
): Promise<string[]> {
  let offset = 0;
  const failed: string[] = [];
  const worker = async () => {
    while (!signal.aborted && offset < ids.length) {
      const batch = ids.slice(offset, offset + 20);
      offset += 20;
      try {
        const { summaries } = await request(batch, signal);
        if (signal.aborted) return;
        if (batch.some(id => !Object.hasOwn(summaries, id))) throw new Error("Incomplete package summaries");
        onBatch(Object.fromEntries(batch.map(id => [id, summaries[id]])));
      } catch {
        if (signal.aborted) return;
        failed.push(...batch);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, Math.ceil(ids.length / 20)) }, worker));
  return failed;
}
