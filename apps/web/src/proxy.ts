import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Node/proxy runtime: build NextAuth from the provider-free config only.
// Importing '@/auth' here would pull lib/db (and `server-only`) into the proxy bundle.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ['/hr', '/hr/((?!login(?:/|$)).*)'],
};
