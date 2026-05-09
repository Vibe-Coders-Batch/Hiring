import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * When AUTH_DEV_SECRET is set, require `vaivamm_staff` cookie for /admin (except login).
 * Cognito-only deployments leave AUTH_DEV_SECRET unset — no cookie gate here.
 */
export function middleware(req: NextRequest) {
  if (process.env.E2E_DISABLE_ADMIN_GUARD === 'true' || process.env.E2E_DISABLE_ADMIN_GUARD === '1') {
    return NextResponse.next();
  }

  const devAuthEnabled = Boolean(process.env.AUTH_DEV_SECRET);
  if (!devAuthEnabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  const token = req.cookies.get('vaivamm_staff')?.value;
  if (!token) {
    const login = new URL('/admin/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
