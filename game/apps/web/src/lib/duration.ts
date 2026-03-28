import type { Language } from "./i18n";

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const LONG_DURATION_DAY_THRESHOLD = 365;
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

export function formatFlightDuration(seconds: number, language: Language): string {
  const totalDays = seconds / SECONDS_PER_DAY;
  if (totalDays >= LONG_DURATION_DAY_THRESHOLD) {
    return formatLongDurationFromDays(Math.round(totalDays), language);
  }

  return language === "zh"
    ? `${formatNumber(totalDays)} 天`
    : `${formatNumber(totalDays)} days`;
}

export function formatRelativeDurationSeconds(seconds: number, language: Language): string {
  const clampedSeconds = Math.max(seconds, 0);
  const totalDays = clampedSeconds / SECONDS_PER_DAY;
  if (totalDays >= LONG_DURATION_DAY_THRESHOLD) {
    const formatted = formatLongDurationFromDays(Math.round(totalDays), language);
    return language === "zh" ? `${formatted}后` : `in ${formatted}`;
  }

  if (totalDays >= 1) {
    return language === "zh"
      ? `${formatNumber(totalDays)} 天后`
      : `in ${formatNumber(totalDays)} days`;
  }

  const totalHours = clampedSeconds / SECONDS_PER_HOUR;
  return language === "zh"
    ? `${formatNumber(totalHours)} 小时后`
    : `in ${formatNumber(totalHours)} hours`;
}

function formatLongDurationFromDays(totalDays: number, language: Language): string {
  const years = Math.floor(totalDays / DAYS_PER_YEAR);
  const daysAfterYears = totalDays % DAYS_PER_YEAR;
  const months = Math.floor(daysAfterYears / DAYS_PER_MONTH);
  const days = daysAfterYears % DAYS_PER_MONTH;

  if (language === "zh") {
    const parts = [`${years} 年`];
    if (months > 0) {
      parts.push(`${months} 月`);
    }
    if (days > 0 || parts.length === 1) {
      parts.push(`${days} 天`);
    }
    return parts.join(" ");
  }

  const parts = [formatEnglishUnit(years, "year")];
  if (months > 0) {
    parts.push(formatEnglishUnit(months, "month"));
  }
  if (days > 0 || parts.length === 1) {
    parts.push(formatEnglishUnit(days, "day"));
  }
  return parts.join(" ");
}

function formatEnglishUnit(value: number, unit: "year" | "month" | "day"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}
