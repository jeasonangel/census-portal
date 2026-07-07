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
export const RATE_LIMITS = {
  USER: 150000,
  ADMIN: -1, // Unlimited
};

// Billing tier - governs how many active API keys an account may hold.
// Admins (by user_type) bypass this check entirely regardless of plan.
export const PLAN_LIMITS: Record<string, { maxApiKeys: number }> = {
  FREE: { maxApiKeys: 1 },
  PAID: { maxApiKeys: 10 },
};

export const DEFAULT_PLAN = 'FREE';