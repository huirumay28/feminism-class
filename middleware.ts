import { NextRequest, NextResponse } from 'next/server';

async function token(passcode: string) {
  const data = new TextEncoder().encode('feminism-class:' + passcode);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const passcode = process.env.CLASS_PASSCODE;
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/auth') return NextResponse.next();
  // Fail closed: no passcode configured means nobody gets in.
  const ok = !!passcode && req.cookies.get('feminism-class-auth')?.value === (await token(passcode));
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/|favicon.ico|.*\\.svg$).*)'] };
