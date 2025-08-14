import { NextResponse } from 'next/server';
import { securityMiddleware } from './src/middleware/security';

export async function middleware(request) {
  // Apply security middleware
  const securityResponse = await securityMiddleware(request);
  if (securityResponse.status !== 200) {
    return securityResponse;
  }
  
  return securityResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};