type FacilityIconKind =
  | "wifi" | "parking" | "room" | "laundry" | "power" | "person" | "cleaning" | "language"
  | "doctor" | "wardrobe" | "air" | "window" | "dining" | "sofa" | "baby" | "water-heater"
  | "dryer" | "toiletries" | "slippers" | "kitchen" | "kettle" | "stove" | "water" | "fridge"
  | "camera" | "guard" | "alarm" | "fire" | "tv" | "lift" | "garden" | "play" | "balcony";

function iconKind(facility: string): FacilityIconKind {
  const value = facility.toLocaleLowerCase();
  if (value.includes("wi-fi")) return "wifi";
  if (value.includes("parking")) return "parking";
  if (value.includes("laundry")) return "laundry";
  if (value.includes("power")) return "power";
  if (value.includes("caretaker")) return "person";
  if (value.includes("housekeeping")) return "cleaning";
  if (value.includes("multilingual")) return "language";
  if (value.includes("doctor")) return "doctor";
  if (value.includes("wardrobe")) return "wardrobe";
  if (value.includes("air conditioning")) return "air";
  if (value.includes("window")) return "window";
  if (value.includes("dining")) return "dining";
  if (value.includes("sofa")) return "sofa";
  if (value.includes("baby") || value.includes("cot")) return "baby";
  if (value.includes("geyser")) return "water-heater";
  if (value.includes("hair dryer")) return "dryer";
  if (value.includes("toiletries")) return "toiletries";
  if (value.includes("slippers")) return "slippers";
  if (value.includes("utensils")) return "kitchen";
  if (value.includes("kettle")) return "kettle";
  if (value.includes("stove")) return "stove";
  if (value.includes("drinking water")) return "water";
  if (value.includes("refrigerator")) return "fridge";
  if (value.includes("cctv")) return "camera";
  if (value.includes("guard")) return "guard";
  if (value.includes("alarm")) return "alarm";
  if (value.includes("extinguisher")) return "fire";
  if (value === "tv") return "tv";
  if (value.includes("lift")) return "lift";
  if (value.includes("garden")) return "garden";
  if (value.includes("play")) return "play";
  if (value.includes("balcony")) return "balcony";
  return "room";
}

export function FacilityIcon({ facility }: { facility: string }) {
  const kind = iconKind(facility);
  return <span className="portal-facility-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === "wifi" && <><path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0" /><circle cx="12" cy="20" r=".8" fill="currentColor" stroke="none" /></>}
    {kind === "parking" && <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 17V7h4a3 3 0 0 1 0 6H9" /></>}
    {kind === "room" && <><path d="M3 20V8l9-5 9 5v12M8 20v-7h8v7M2 20h20" /></>}
    {kind === "laundry" && <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="5" /><path d="M7 7h.01M10 7h4" /></>}
    {kind === "power" && <><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z" /></>}
    {kind === "person" && <><circle cx="12" cy="7" r="3" /><path d="M5 21a7 7 0 0 1 14 0M17.5 9.5l1.2 1.2 2.3-2.5" /></>}
    {kind === "cleaning" && <><path d="m7 4 7 7M11 8l5-5M13 10l-8 8M5 18l-2 3h9l3-6" /></>}
    {kind === "language" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>}
    {kind === "doctor" && <><path d="M8 4v5a4 4 0 0 0 8 0V4M6 4h4M14 4h4M12 13v2a5 5 0 0 0 5 5" /><circle cx="19" cy="19" r="2" /></>}
    {kind === "wardrobe" && <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M12 3v18M9 12h.01M15 12h.01" /></>}
    {kind === "air" && <><path d="M3 7h11c3 0 3-4 0-4M3 12h16c3 0 3-4 0-4M3 17h10c3 0 3 4 0 4" /></>}
    {kind === "window" && <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M12 4v16M4 12h16" /></>}
    {kind === "dining" && <><path d="M4 4v7a2 2 0 0 0 2 2h2V4M6 4v17M17 4v17M14 4c0 5 1 7 3 7h3" /></>}
    {kind === "sofa" && <><path d="M5 12V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M3 11a2 2 0 0 1 2 2v4h14v-4a2 2 0 0 1 2-2v8H3v-8ZM6 19v2M18 19v2" /></>}
    {kind === "baby" && <><path d="M4 7h16v11H4zM4 12h16M7 18v3M17 18v3" /><path d="M8 7a4 4 0 0 1 8 0" /></>}
    {kind === "water-heater" && <><rect x="6" y="3" width="12" height="15" rx="3" /><path d="M9 7h6M10 21h4M12 18v3" /><circle cx="12" cy="12" r="2" /></>}
    {kind === "dryer" && <><path d="M5 6h9a4 4 0 0 1 0 8H9l-2 7H4l2-8a4 4 0 0 1-1-7ZM14 8v4M18 7l3-2M18 13l3 2" /></>}
    {kind === "toiletries" && <><path d="M8 7h8v14H8zM10 3h4v4M15 10h3v7h-2" /></>}
    {kind === "slippers" && <><path d="M9 4c2 5 2 12-1 16-2 2-5 0-5-3 0-5 2-10 6-13ZM15 4c-2 5-2 12 1 16 2 2 5 0 5-3 0-5-2-10-6-13Z" /></>}
    {kind === "kitchen" && <><path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M16 3v18M16 3c4 3 4 8 0 10" /></>}
    {kind === "kettle" && <><path d="M6 9h11l-1 11H7L6 9ZM8 9V6a4 4 0 0 1 8 0v3M17 11h2a2 2 0 0 1 0 4h-2" /></>}
    {kind === "stove" && <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M7 4h10l1 4M8 13h.01M12 13h.01M16 13h.01M8 17h8" /></>}
    {kind === "water" && <><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" /><path d="M9 15a3 3 0 0 0 3 2" /></>}
    {kind === "fridge" && <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M6 10h12M9 6v2M9 13v3" /></>}
    {kind === "camera" && <><path d="M4 8h11v9H4zM15 11l5-3v9l-5-3" /><circle cx="9.5" cy="12.5" r="2" /></>}
    {kind === "guard" && <><path d="M12 3 19 6v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>}
    {kind === "alarm" && <><path d="M6 16h12l-2-3V9a4 4 0 0 0-8 0v4l-2 3ZM10 19h4M4 5 2 7M20 5l2 2" /></>}
    {kind === "fire" && <><path d="M13 2c1 5-4 6-2 10 1-2 3-3 4-5 3 3 4 6 3 9a6 6 0 0 1-12 0c0-4 3-7 7-14Z" /></>}
    {kind === "tv" && <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="m9 21 3-3 3 3M9 2l3 3 3-3" /></>}
    {kind === "lift" && <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3" /></>}
    {kind === "garden" && <><path d="M12 21V9M12 13C7 13 4 10 4 5c5 0 8 3 8 8ZM12 16c5 0 8-3 8-8-5 0-8 3-8 8Z" /></>}
    {kind === "play" && <><path d="M4 20h16M7 20v-6h10v6M9 14V8h6v6M12 8V4" /><circle cx="12" cy="3" r="1" /></>}
    {kind === "balcony" && <><path d="M5 21V4h14v17M8 4v8h8V4M3 12h18M4 16h16M7 12v9M12 12v9M17 12v9" /></>}
  </svg></span>;
}
