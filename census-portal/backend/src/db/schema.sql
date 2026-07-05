-- ============================================================
-- CENSUS DATA PORTAL - DATABASE SCHEMA
-- ============================================================

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    organization VARCHAR(255),
    user_type VARCHAR(50) DEFAULT 'USER',
    plan VARCHAR(20) DEFAULT 'FREE' NOT NULL,
    monthly_limit INTEGER DEFAULT 150000,
    requests_used INTEGER DEFAULT 0,
    is_unlimited BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill for databases created before the `plan` column existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'FREE' NOT NULL;

-- Backfill for accounts created under the old, now-removed user_type
-- tiers (NGO_DEVELOPER, NGO_DATA_ANALYST, NGO_PROJECT_MANAGER,
-- RESEARCHER, JOURNALIST) — collapsed down to a single non-admin role.
UPDATE users SET user_type = 'USER' WHERE user_type NOT IN ('USER', 'ADMIN');

-- ============================================================
-- 2. API KEYS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

-- ============================================================
-- 3. GEOGRAPHY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS spatial_geo (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL,
    parent_id INTEGER REFERENCES spatial_geo(id),
    population INTEGER,
    area_km2 DECIMAL(10,2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6)

);

-- Drop the unused PostGIS geometry column: the extension was never
-- enabled and nothing ever populated or queried it (see README §11).
ALTER TABLE spatial_geo DROP COLUMN IF EXISTS geom;

-- ============================================================
-- 4. INDICATORS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS indicators (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    source VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 5. DATA VALUES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS data_values (
    id SERIAL PRIMARY KEY,
    geography_id INTEGER REFERENCES spatial_geo(id) ON DELETE CASCADE,
    indicator_id INTEGER REFERENCES indicators(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    gender VARCHAR(20) DEFAULT 'all',
    age_group VARCHAR(50) DEFAULT 'all',
    source VARCHAR(200),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(geography_id, indicator_id, year, gender, age_group)
);

-- ============================================================
-- 6. USAGE LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. PLAN UPGRADE REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_upgrade_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    requested_plan VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_spatial_geo_code ON spatial_geo(code);
CREATE INDEX IF NOT EXISTS idx_spatial_geo_parent ON spatial_geo(parent_id);
CREATE INDEX IF NOT EXISTS idx_spatial_geo_level ON spatial_geo(level);
CREATE INDEX IF NOT EXISTS idx_data_values_geo_ind ON data_values(geography_id, indicator_id, year);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON plan_upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON plan_upgrade_requests(status);