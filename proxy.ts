import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { verifyStoreSession, storeSessionCookieName } from '@/lib/storeAuth';

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

function handleTienda(request: NextRequest): Response {
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

  const sessionCookie = request.cookies.get(storeSessionCookieName(slug))?.value;
  if (!verifyStoreSession(sessionCookie, slug)) {
    return NextResponse.redirect(new URL(`/tienda/${slug}/login`, request.url));
  }
  return NextResponse.next();
}

export function proxy(request: NextRequest) {
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
