import { notFound, redirect } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import { cookies } from 'next/headers';
import { verifyStoreSession, storeSessionCookieName } from '@/lib/storeAuth';
import { logoutAction } from './actions';
import { getDayLedger } from '@/lib/movements';
import { formatMoney } from '@/lib/money';
import { todayISOCaracas, isDateClosed } from '@/lib/date';
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
  const today = todayISOCaracas();
  const closed = isDateClosed(date);
  const { movements, saldoInicial, saldoFinal } = await getDayLedger(store.id, date);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{store.name}</h1>
        <form action={logoutAction}>
          <input type="hidden" name="slug" value={store.slug} />
          <button
            type="submit"
            className="rounded-md px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <DateNav slug={store.slug} date={date} isToday={date === today} closed={closed} />
        <TelegramButton slug={store.slug} date={date} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-100 text-left text-slate-700">
              <th className="p-3 font-medium">Concepto</th>
              <th className="p-3 text-right font-medium">Dólares</th>
              <th className="p-3 text-right font-medium">Bolívares</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-amber-50 font-semibold text-slate-800">
              <td className="p-3">Saldo al inicio del día</td>
              <td className="p-3 text-right">{formatMoney(saldoInicial.usdCents)}</td>
              <td className="p-3 text-right">{formatMoney(saldoInicial.vesCents)}</td>
              <td className="p-3" />
            </tr>
            {movements.map((m) => (
              <MovementRow key={m.id} movement={m} slug={store.slug} readOnly={closed} />
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">
                  Sin movimientos registrados este día.
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-amber-200 bg-amber-100 font-semibold text-slate-900">
              <td className="p-3">Saldo al Final del día</td>
              <td className="p-3 text-right">{formatMoney(saldoFinal.usdCents)}</td>
              <td className="p-3 text-right">{formatMoney(saldoFinal.vesCents)}</td>
              <td className="p-3" />
            </tr>
          </tbody>
        </table>
      </div>

      {closed ? (
        <p className="rounded-xl border-l-4 border-slate-300 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Este día ya cerró y no se pueden agregar ni modificar movimientos. Ve al día de hoy para
          registrar movimientos nuevos.
        </p>
      ) : (
        <MovementForm storeId={store.id} slug={store.slug} date={date} />
      )}
    </main>
  );
}
