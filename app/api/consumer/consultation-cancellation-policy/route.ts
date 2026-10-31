import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson } from "@/services/api/server";
import { readConsultationCancellationPolicy } from "@/services/consultations/cancellationPolicyAdmin";
import { allowRequest } from "@/services/api/rateLimit";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(`consultation-policy:${uid}`, 120, 600000)) return apiJson({ error: "Please wait before loading cancellation terms again." }, 429);
    return apiJson({ policy: await readConsultationCancellationPolicy(firestore) });
  }
  catch (error) { return apiJson({ error: error instanceof AdminAuthorizationError ? error.message : "Cancellation terms are temporarily unavailable." }, error instanceof AdminAuthorizationError ? error.status : 503); }
}
