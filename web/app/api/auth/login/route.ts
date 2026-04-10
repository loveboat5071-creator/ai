import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, issueSessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UserRole = 'sales' | 'admin' | 'miner';

function resolveLoginRole(username: string, password: string): UserRole | null {
  const salesUser = process.env.SALES_USER?.trim();
  const salesPassword = process.env.SALES_PASSWORD?.trim();
  const adminUser = process.env.ADMIN_USER?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const minerUser = process.env.MINER_USER?.trim();
  const minerPassword = process.env.MINER_PASSWORD?.trim();

  if (salesUser && salesPassword && username === salesUser && password === salesPassword) {
    return 'sales';
  }

  if (adminUser && adminPassword && username === adminUser && password === adminPassword) {
    return 'admin';
  }

  if (minerUser && minerPassword && username === minerUser && password === minerPassword) {
    return 'miner';
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 },
      );
    }

    const role = resolveLoginRole(username, password);
    if (!role) {
      return NextResponse.json(
        { success: false, error: '로그인 정보가 올바르지 않습니다.' },
        { status: 401 },
      );
    }

    const token = await issueSessionToken(role);
    if (!token) {
      return NextResponse.json(
        { success: false, error: '세션을 생성할 수 없습니다.' },
        { status: 500 },
      );
    }

    const response = NextResponse.json({
      success: true,
      role,
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
