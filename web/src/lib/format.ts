import type { Timestamp } from "firebase/firestore";

const faNumber = new Intl.NumberFormat("fa-IR");

/** Stored amounts are Rial; we display Toman everywhere. */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10);
}

export function formatToman(rial: number): string {
  return `${faNumber.format(rialToToman(rial))} تومان`;
}

/** Parse a user-typed Toman amount (accepts Persian/Arabic digits and separators) into Rial. */
export function tomanInputToRial(input: string): number | null {
  const digits = normalizeDigits(input).replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits) * 10;
}

export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const timeFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long" });
const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });

export function tsToDate(ts: Timestamp | null | undefined): Date {
  return ts ? ts.toDate() : new Date();
}

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

export function formatDay(d: Date): string {
  const today = startOfDay(new Date());
  const diffDays = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "امروز";
  if (diffDays === -1) return "دیروز";
  return dayFmt.format(d);
}

export function formatRelative(d: Date): string {
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateTimeInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
