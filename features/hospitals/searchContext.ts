export type CentreSearchContext = {
  startDate: string;
  endDate: string;
  bystanders: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeCentreSearchContext(input: {
  startDate?: string | string[];
  endDate?: string | string[];
  bystanders?: string | string[];
}): CentreSearchContext {
  const rawStartDate = typeof input.startDate === "string" ? input.startDate : "";
  const rawEndDate = typeof input.endDate === "string" ? input.endDate : "";
  const parsedBystanders = typeof input.bystanders === "string" ? Number(input.bystanders) : 1;
  return {
    startDate: DATE_PATTERN.test(rawStartDate) ? rawStartDate : "",
    endDate: DATE_PATTERN.test(rawEndDate) ? rawEndDate : "",
    bystanders: Number.isInteger(parsedBystanders) && parsedBystanders >= 0 && parsedBystanders <= 4
      ? parsedBystanders
      : 1,
  };
}

export function addCentreSearchContext(params: URLSearchParams, context: CentreSearchContext) {
  if (context.startDate) params.set("startDate", context.startDate);
  if (context.endDate) params.set("endDate", context.endDate);
  return params;
}

export function formatBystanders(count: number) {
  if (count === 0) return "No bystander";
  return `${count} adult ${count === 1 ? "bystander" : "bystanders"}`;
}
