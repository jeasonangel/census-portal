import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    name: process.env.DB_NAME || 'census_data_portal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-key',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@census.cm',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
};

export const RATE_LIMITS = {
  NGO_DEVELOPER: 150000,
  NGO_DATA_ANALYST: 60000,
  NGO_PROJECT_MANAGER: 30000,
  RESEARCHER: 15000,
  JOURNALIST: 15000,
  ADMIN: -1, // Unlimited
};

// Billing tier - governs how many active API keys an account may hold.
// Admins (by user_type) bypass this check entirely regardless of plan.
export const PLAN_LIMITS: Record<string, { maxApiKeys: number }> = {
  FREE: { maxApiKeys: 1 },
  PAID: { maxApiKeys: 10 },
};

export const DEFAULT_PLAN = 'FREE';