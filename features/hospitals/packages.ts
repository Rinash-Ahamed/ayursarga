export const PACKAGE_DURATIONS = [7, 10, 14, 21, 28, 35] as const;
export type PackageDurationDays = (typeof PACKAGE_DURATIONS)[number];

export const PACKAGE_PROCEDURE_GROUPS = [
  {
    title: "Massage and packs",
    options: [
      ["headMassage", "Head Massage"],
      ["hairPack", "Hair Pack"],
      ["faceMassage", "Face Massage"],
      ["facePack", "Face Pack"],
      ["fullBodyMassage", "Full Body Massage"],
      ["fullBodyPack", "Full Body Pack"],
    ],
  },
  {
    title: "Kizhi",
    options: [
      ["podiKizhi", "Podi Kizhi"],
      ["narangaKizhi", "Naranga Kizhi"],
      ["elaKizhi", "Ela Kizhi"],
      ["njavaraKizhi", "Njavara Kizhi"],
    ],
  },
  {
    title: "Special therapies",
    options: [
      ["njavaraTheppu", "Njavara Theppu"],
      ["njavaraFacial", "Njavara Facial"],
      ["vethuKuli", "Vethu Kuli (Medicated Steam Bath)"],
    ],
  },
  {
    title: "Shirodhara",
    options: [
      ["thakraDhara", "Thakra Dhara"],
      ["ksheeraDhara", "Ksheera Dhara"],
      ["tailaDhara", "Taila Dhara"],
    ],
  },
  {
    title: "Additional procedures",
    options: [
      ["anjanam", "Anjanam"],
      ["dhoomapanam", "Dhoomapanam"],
      ["keshaDhoopanam", "Kesha Dhoopanam"],
      ["yoniDhoopanam", "Yoni Dhoopanam"],
      ["abdominalBinding", "Abdominal Binding"],
    ],
  },
] as const;

export type PackageProcedureId = (typeof PACKAGE_PROCEDURE_GROUPS)[number]["options"][number][0];
export type PackageProcedures = Partial<Record<PackageProcedureId, number>>;

export const PACKAGE_PROCEDURES = PACKAGE_PROCEDURE_GROUPS.flatMap((group) => group.options) as readonly (readonly [PackageProcedureId, string])[];
export const PACKAGE_PROCEDURE_LABELS = new Map<string, string>(PACKAGE_PROCEDURES.map(([id, label]) => [id, label] as const));

export type PackageLike = {
  name?: string;
  packageDurationDays?: number;
  procedures?: Record<string, number>;
  otherProcedureName?: string | null;
  otherProcedureDays?: number | null;
};

export function isPackageDuration(value: unknown): value is PackageDurationDays {
  return typeof value === "number" && PACKAGE_DURATIONS.includes(value as PackageDurationDays);
}

export function packageTitle(service: PackageLike) {
  return isPackageDuration(service.packageDurationDays)
    ? `${service.packageDurationDays}-day package`
    : service.name || "Care package";
}

export function packageProcedureEntries(service: PackageLike): { id: string; label: string; days: number }[] {
  const procedures = service.procedures ?? {};
  const entries: { id: string; label: string; days: number }[] = PACKAGE_PROCEDURES.flatMap(([id, label]) => {
    const days = procedures[id];
    return Number.isInteger(days) && days > 0 ? [{ id, label, days }] : [];
  });
  if (service.otherProcedureName?.trim() && Number.isInteger(service.otherProcedureDays) && Number(service.otherProcedureDays) > 0) {
    entries.push({ id: "other", label: service.otherProcedureName.trim(), days: Number(service.otherProcedureDays) });
  }
  return entries;
}

export function readPackageForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const packageDurationDays = Number(data.get("packageDurationDays"));
  if (!isPackageDuration(packageDurationDays)) throw new Error("Choose a valid package duration.");

  const procedures: PackageProcedures = {};
  for (const [id] of PACKAGE_PROCEDURES) {
    if (data.get(`procedure_${id}`) !== "on") continue;
    const days = Number(data.get(`procedureDays_${id}`));
    if (!Number.isInteger(days) || days < 1 || days > packageDurationDays) {
      throw new Error(`Enter between 1 and ${packageDurationDays} days for ${PACKAGE_PROCEDURE_LABELS.get(id)}.`);
    }
    procedures[id] = days;
  }

  const includesOther = data.get("procedure_other") === "on";
  const otherProcedureName = includesOther ? String(data.get("otherProcedureName") ?? "").trim() : "";
  const otherProcedureDays = includesOther ? Number(data.get("otherProcedureDays")) : null;
  if (includesOther && (otherProcedureName.length < 2 || otherProcedureName.length > 100)) {
    throw new Error("Enter an Other procedure name between 2 and 100 characters.");
  }
  if (includesOther && PACKAGE_PROCEDURES.some(([, label]) => label.toLocaleLowerCase() === otherProcedureName.toLocaleLowerCase())) {
    throw new Error("This procedure is already available in the list. Select it there instead of adding it under Others.");
  }
  if (includesOther && (!Number.isInteger(otherProcedureDays) || Number(otherProcedureDays) < 1 || Number(otherProcedureDays) > packageDurationDays)) {
    throw new Error(`Enter between 1 and ${packageDurationDays} days for the Other procedure.`);
  }
  if (Object.keys(procedures).length === 0 && !includesOther) throw new Error("Select at least one procedure for this package.");

  return {
    name: `${packageDurationDays}-day package`,
    description: String(data.get("description") ?? "").trim().slice(0, 2_000),
    packageDurationDays,
    procedures,
    otherProcedureName: includesOther ? otherProcedureName : null,
    otherProcedureDays: includesOther ? Number(otherProcedureDays) : null,
  };
}
