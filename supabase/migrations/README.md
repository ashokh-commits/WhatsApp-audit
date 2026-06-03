# Legacy migrations (Supabase)

These SQL files targeted **Supabase Auth** (`auth.users`) and **RLS**. New deployments use **`db/migrations/001_schema.sql`** with a local `users` table and no RLS.

Do not run these on a fresh VPS Postgres install unless you are maintaining an old Supabase-backed deployment.
