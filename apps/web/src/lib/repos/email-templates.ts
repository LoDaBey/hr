import 'server-only';
import { one } from '@/lib/db';
import type { EmailTemplate } from '@/types/domain';

export async function findEmailTemplateByKey(key: string): Promise<EmailTemplate | null> {
  return one<EmailTemplate>(`SELECT * FROM HRSYSTEM_email_templates WHERE key = $1`, [key]);
}
