export function todayISOCaracas(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isDateClosed(date: string, now: Date = new Date()): boolean {
  if (!isValidISODate(date)) return true;
  return date < todayISOCaracas(now);
}

export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}
