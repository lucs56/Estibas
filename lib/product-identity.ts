export type ClosureKind = "screw" | "cork" | null;

const bottleSizes = "187|200|250|330|350|375|500|700|750|1000|1500";

export function bottleSizeMl(...values: Array<string | null | undefined>): number | null {
  const text = values.filter(Boolean).join(" ").toUpperCase().replace(/,/g, ".");
  const explicit = text.match(new RegExp(`\\b(${bottleSizes})\\s*(?:ML|CC)\\b`));
  const packed = text.match(new RegExp(`\\b\\d+\\s*[X×]\\s*(${bottleSizes})\\b`));
  const liters = text.match(/\b(0\.187|0\.2|0\.25|0\.33|0\.35|0\.375|0\.5|0\.7|0\.75|1|1\.5)\s*L(?:ITROS?)?\b/);
  if (explicit) return Number(explicit[1]);
  if (packed) return Number(packed[1]);
  return liters ? Math.round(Number(liters[1]) * 1000) : null;
}

export function closureKind(...values: Array<string | null | undefined>): ClosureKind {
  const text = values.filter(Boolean).join(" ").toUpperCase();
  if (/\b(SCREW|SC|TAPA\s*ROSCA|ROSCA)\b/.test(text)) return "screw";
  if (/\b(TAP[ÓO]N|CORCHO)\b/.test(text)) return "cork";
  return null;
}

export function formatBottleSize(value: number | null): string {
  return value ? `${value.toLocaleString("es-AR")} cc` : "Formato no identificado";
}
