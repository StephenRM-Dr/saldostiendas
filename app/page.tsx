import Link from 'next/link';
import { listStores } from '@/lib/stores';

export default async function HomePage() {
  const stores = await listStores();

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Cuadro de Cierre</h1>
        <p className="mt-1 text-sm text-slate-500">Selecciona tu tienda para continuar</p>
      </div>
      <ul className="space-y-3">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              href={`/tienda/${store.slug}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 active:scale-[0.99]"
            >
              {store.name}
              <span aria-hidden className="text-slate-400">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
