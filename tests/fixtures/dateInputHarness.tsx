import { createRoot } from "react-dom/client";
import { useState, type FormEvent } from "react";
import { DateInput } from "@/components/forms/DateInput";
function Harness() {
  const [date, setDate] = useState("2026-11-05");
  const [saved, setSaved] = useState("");
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaved(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))); }
  return <main className="portal-content"><form className="portal-card portal-form" onSubmit={save} noValidate>
    <label>Care date<DateInput name="careDate" value={date} onChange={(event) => setDate(event.target.value)} min="2020-01-01" max="2099-12-31" required /></label>
    <label>Signing date<DateInput name="signingDate" defaultValue="2026-05-11" /></label>
    <label>Expiry date<DateInput name="expiryDate" defaultValue="2029-11-05" /></label>
    <button type="button" onClick={(event) => {
      const input = event.currentTarget.form!.elements.namedItem("expiryDate") as HTMLInputElement;
      input.value = "2030-11-05";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }}>Update expiry</button>
    <button type="submit">Save dates</button><button type="reset">Reset dates</button>
    <output>{saved}</output>
  </form></main>;
}
createRoot(document.getElementById("fixture-root")!).render(<Harness />);
