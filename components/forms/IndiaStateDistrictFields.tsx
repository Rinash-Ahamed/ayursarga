"use client";

import { useMemo, useState } from "react";
import { INDIA_STATES_AND_UNION_TERRITORIES } from "@/constants/indiaStates";
import { districtsForIndiaState } from "@/constants/indiaDistricts";

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
  const [state, setState] = useState(defaultState);
  const [district, setDistrict] = useState(defaultDistrict);
  const districts = useMemo(() => districtsForIndiaState(state), [state]);
  const hasLegacyDistrict = Boolean(district && !districts.includes(district as never));

  return <>
    <label>State *
      <select
        name="state"
        value={state}
        required
        aria-invalid={Boolean(stateError)}
        onChange={(event) => {
          setState(event.target.value);
          setDistrict("");
        }}
      >
        <option value="" disabled>Select state or union territory</option>
        {INDIA_STATES_AND_UNION_TERRITORIES.map((item) => <option value={item} key={item}>{item}</option>)}
      </select>
      {stateError && <span className="portal-field-error" role="alert">{stateError}</span>}
    </label>
    <label>District *
      <select
        name="district"
        value={district}
        required
        disabled={!state}
        aria-invalid={Boolean(districtError)}
        onChange={(event) => setDistrict(event.target.value)}
      >
        <option value="" disabled>{state ? "Select district" : "Select a state first"}</option>
        {hasLegacyDistrict && <option value={district}>{district}</option>}
        {districts.map((item) => <option value={item} key={item}>{item}</option>)}
      </select>
      {districtError && <span className="portal-field-error" role="alert">{districtError}</span>}
    </label>
  </>;
}
