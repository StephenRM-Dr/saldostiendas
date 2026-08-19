export function todayISOCaracas(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now);
}

export function isDateClosed(date: string, now: Date = new Date()): boolean {
  return date < todayISOCaracas(now);
}
