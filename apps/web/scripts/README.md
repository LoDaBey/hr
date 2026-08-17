# Database bootstrap

`schema.sql` is the single source of truth for a fresh database. All incremental
migrations are already folded into it — apply this file once and you are done.

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
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- expect 24

SELECT count(*) FROM email_templates;
-- expect 11

SELECT count(*) FROM app_settings;
-- expect 1
```

## Create the HR user

`schema.sql` seeds `hr@company.com`, but the seeded `password_hash` does not match
`ChangeMe123!` (the `INSERT … crypt(…)` runs under `ON CONFLICT DO NOTHING`, and a
stale or dump-restored hash can leave login broken). Set a working password:

```sql
UPDATE users
SET password_hash = crypt('ChangeMe123!', gen_salt('bf'))
WHERE email = 'hr@company.com';
```
```sql
INSERT INTO users (email, password_hash, full_name, role)
VALUES ('your@email.com', crypt('your-password', gen_salt('bf')), 'Your Name', 'ADMIN');
```
Sign in with `hr@company.com` / `ChangeMe123!`. Change the password before go-live.
