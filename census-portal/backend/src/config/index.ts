// backend/src/config/index.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Use DATABASE_URL as primary, fallback to individual params for local
  databaseUrl: process.env.DATABASE_URL || '',
  
  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    name: process.env.PGDATABASE || 'census_portal_db',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@census.cm',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://frontend-production-0427.up.railway.app,http://localhost:3000,http://localhost:5173',
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },
};
export const DEFAULT_PLAN = 'FREE';

// Billing tiers differ only by monthly API request quota. ENTERPRISE
// has no numeric cap (isUnlimited) — monthlyLimit is unused for it.
// Whenever a user's plan changes (registration, admin plan change,
// upgrade-request approval), their users.monthly_limit/is_unlimited
// columns are synced from this table so authenticateApiKey's quota
// check — which reads those columns directly — stays accurate.
export const PLAN_LIMITS: Record<string, { monthlyLimit: number; isUnlimited?: boolean }> = {
  FREE: { monthlyLimit: 150000 },
  STARTER: { monthlyLimit: 500000 },
  PROFESSIONAL: { monthlyLimit: 2000000 },
  ENTERPRISE: { monthlyLimit: 0, isUnlimited: true },
};

// One website only ever needs one API key — a second key would just
// read the same data — so every account (any plan) may hold at most
// this many active keys. Admins (by user_type) bypass this entirely.
export const MAX_API_KEYS_PER_ACCOUNT = 1;