/** PocketBase hands back "2026-07-24 09:14:00.000Z" — not quite ISO. */
export function toDate(value: string): Date {
  return new Date(value.replace(" ", "T"));
}

export function relativeTime(value: string, now = Date.now()): string {
  const then = toDate(value).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return toDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function clockTime(value: string): string {
  return toDate(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Today" / "Yesterday" / "Mon 21 Jul" — the heading for a day's dumps. */
export function dayLabel(value: string, now = new Date()): string {
  const date = toDate(value);
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function dayKey(value: string): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
