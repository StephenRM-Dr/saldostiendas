export function toCents(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}
