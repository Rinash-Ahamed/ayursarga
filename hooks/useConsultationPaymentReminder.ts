"use client";
import { useCallback, useSyncExternalStore } from "react";
import { CONSULTATION_PAYMENT_CHANGE_EVENT } from "@/features/payments/checkout";

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CONSULTATION_PAYMENT_CHANGE_EVENT, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(CONSULTATION_PAYMENT_CHANGE_EVENT, notify); };
}
export function useConsultationPaymentReminder(uid?: string) {
  const snapshot = useCallback(() => {
    try { return uid ? window.sessionStorage.getItem(`ayursarga-pending-consultation-payment:${uid}`) : null; }
    catch { return null; }
  }, [uid]);
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
