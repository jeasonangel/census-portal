import fs from 'fs';
import path from 'path';
import { query, pool } from '../db/pool';

async function migrate() {
  console.log('🗃️ Running database migrations...');

  try {
    const sqlPath = path.join(__dirname, '../db/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Strip full-line comments before splitting into statements. Without
    // this, any statement preceded by a `--` header line (i.e. all of them)
    // gets treated as a comment chunk and silently skipped.
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await query(statement);
    }

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();