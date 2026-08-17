import Link from 'next/link';
import { listStores } from '@/lib/stores';

export default async function HomePage() {
  const stores = await listStores();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-xl font-semibold">Cuadro de Cierre — Tiendas</h1>
      <ul className="space-y-3">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              href={`/tienda/${store.slug}`}
              className="block rounded-lg border border-gray-300 px-4 py-3 text-lg hover:bg-gray-50"
            >
              {store.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
