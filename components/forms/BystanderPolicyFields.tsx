"use client";

import { useState } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import { MAX_ADDITIONAL_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";

export function BystanderPolicyFields({ hospital }: { hospital: HospitalDocument }) {
  const policy = resolveHospitalBystanderPolicy(hospital);
  const [allowsAdditional, setAllowsAdditional] = useState(policy.additionalBystandersAllowed);

  return <fieldset className="portal-bystander-policy full">
    <legend>Bystander policy</legend>
    <p>One bystander is included at no additional cost.</p>
    <label className="portal-consent-choice">
      <input
        name="additionalBystandersAllowed"
        type="checkbox"
        defaultChecked={policy.additionalBystandersAllowed}
        onChange={(event) => setAllowsAdditional(event.target.checked)}
      />
      <span>Allow paid additional bystanders</span>
    </label>
    {allowsAdditional && <div className="portal-bystander-policy-fields">
      <label>Maximum additional bystanders *
        <select name="maxAdditionalBystanders" defaultValue={policy.maxAdditionalBystanders || 1} required>
          {Array.from({ length: MAX_ADDITIONAL_BYSTANDERS }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}
        </select>
      </label>
      <label>Charge per additional bystander *
        <input name="additionalBystanderCharge" type="number" min="0.01" max="1000000" step="0.01" defaultValue={policy.additionalBystanderCharge || ""} required />
      </label>
    </div>}
  </fieldset>;
}
