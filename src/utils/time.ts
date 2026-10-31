/** Short relative time for card metadata, e.g. "just now", "12 min ago", "3 h ago". */
export function relativeTime(from: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Local-time greeting. Derived on-device, so it is true without a backend. */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Compact uppercase date label matching the widget reference, e.g. "SAT, OCT 25". */
export function dateLabel(date: Date = new Date()): string {
  return date
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

export const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "SAT, OCT 26" — the widget date format, matching `{{$date}}` in widget documents. */
export function widgetDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "09:41" — 24-hour clock, matching `{{$time}}` in widget documents. */
export function widgetTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Whole days, hours and minutes from `now` until `target`; zero once it has passed. */
export function timeUntil(target: Date, now: Date): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60_000));
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

