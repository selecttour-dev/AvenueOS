// Manual formatting: toLocaleString gives different decimal separators on
// server vs browser ICU → hydration mismatch. Always "1,234.56" style.
export function gel(n: number | null | undefined, digits = 0): string {
  const v = n ?? 0;
  const maxDigits = Math.max(digits, 2);
  let s = Math.abs(v).toFixed(maxDigits);
  if (digits < maxDigits) {
    // trim trailing zeros beyond the required minimum
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    const dec = s.split(".")[1]?.length ?? 0;
    if (dec < digits) s = Number(s).toFixed(digits);
  }
  const [int, dec] = s.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = v < 0 ? "-" : "";
  return `${sign}${grouped}${dec ? "." + dec : ""} ₾`;
}

const MONTHS_KA = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

const WEEKDAYS_KA = ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"];

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + "T00:00:00") : iso;
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()]}, ${d.getFullYear()}`;
}

export function fmtDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + "T00:00:00") : iso;
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()].slice(0, 3)} · ${WEEKDAYS_KA[d.getDay()]}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const monthNameKa = (m: number) => MONTHS_KA[m];
