import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

const API_SECRET = process.env.API_SECRET;
const API_SECRET_HEADER = 'x-api-secret';

const PUBLIC_PATHS = new Set([
  '/login',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/ws_media_miner.zip',
]);

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/') || /\.[a-z0-9]+$/i.test(pathname);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || isStaticAsset(pathname);
}

function isProtectedApiPath(pathname: string): boolean {
  return pathname === '/api/creative' || pathname.startsWith('/api/creative/');
}

function shouldRequireLogin(pathname: string): boolean {
  if (isPublicPath(pathname)) return false;
  if (pathname.startsWith('/api/')) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedApiPath(pathname)) {
    if (!API_SECRET) {
      return NextResponse.json({ error: 'API_SECRET 미설정' }, { status: 500 });
    }

    const requestSecret = request.headers.get(API_SECRET_HEADER);
    if (!requestSecret || requestSecret !== API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
  }

  if (!shouldRequireLogin(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value || '';
  const session = token ? await verifySessionToken(token) : null;
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  const nextTarget = `${pathname}${search}`;
  if (nextTarget && nextTarget !== '/login') {
    loginUrl.searchParams.set('next', nextTarget);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/:path*'],
};
