import { requireActiveUser, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { encodeMutation } from "@/services/api/mutation";
import { allowRequest } from "@/services/api/rateLimit";
import { withApiTiming } from "@/services/api/timing";
import { CONSUMER_BOOKING_FIELDS, projectConsumerBooking } from "@/features/bookings/consumerBooking";

export const runtime = "nodejs";
const validId = (id: string) => id.length > 0 && id.length <= 160 && !id.includes("/");
const readFields = [...CONSUMER_BOOKING_FIELDS, "consumerId", "archivedAt"];

async function handleGET(request: Request) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(`consumer-booking-history:${uid}`, 120, 600000)) return apiJson({ error: "Please wait before loading more bookings." }, 429);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const cursor = params.get("cursor");
    const size = Number(params.get("pageSize") ?? 20);
    if ((id !== null && !validId(id)) || (cursor !== null && !validId(cursor))
      || !Number.isInteger(size) || size < 1 || size > 20 || (id !== null && cursor !== null)) {
      return apiJson({ error: "Choose a valid booking or page." }, 400);
    }
    const collection = firestore.collection("bookings");
    if (id !== null) {
      const [snapshot] = await firestore.getAll(collection.doc(id), { fieldMask: readFields });
      const data = snapshot.data();
      // Missing and foreign records have the same response; no existence oracle.
      if (!data || data.consumerId !== uid || data.archivedAt != null) return apiJson({ error: "Booking not found." }, 404);
      return apiJson({ documents: encodeMutation([projectConsumerBooking(snapshot.id, data)]), cursor: null, hasMore: false });
    }
    let query = collection.where("consumerId", "==", uid).orderBy("createdAt", "desc").select(...readFields).limit(size + 1);
    if (cursor !== null) {
      const [anchor] = await firestore.getAll(collection.doc(cursor), { fieldMask: ["consumerId", "createdAt"] });
      if (!anchor.exists || anchor.data()?.consumerId !== uid || !anchor.data()?.createdAt) return apiJson({ error: "Refresh your bookings before loading more." }, 400);
      query = query.startAfter(anchor);
    }
    const result = await query.get();
    const page = result.docs.slice(0, size);
    const documents = page.filter(doc => doc.data().archivedAt == null && doc.data().status !== "archived")
      .map(doc => projectConsumerBooking(doc.id, doc.data()));
    return apiJson({ documents: encodeMutation(documents), cursor: page.at(-1)?.id ?? null, hasMore: result.docs.length > size });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("GET /api/consumer/booking-history", error);
    return apiJson({ error: "We could not load your bookings. Please try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/consumer/booking-history", handleGET);
