import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const USER_KEY = 'census_user';
const API_KEY_KEY = 'census_api_key';
const JWT_KEY = 'jwt_token';

export interface StoredUser {
  id: number;
  email: string;
  full_name: string;
  user_type?: string;
}

export const getStoredUser = (): StoredUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const setStoredUser = (user: StoredUser) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredApiKey = (): string | null => localStorage.getItem(API_KEY_KEY);

export const setStoredApiKey = (apiKey: string) => {
  localStorage.setItem(API_KEY_KEY, apiKey);
};

export const getStoredToken = (): string | null => localStorage.getItem(JWT_KEY);

export const setStoredToken = (token: string) => {
  localStorage.setItem(JWT_KEY, token);
};

export const clearSession = () => {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(JWT_KEY);
};

export const authApi = {
  login: (email: string, password: string) =>
    axios.post(`${API_BASE}/auth/login`, { email, password }),
  register: (email: string, password: string, full_name: string, organization: string) =>
    axios.post(`${API_BASE}/auth/register`, { email, password, full_name, organization }),
};

// Session-based client for managing your own account: API keys and usage.
// Authenticated with the JWT issued at login/register.
export const accountApi = (token: string) => {
  const client = axios.create({
    baseURL: `${API_BASE}/protected`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    getKeys: () => client.get('/keys'),
    createKey: (name: string) => client.post('/keys', { name }),
    deleteKey: (id: number) => client.delete(`/keys/${id}`),
    getUsage: () => client.get('/usage'),
    requestUpgrade: (plan: string) => client.post('/upgrade-request', { plan }),
    getUpgradeRequest: () => client.get('/upgrade-request'),
  };
};

// Admin-only client: list accounts and grant/revoke plan upgrades.
// Authenticated with the JWT issued at login; the backend additionally
// requires the signed-in account to have user_type === 'ADMIN'.
export const adminApi = (token: string) => {
  const client = axios.create({
    baseURL: `${API_BASE}/admin`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    listUsers: () => client.get('/users'),
    updatePlan: (id: number, plan: string) => client.patch(`/users/${id}/plan`, { plan }),
    listUpgradeRequests: () => client.get('/upgrade-requests'),
    resolveUpgradeRequest: (id: number, action: 'approve' | 'reject') =>
      client.patch(`/upgrade-requests/${id}`, { action }),
    importData: (csv: string) => client.post('/import', { csv }),
    listData: (params: {
      geography?: string;
      indicator?: string;
      year?: number;
      search?: string;
      page?: number;
      limit?: number;
    }) => client.get('/data', { params }),
    updateData: (
      id: number,
      fields: Partial<{ year: number; value: number; gender: string; age_group: string; source: string }>
    ) => client.patch(`/data/${id}`, fields),

    // Full geography hierarchy + data access for the admin's own Data
    // Explorer view — no API key needed, JWT + ADMIN role is enough.
    getDepartments: (regionCode: string) => client.get(`/regions/${regionCode}/departments`),
    getDistricts: (deptCode: string) => client.get(`/departments/${deptCode}/districts`),
    getVillages: (districtCode: string) => client.get(`/districts/${districtCode}/villages`),
    addGeography: (geo: {
      code: string;
      name: string;
      level: 'department' | 'district' | 'village';
      parent_code: string;
      population?: number;
    }) => client.post('/geography', geo),
  };
};

// API-key client for actual data access (what external integrations use).
export const protectedApi = (apiKey: string) => {
  const client = axios.create({
    baseURL: `${API_BASE}/protected`,
    headers: { 'X-API-Key': apiKey },
  });
  return {
    getData: (geographyCode: string, indicatorCode: string, year?: number) =>
      client.get('/data', { params: { geography: geographyCode, indicator: indicatorCode, year: year || 2026 } }),

    // Sub-region hierarchy — not available without a key, see publicApi
    // for the region-only equivalents.
    getDepartments: (regionCode: string) => client.get(`/regions/${regionCode}/departments`),
    getDistricts: (deptCode: string) => client.get(`/departments/${deptCode}/districts`),
    getVillages: (districtCode: string) => client.get(`/districts/${districtCode}/villages`),
  };
};

// Public, unauthenticated client — region level only. Departments,
// districts, and villages require an API key (see protectedApi).
export const publicApi = {
  // Geography
  getRegions: () => axios.get(`${API_BASE}/public/regions`),

  // Indicators
  getIndicators: () => axios.get(`${API_BASE}/public/indicators`),

  // Data (region-level only)
  getData: (geographyCode: string, indicatorCode: string, year?: number) =>
    axios.get(`${API_BASE}/public/data`, {
      params: { geography: geographyCode, indicator: indicatorCode, year: year || 2026 },
    }),

  // Search (regions only)
  search: (q: string) => axios.get(`${API_BASE}/public/search`, { params: { q } }),
};