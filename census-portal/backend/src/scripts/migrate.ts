// backend/src/scripts/migrate.ts
import fs from 'fs';
import path from 'path';
import { query, pool } from '../db/pool';

async function migrate() {
  console.log('🗃️ Running database migrations...');
  console.log('📊 Checking database connection...');

  try {
    // Test database connection first
    const testResult = await query('SELECT NOW() as now');
    console.log('✅ Database connected:', testResult.rows[0].now);

    const sqlPath = path.join(__dirname, '../db/schema.sql');
    
    // Check if schema.sql exists
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ schema.sql not found at:', sqlPath);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 schema.sql loaded successfully');

    // Strip full-line comments before splitting into statements
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`📝 Executing ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await query(statement);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.message?.includes('already exists') || 
            err.message?.includes('already exists')) {
          console.log(`⏭️ Statement ${i + 1} already exists, skipping`);
        } else {
          throw err;
        }
      }
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