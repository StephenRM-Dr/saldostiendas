import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import PinLoginForm from './PinLoginForm';

export const dynamic = 'force-dynamic';

export default async function StoreLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{store.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Ingresa el PIN de la tienda para continuar.</p>
        <PinLoginForm slug={store.slug} />
      </div>
    </main>
  );
}
