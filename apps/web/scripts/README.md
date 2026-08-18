# Database bootstrap

`schema.sql` is the single source of truth for the HR tables. Every table, index,
enum, and helper function is prefixed `HRSYSTEM_` so it can live in the same Postgres
database as the existing production schema in `scripts/production-DB/` without colliding
with `users`, `attendance`, and the rest.

Apply this file once. It is idempotent: safe to re-run.

Run these from `apps/web/` (or adjust the `-f` path).

## Local Postgres

```powershell
# Create the database (once)
psql -U postgres -c "CREATE DATABASE hr;"

# Apply schema + seed
psql -U postgres -d hr -f scripts/schema.sql
```

If your local URL matches `.env.local`:

```powershell
psql "postgresql://USER:PASSWORD@localhost:5433/hr" -f scripts/schema.sql
```

## Render Postgres

```powershell
psql "$env:DATABASE_URL" -f scripts/schema.sql
```

Or with the connection string pasted in:

```powershell
psql "postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" -f scripts/schema.sql
```

## Verify

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'HRSYSTEM_%';
-- expect 24 HR tables (production tables are left untouched)

SELECT count(*) FROM HRSYSTEM_email_templates;
-- expect 11

SELECT count(*) FROM HRSYSTEM_app_settings;
-- expect 1
```

## Create the HR user

`schema.sql` seeds `hr@company.com`, but the seeded `password_hash` does not match
`ChangeMe123!` (the `INSERT … crypt(…)` runs under `ON CONFLICT DO NOTHING`, and a
stale or dump-restored hash can leave login broken). Set a working password:

```sql
UPDATE HRSYSTEM_users
SET password_hash = crypt('ChangeMe123!', gen_salt('bf'))
WHERE email = 'hr@company.com';
```
```sql
INSERT INTO HRSYSTEM_users (email, password_hash, full_name, role)
VALUES ('your@email.com', crypt('your-password', gen_salt('bf')), 'Your Name', 'ADMIN');
```
Sign in with `hr@company.com` / `ChangeMe123!`. Change the password before go-live.
