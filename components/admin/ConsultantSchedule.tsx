"use client";
import { useState } from "react";
import { DateInput } from "@/components/forms/DateInput";
import { useConsultationSlots } from "@/hooks/useConsultationSlots";
import { formatAppointmentRange } from "@/features/consultations/slots";
import { consultationService } from "@/features/consultations/catalog";
import { toDateInputValue } from "@/utils/date";

export function ConsultantSchedule({consultantId,services,onClose}:{consultantId:string;services:string[];onClose:()=>void}) {
  const [date,setDate]=useState(toDateInputValue());
  const [service,setService]=useState(services[0] ?? "");
  const result=useConsultationSlots(consultantId,service,date);
  return <section className="portal-card portal-flow-page" aria-label="Consultant appointment schedule">
    <div className="portal-row-heading"><h2>Appointment schedule · {consultantId}</h2><button className="portal-button secondary" type="button" onClick={onClose}>Close schedule</button></div>
    <div className="portal-form"><label>Date<DateInput value={date} min={toDateInputValue()} onChange={event=>setDate(event.target.value)} /></label><label>Service<select value={service} onChange={event=>setService(event.target.value)}><option value="">Choose a service</option>{services.map(id=><option key={id} value={id}>{consultationService(id)?.label ?? id}</option>)}</select></label></div>
    <p className="portal-form-note">Times are in India Standard Time. Payment holds expire after 10 minutes. This view refreshes while it is open.</p>
    <button className="portal-button secondary" type="button" onClick={result.reload} disabled={result.loading}>Refresh times</button>
    {result.error && <p className="portal-form-error" role="alert">{result.error}</p>}
    {result.loading && <p role="status">Checking appointment times…</p>}
    {!result.loading && !result.error && !result.slots.length && <p>No appointment times are configured for this date and service.</p>}
    <ul className="consultant-schedule-slots">{result.slots.map(slot=><li key={slot.startTime}><strong>{formatAppointmentRange(slot.startTime,slot.endTime)}</strong><span className="portal-status" data-status={slot.status === "available" ? "active" : "pending"}>{slot.status === "reserved" ? "Temporarily reserved" : slot.status === "booked" ? "Booked" : "Available"}</span></li>)}</ul>
  </section>;
}
