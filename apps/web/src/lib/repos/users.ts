import 'server-only';
import { one } from '@/lib/db';
import type { User } from '@/types/domain';

export async function findUserById(id: string): Promise<User | null> {
  return one<User>(
    `SELECT id, email, full_name, role, is_active, created_at, updated_at
     FROM HRSYSTEM_users
     WHERE id = $1`,
    [id],
  );
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return one<User>(
    `SELECT id, email, full_name, role, is_active, created_at, updated_at
     FROM HRSYSTEM_users
     WHERE lower(email) = lower($1)`,
    [email],
  );
}
