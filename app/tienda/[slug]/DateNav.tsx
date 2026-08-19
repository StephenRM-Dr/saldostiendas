'use client';

import { useRouter } from 'next/navigation';

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DateNav({
  slug,
  date,
  isToday,
  closed,
}: {
  slug: string;
  date: string;
  isToday: boolean;
  closed: boolean;
}) {
  const router = useRouter();

  function goTo(newDate: string) {
    router.push(`/tienda/${slug}?date=${newDate}`);
  }

  let status = { label: 'Hoy · Abierto', className: 'bg-emerald-100 text-emerald-700' };
  if (!isToday) {
    status = closed
      ? { label: 'Cerrado', className: 'bg-slate-200 text-slate-600' }
      : { label: 'Editable', className: 'bg-emerald-100 text-emerald-700' };
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => goTo(shiftDate(date, -1))}
        aria-label="Día anterior"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
      >
        ‹
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => goTo(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => goTo(shiftDate(date, 1))}
        aria-label="Día siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
      >
        ›
      </button>
      <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
        {status.label}
      </span>
    </div>
  );
}
