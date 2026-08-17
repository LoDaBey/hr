import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the NextAuth config.
 *
 * This file must NOT import anything Node-only — no `server-only`, no `lib/db`,
 * no database, no crypto. `proxy.ts` loads it into the request proxy runtime.
 * Providers live in `auth.ts`, which only ever runs on the server.
 */
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/hr/login' },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === '/hr/login' || pathname.startsWith('/hr/login/')) {
        return true;
      }
      return !!session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.role = typeof token.role === 'string' ? token.role : '';
      return session;
    },
  },
} satisfies NextAuthConfig;
