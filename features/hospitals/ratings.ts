import type { HospitalDocument } from "@/features/firestore/models";

export type RatingFilter = "all" | "4_plus" | "3_plus" | "unrated";

export function getHospitalRating(hospital: Pick<HospitalDocument, "ratingAverage" | "ratingCount">) {
  const count = Math.max(0, Number(hospital.ratingCount) || 0);
  const average = count > 0 ? Math.min(5, Math.max(1, Number(hospital.ratingAverage) || 0)) : 0;
  const category = count === 0
    ? "New on Ayursarga"
    : average >= 4.5
      ? "Exceptional care"
      : average >= 4
        ? "Highly rated"
        : average >= 3
          ? "Well rated"
          : "Consumer rated";
  return { average, count, category };
}

export function matchesRatingFilter(
  hospital: Pick<HospitalDocument, "ratingAverage" | "ratingCount">,
  filter: RatingFilter,
) {
  const { average, count } = getHospitalRating(hospital);
  if (filter === "unrated") return count === 0;
  if (filter === "4_plus") return count > 0 && average >= 4;
  if (filter === "3_plus") return count > 0 && average >= 3;
  return true;
}
