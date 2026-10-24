import { NextRequest, NextResponse } from 'next/server';
import { getPasscode, isPasscodeConfigured, authToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isPasscodeConfigured()) {
    return NextResponse.json({ error: 'Authentication is not configured' }, { status: 500 });
  }

  const { passcode } = await request.json();

  if (!passcode) {
    return NextResponse.json({ error: 'Passcode is required' }, { status: 400 });
  }

  if (passcode === getPasscode()) {
    const response = NextResponse.json({ success: true });
    response.cookies.set('feminism-class-auth', await authToken(getPasscode()), {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
}
