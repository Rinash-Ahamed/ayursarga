import type { HospitalDocument } from "@/features/firestore/models";

export const INCLUDED_BYSTANDERS = 1;
export const MAX_ADDITIONAL_BYSTANDERS = 3;

export type HospitalBystanderPolicy = {
  additionalBystandersAllowed: boolean;
  maxAdditionalBystanders: number;
  additionalBystanderCharge: number;
};

export function resolveHospitalBystanderPolicy(
  hospital: Partial<Pick<HospitalDocument, keyof HospitalBystanderPolicy>>,
): HospitalBystanderPolicy {
  const maximum = Number(hospital.maxAdditionalBystanders);
  const charge = Number(hospital.additionalBystanderCharge);
  const allowed = hospital.additionalBystandersAllowed === true
    && Number.isInteger(maximum)
    && maximum >= 1
    && maximum <= MAX_ADDITIONAL_BYSTANDERS
    && Number.isFinite(charge)
    && charge > 0;

  if (!allowed) {
    return {
      additionalBystandersAllowed: false,
      maxAdditionalBystanders: 0,
      additionalBystanderCharge: 0,
    };
  }

  return {
    additionalBystandersAllowed: true,
    maxAdditionalBystanders: maximum,
    additionalBystanderCharge: charge,
  };
}

export function hospitalBystanderFormValues(form: FormData) {
  const additionalBystandersAllowed = form.get("additionalBystandersAllowed") === "on";
  if (!additionalBystandersAllowed) {
    return {
      data: resolveHospitalBystanderPolicy({ additionalBystandersAllowed: false }),
      error: null,
    };
  }

  const maxAdditionalBystanders = Number(form.get("maxAdditionalBystanders"));
  const additionalBystanderCharge = Number(form.get("additionalBystanderCharge"));
  if (!Number.isInteger(maxAdditionalBystanders) || maxAdditionalBystanders < 1 || maxAdditionalBystanders > MAX_ADDITIONAL_BYSTANDERS) {
    return { data: null, error: "Choose how many additional bystanders the hospital can accommodate." };
  }
  if (!Number.isFinite(additionalBystanderCharge) || additionalBystanderCharge <= 0 || additionalBystanderCharge > 1_000_000) {
    return { data: null, error: "Enter a valid charge greater than zero for each additional bystander." };
  }

  return {
    data: { additionalBystandersAllowed, maxAdditionalBystanders, additionalBystanderCharge },
    error: null,
  };
}
