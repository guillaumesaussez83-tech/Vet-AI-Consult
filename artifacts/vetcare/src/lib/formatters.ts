/**
 * Utilitaires de formatage centralisés — VétoAI
 * Toutes les fonctions utilisent la locale fr-FR et le fuseau Europe/Paris
 */

const LOCALE = "fr-FR";
const TIMEZONE = "Europe/Paris";

/** Formate une date en format long : "lundi 12 mai 2025" */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: TIMEZONE,
  });
}

/** Formate une date en format court : "12/05/2025" */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIMEZONE,
  });
}

/** Formate date+heure : "12/05/2025 à 14h30" */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE,
  }).replace(",", " à");
}

/** Formate un montant en euros : "1 234,56 €" */
export function formatMontant(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00 €";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0,00 €";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency", currency: "EUR",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

/** Formate un montant sans symbole : "1 234,56" */
export function formatMontantBrut(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0,00";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

/** Formate une date de manière relative : "il y a 3 jours" */
export function formatDateRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHrs = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHrs / 24);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHrs) < 24) return rtf.format(diffHrs, "hour");
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  return formatDateShort(d);
}

/** Formate une durée en minutes : "1h 30min" ou "45 min" */
export function formatDuree(minutes: number): string {
  if (minutes < 60) return minutes + " min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? h + "h " + m + "min" : h + "h";
}
