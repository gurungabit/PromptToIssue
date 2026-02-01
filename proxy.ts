import { auth } from '@/lib/auth/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/public'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicApi = pathname.startsWith('/api/public');
  
  // Allow public routes and auth API
  if (isPublicRoute || isApiAuthRoute || isPublicApi) {
    return NextResponse.next();
  }
  
  // Check if user is authenticated
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
