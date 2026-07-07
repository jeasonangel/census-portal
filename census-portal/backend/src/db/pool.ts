// backend/src/db/pool.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Use DATABASE_URL from environment (Railway) or fallback to config
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.error('💡 Please set DATABASE_URL in your Railway environment variables');
  process.exit(1);
}

console.log('📊 Connecting to database...');
console.log('📊 Using DATABASE_URL:', DATABASE_URL.replace(/:[^@]*@/, ':****@'));

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
  max: 20,
  idleTimeoutMillis: 30000,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

export default pool;