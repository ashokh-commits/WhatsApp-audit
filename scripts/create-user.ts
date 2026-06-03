/**
 * Create the first agency user (run on VPS over SSH).
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/create-user.ts admin@example.com 'your-password'
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const [, , emailArg, passwordArg] = process.argv;
  const databaseUrl = process.env.DATABASE_URL;
  const email = emailArg?.trim().toLowerCase();
  const password = passwordArg;

  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Usage: DATABASE_URL=... npx tsx scripts/create-user.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.error(`User already exists: ${email}`);
      process.exit(1);
    }

    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );
    const user = result.rows[0];
    console.log(`Created user ${user.email} (${user.id})`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
