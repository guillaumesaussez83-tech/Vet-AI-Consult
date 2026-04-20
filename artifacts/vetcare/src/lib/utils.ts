import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateFR(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T12:00:00") : date;
  if (isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(d);
}

export function formatDateHeureFR(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" });
  const heurePart = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${datePart} à ${heurePart}`;
}

export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date.includes("T") ? date : date + "T12:00:00") : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatMontant(value: number | null | undefined, suffix = " €"): string {
  if (value == null) return "—";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}${suffix}`;
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeCourt(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
