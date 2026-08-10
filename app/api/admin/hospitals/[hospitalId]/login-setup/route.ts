import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";

export const runtime = "nodejs";

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, auth, firestore } = await requireActiveAdmin(request);

    const { hospitalId } = await context.params;
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || hospital?.status !== "active") {
      return response({ error: "Activate the hospital before preparing its login." }, 409);
    }

    const email = String(hospital.email ?? "").trim().toLowerCase();
    const name = String(hospital.name ?? "").trim();
    if (!email || !name) return response({ error: "The hospital name and official email are required." }, 409);

    let authUser;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      authUser = await auth.createUser({ email, displayName: name, emailVerified: false, disabled: false });
    }

    const userReference = firestore.collection("users").doc(authUser.uid);
    const userSnapshot = await userReference.get();
    const previous = userSnapshot.data() ?? null;
    if (previous && previous.role !== "hospital") {
      return response({ error: "This email already belongs to a different Ayursarga account." }, 409);
    }
    if (previous?.hospitalId && previous.hospitalId !== hospitalId && previous.status === "active") {
      const previousHospital = await firestore.collection("hospitals").doc(previous.hospitalId).get();
      if (previousHospital.exists && previousHospital.data()?.status !== "archived") {
        return response({ error: "This Hospital login is already connected to another active hospital." }, 409);
      }
    }

    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const userData = previous ? {
      name,
      email,
      role: "hospital",
      status: "active",
      hospitalId,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    } : {
      uid: authUser.uid,
      name,
      email,
      phone: null,
      address: null,
      role: "hospital",
      status: "active",
      hospitalId,
      createdAt: now,
      createdBy: adminUid,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };
    const action = previous ? (previous.status === "archived" ? "restore" : "update") : "create";
    const batch = firestore.batch();
    batch.set(userReference, userData, { merge: Boolean(previous) });
    batch.set(auditReference, {
      action,
      module: "users",
      recordId: authUser.uid,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: previous,
      updatedValues: userData,
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    await batch.commit();

    return response({ ok: true, email });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return response({ error: error.message }, error.status);
    console.error("Hospital login setup failed", error instanceof Error ? error.message : error);
    return response({ error: "Hospital login setup is unavailable. Check the server Firebase Admin configuration and try again." }, 503);
  }
}
