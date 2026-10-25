import { isIsoDate, toDateInputValue } from "@/utils/date";

/** India care dates remain ISO in storage; a window is not an invented exact time. */
export function validConsultationSchedule(date: string, start: string, end: string, time?: string, now = new Date()) {
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!isIsoDate(date) || date < toDateInputValue(now) || !validTime(start) || !validTime(end) || end <= start) return false;
  if (time !== undefined && (!validTime(time) || time < start || time >= end)) return false;
  return Date.parse(`${date}T${time ?? end}:00+05:30`) > now.getTime();
}
