import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new Response('ADMIN_PASSWORD no esta configurado en el servidor.', { status: 500 });
  }

  const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
  const authHeader = request.headers.get('authorization');

  if (authHeader !== expected) {
    return new Response('Autenticacion requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
