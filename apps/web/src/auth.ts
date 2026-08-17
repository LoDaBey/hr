import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { one } from '@/lib/db';
import { isRateLimited } from '@/lib/rate-limit';
import { authConfig } from './auth.config';

if (!process.env.AUTH_SECRET) {
  console.error('Missing env var: AUTH_SECRET');
}
if (!process.env.AUTH_URL) {
  console.error('Missing env var: AUTH_URL');
}
if (!process.env.DATABASE_URL) {
  console.error('Missing env var: DATABASE_URL');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        try {
          const email = String(creds?.email ?? '').trim().toLowerCase();
          const password = String(creds?.password ?? '');
          if (!email || !password) return null;

          const limited = await isRateLimited(`signin:${email}`, 10, 900);
          if (limited) return null;

          const user = await one<{ id: string; email: string; full_name: string; role: string }>(
            `SELECT id, email, full_name, role
             FROM users
             WHERE lower(email) = $1 AND is_active
               AND password_hash = crypt($2, password_hash)`,
            [email, password],
          );
          if (!user) return null;
          return { id: user.id, name: user.full_name, email: user.email, role: user.role };
        } catch (error) {
          console.error(error);
          return null;
        }
      },
    }),
  ],
});
