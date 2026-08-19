import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/stores';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const title = store ? `${store.name} - Cuadro de Cierre` : 'Cuadro de Cierre';

  return {
    title,
    manifest: `/tienda/${slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: store?.name ?? title,
      statusBarStyle: 'default',
    },
    icons: { apple: '/icon-192' },
  };
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
