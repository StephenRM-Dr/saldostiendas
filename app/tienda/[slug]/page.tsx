import { notFound, redirect } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import { cookies } from 'next/headers';
import { verifyStoreSession, storeSessionCookieName } from '@/lib/storeAuth';
import { logoutAction } from './actions';
import { getDayLedger } from '@/lib/movements';
import { formatMoney } from '@/lib/money';
import { todayISOCaracas } from '@/lib/date';
import MovementRow from './MovementRow';
import DateNav from './DateNav';
import MovementForm from './MovementForm';
import TelegramButton from './TelegramButton';

export const dynamic = 'force-dynamic';

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

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(storeSessionCookieName(store.slug))?.value;
  if (!verifyStoreSession(sessionCookie, store.slug)) {
    redirect(`/tienda/${store.slug}/login`);
  }

  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISOCaracas();
  const { movements, saldoInicial, saldoFinal } = await getDayLedger(store.id, date);

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{store.name}</h1>
        <form action={logoutAction}>
          <input type="hidden" name="slug" value={store.slug} />
          <button type="submit" className="text-sm text-blue-600 underline">
            Cerrar sesion
          </button>
        </form>
      </div>
      <DateNav slug={store.slug} date={date} />
      <TelegramButton slug={store.slug} date={date} />

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
            <MovementRow key={m.id} movement={m} slug={store.slug} />
          ))}
          <tr className="bg-yellow-300 font-semibold">
            <td className="p-2">Saldo al Final del día</td>
            <td className="p-2 text-right">{formatMoney(saldoFinal.usdCents)}</td>
            <td className="p-2 text-right">{formatMoney(saldoFinal.vesCents)}</td>
            <td className="p-2" />
          </tr>
        </tbody>
      </table>

      <MovementForm storeId={store.id} slug={store.slug} date={date} />
    </main>
  );
}
