import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import PinLoginForm from './PinLoginForm';

export const dynamic = 'force-dynamic';

export default async function StoreLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { slug } = await params;
  const { reason } = await searchParams;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{store.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Ingresa el PIN de la tienda para continuar.</p>
        {reason === 'replaced' && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            Tu sesión se cerró porque se inició sesión en otro dispositivo.
          </p>
        )}
        <PinLoginForm slug={store.slug} />
      </div>
    </main>
  );
}
