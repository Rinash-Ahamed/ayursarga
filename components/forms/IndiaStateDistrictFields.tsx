"use client";

import { useId, useState } from "react";
import { INDIA_STATES_AND_UNION_TERRITORIES } from "@/constants/indiaStates";
import { INDIA_DISTRICTS_BY_STATE, isDistrictInIndiaState } from "@/constants/indiaDistricts";

const DISTRICT_OPTIONS = INDIA_STATES_AND_UNION_TERRITORIES.flatMap((state) =>
  INDIA_DISTRICTS_BY_STATE[state].map((district) => ({
    district,
    state,
    label: `${district}, ${state}`,
  })),
);

export function IndiaStateDistrictFields({
  defaultState = "",
  defaultDistrict = "",
  stateError,
  districtError,
}: {
  defaultState?: string;
  defaultDistrict?: string;
  stateError?: string;
  districtError?: string;
}) {
  const districtListId = useId();
  const [state, setState] = useState(defaultState);
  const [district, setDistrict] = useState(defaultDistrict);
  const [districtSearch, setDistrictSearch] = useState(defaultDistrict);
  const hasLegacyDistrict = Boolean(state && district && !isDistrictInIndiaState(state, district));

  function selectDistrict(value: string) {
    setDistrictSearch(value);
    const normalizedValue = value.trim().toLocaleLowerCase("en-IN");
    const labelMatch = DISTRICT_OPTIONS.find((option) => option.label.toLocaleLowerCase("en-IN") === normalizedValue);
    const districtMatches = DISTRICT_OPTIONS.filter((option) => option.district.toLocaleLowerCase("en-IN") === normalizedValue);
    const match = labelMatch ?? (districtMatches.length === 1 ? districtMatches[0] : null);

    if (match) {
      setDistrict(match.district);
      setState(match.state);
      setDistrictSearch(match.district);
      return;
    }

    setDistrict("");
    setState("");
  }

  return <>
    <label>District *
      <input
        type="search"
        list={districtListId}
        value={districtSearch}
        required
        autoComplete="off"
        placeholder="Search district or state"
        aria-invalid={Boolean(districtError)}
        onChange={(event) => selectDistrict(event.target.value)}
      />
      <datalist id={districtListId}>
        {hasLegacyDistrict && <option value={`${district}, ${state}`} />}
        {DISTRICT_OPTIONS.map((option) => <option value={option.label} key={option.label} />)}
      </datalist>
      <input type="hidden" name="district" value={district} />
      {districtError && <span className="portal-field-error" role="alert">{districtError}</span>}
    </label>
    <label>State *
      <input
        name="state"
        value={state}
        required
        readOnly
        placeholder="Selected automatically from district"
        aria-invalid={Boolean(stateError)}
      />
      {stateError && <span className="portal-field-error" role="alert">{stateError}</span>}
    </label>
  </>;
}
