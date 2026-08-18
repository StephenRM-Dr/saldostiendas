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
    <main className="mx-auto max-w-sm p-4">
      <h1 className="text-xl font-semibold">{store.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Ingresa el PIN de la tienda para continuar.</p>
      <PinLoginForm slug={store.slug} />
    </main>
  );
}
