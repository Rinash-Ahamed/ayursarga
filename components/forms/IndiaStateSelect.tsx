import type { SelectHTMLAttributes } from "react";
import { INDIA_STATES_AND_UNION_TERRITORIES, isIndiaStateOrUnionTerritory } from "@/constants/indiaStates";

export function IndiaStateSelect({ defaultValue, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const savedValue = typeof defaultValue === "string" ? defaultValue : "";
  const hasLegacyValue = Boolean(savedValue && !isIndiaStateOrUnionTerritory(savedValue));

  return <select defaultValue={savedValue} {...props}>
    <option value="" disabled>Select state or union territory</option>
    {hasLegacyValue && <option value={savedValue}>{savedValue}</option>}
    {INDIA_STATES_AND_UNION_TERRITORIES.map((state) => <option value={state} key={state}>{state}</option>)}
  </select>;
}

