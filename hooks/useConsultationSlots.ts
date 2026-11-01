"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listConsultationSlots } from "@/services/consultations/consultationService";
import type { AppointmentSlot } from "@/features/consultations/slots";

export function useConsultationSlots(consultantId: string, serviceId: string, date: string, excludeBookingId?: string) {
  const key = JSON.stringify([consultantId, serviceId, date, excludeBookingId]);
  const enabled = Boolean(consultantId && serviceId && /^\d{4}-\d{2}-\d{2}$/.test(date));
  const refreshRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<{key: string; slots: AppointmentSlot[]; loading: boolean; error: string | null}>({key:"", slots:[], loading:false, error:null});
  const reload = useCallback(() => refreshRef.current?.(), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true, controller: AbortController | null = null;
    let inFlight = false, hasResult = false, lastStarted = -Infinity;
    const refresh = async (force = false) => {
      if (document.visibilityState === "hidden" || inFlight || (!force && Date.now() - lastStarted < 1_500)) return;
      inFlight = true;
      lastStarted = Date.now();
      controller = new AbortController();
      const signal = controller.signal;
      // Only the first read blocks controls. Background reads retain the last
      // verified list and selection; the booking transaction remains authoritative.
      if (!hasResult) setState({key, slots:[], loading:true, error:null});
      try {
        const result = await listConsultationSlots(consultantId, serviceId, date, excludeBookingId, signal);
        if (active && !signal.aborted) {
          hasResult = true;
          setState({key,slots:result.slots,loading:false,error:null});
        }
      } catch (error) {
        if (active && !signal.aborted) setState(previous => ({key, slots:previous.key === key ? previous.slots : [],loading:false,error:error instanceof Error ? error.message : "Appointment times could not be checked."}));
      } finally { inFlight = false; }
    };
    refreshRef.current = () => { void refresh(true); };
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(() => void refresh(), 45_000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { active=false; refreshRef.current=null; controller?.abort(); window.clearInterval(timer); window.removeEventListener("focus",visible); document.removeEventListener("visibilitychange",visible); };
  }, [key, enabled, consultantId, serviceId, date, excludeBookingId]);
  return { slots: enabled && state.key === key ? state.slots : [], loading: enabled && (state.key !== key || state.loading), error: enabled && state.key === key ? state.error : null, reload };
}
