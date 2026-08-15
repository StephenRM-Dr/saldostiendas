import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import { getDayLedger } from '@/lib/movements';
import { formatMoney } from '@/lib/money';
import MovementRow from './MovementRow';
import DateNav from './DateNav';

export const dynamic = 'force-dynamic';

function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const date = dateParam ?? todayISO();
  const { movements, saldoInicial, saldoFinal } = await getDayLedger(store.id, date);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold">{store.name}</h1>
      <DateNav slug={store.slug} date={date} />

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="bg-yellow-300 text-left">
            <th className="p-2">Concepto</th>
            <th className="p-2 text-right">Dólares</th>
            <th className="p-2 text-right">Bolívares</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          <tr className="bg-yellow-100 font-semibold">
            <td className="p-2">Saldo al inicio del día</td>
            <td className="p-2 text-right">{formatMoney(saldoInicial.usdCents)}</td>
            <td className="p-2 text-right">{formatMoney(saldoInicial.vesCents)}</td>
            <td className="p-2" />
          </tr>
          {movements.map((m) => (
            <MovementRow key={m.id} movement={m} />
          ))}
          <tr className="bg-yellow-300 font-semibold">
            <td className="p-2">Saldo al Final del día</td>
            <td className="p-2 text-right">{formatMoney(saldoFinal.usdCents)}</td>
            <td className="p-2 text-right">{formatMoney(saldoFinal.vesCents)}</td>
            <td className="p-2" />
          </tr>
        </tbody>
      </table>
    </main>
  );
}
