import { getStoreBySlug } from '@/lib/stores';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) {
    return new Response('Tienda no encontrada.', { status: 404 });
  }

  const manifest = {
    name: `${store.name} - Cuadro de Cierre`,
    short_name: store.name,
    start_url: `/tienda/${store.slug}`,
    display: 'standalone',
    background_color: '#fde047',
    theme_color: '#fde047',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };

  return Response.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
