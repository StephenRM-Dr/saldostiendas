import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';

export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
