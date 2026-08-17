'use client';

import { useRouter } from 'next/navigation';

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DateNav({ slug, date }: { slug: string; date: string }) {
  const router = useRouter();

  function goTo(newDate: string) {
    router.push(`/tienda/${slug}?date=${newDate}`);
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button type="button" onClick={() => goTo(shiftDate(date, -1))} className="rounded border px-2 py-1">
        ← Anterior
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => goTo(e.target.value)}
        className="rounded border px-2 py-1"
      />
      <button type="button" onClick={() => goTo(shiftDate(date, 1))} className="rounded border px-2 py-1">
        Siguiente →
      </button>
    </div>
  );
}
