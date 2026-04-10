import { NextRequest, NextResponse } from 'next/server';
import { isValidCredentials } from '@/lib/auth/credentials';
import { AUTH_COOKIE_NAME, issueSessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!username || !password) {
      return NextResponse.json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    if (!isValidCredentials('miner', username, password)) {
      return NextResponse.json({ success: false, error: '로그인 정보가 올바르지 않습니다.' }, { status: 401 });
    }

    const token = await issueSessionToken('miner');
    if (!token) {
      return NextResponse.json({ success: false, error: '세션을 생성할 수 없습니다.' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      token,
      role: 'miner',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `로그인 처리에 실패했습니다: ${error}` },
      { status: 500 },
    );
  }
}
