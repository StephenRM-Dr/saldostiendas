import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { checkStoreSession, storeSessionCookieName } from '@/lib/storeAuth';
import { getStoreBySlug } from '@/lib/stores';

function handleAdmin(request: NextRequest): Response {
  if (!process.env.ADMIN_PASSWORD) {
    return new Response('ADMIN_PASSWORD no esta configurado en el servidor.', { status: 500 });
  }
  if (!isAuthorized(request.headers.get('authorization'))) {
    return new Response('Autenticacion requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' },
    });
  }
  return NextResponse.next();
}

async function handleTienda(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;
  if (pathname.endsWith('/login') || pathname.endsWith('/manifest.webmanifest')) {
    return NextResponse.next();
  }

  const slug = pathname.split('/')[2];
  if (!slug) {
    return NextResponse.next();
  }

  if (!process.env.SESSION_SECRET) {
    return new Response('SESSION_SECRET no esta configurado en el servidor.', { status: 500 });
  }

  const store = await getStoreBySlug(slug);
  const sessionCookie = request.cookies.get(storeSessionCookieName(slug))?.value;
  const status = checkStoreSession(sessionCookie, slug, store?.session_id ?? null);

  if (status === 'valid') {
    return NextResponse.next();
  }

  const loginUrl = new URL(`/tienda/${slug}/login`, request.url);
  if (status === 'replaced') {
    loginUrl.searchParams.set('reason', 'replaced');
  }
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleAdmin(request);
  }

  if (pathname.startsWith('/tienda/')) {
    return handleTienda(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/tienda/:path*'],
};
