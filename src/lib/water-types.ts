export const WATER_TYPES = ["Offshore / bluewater", "Inshore", "Nearshore & reef", "Flats", "Freshwater"];

// Legacy labels saved before the water types were renamed.
const LEGACY_WATER_TYPES: Record<string, string[]> = {
  offshore: ["Offshore / bluewater"],
  nearshore: ["Nearshore & reef"],
  "nearshore/offshore": ["Nearshore & reef", "Offshore / bluewater"],
};

export const splitWaterTypes = (value: string | null | undefined): string[] => {
  const out: string[] = [];
  for (const raw of (value ?? "").split(",")) {
    const v = raw.trim();
    if (!v) continue;
    const mapped = LEGACY_WATER_TYPES[v.toLowerCase()] ?? [v];
    for (const m of mapped) if (!out.includes(m)) out.push(m);
  }
  return out;
};

export const joinWaterTypes = (types: string[]): string => types.join(", ");

/** Normalized display string (legacy labels converted). */
export const formatWaterTypes = (value: string | null | undefined): string =>
  joinWaterTypes(splitWaterTypes(value));
