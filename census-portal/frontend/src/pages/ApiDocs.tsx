import { BookOpen, Key, Lock, Terminal } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface EndpointRow {
  method: string;
  path: string;
  description: string;
}

const PUBLIC_ENDPOINTS: EndpointRow[] = [
  { method: 'GET', path: '/public/regions', description: 'List all regions' },
  { method: 'GET', path: '/public/indicators', description: 'List all available indicators' },
  { method: 'GET', path: '/public/data?geography=&indicator=&year=', description: 'Indicator value for a geography/year' },
  { method: 'GET', path: '/public/search?q=', description: 'Search geographies by name' },
];

const DATA_ENDPOINTS: EndpointRow[] = [
  { method: 'GET', path: '/protected/data?geography=&indicator=&year=', description: 'Same as /public/data, counted against your quota' },
   { method: 'GET', path: '/protected/regions/:code/departments', description: 'Departments within a region' },
  { method: 'GET', path: '/protected/departments/:code/districts', description: 'Districts within a department' },
  { method: 'GET', path: '/protected/districts/:code/villages', description: 'Villages within a district' },
];

const ANALYTICS_ENDPOINTS: EndpointRow[] = [
  { method: 'GET', path: '/analytics/regions?year=', description: 'All regions with their full indicator profile' },
  { method: 'GET', path: '/analytics/regions/:code?year=', description: 'Single region’s full indicator profile' },
  { method: 'GET', path: '/analytics/regions/rank/water?year=', description: 'Regions ranked by clean water access' },
  { method: 'GET', path: '/analytics/departments/rank?indicator=&region=&order=&limit=&year=', description: 'Departments ranked by any indicator' },
  { method: 'GET', path: '/analytics/compare/regions?codes=CE,LT&year=', description: 'Side-by-side comparison of 2+ regions' },
  { method: 'GET', path: '/analytics/best-worst?indicator=&level=&year=', description: 'Best/worst geography for an indicator' },
];

const ACCOUNT_ENDPOINTS: EndpointRow[] = [
  { method: 'GET', path: '/protected/keys', description: 'List your API keys' },
  { method: 'POST', path: '/protected/keys', description: 'Create a new API key' },
  { method: 'DELETE', path: '/protected/keys/:id', description: 'Revoke an API key' },
  { method: 'GET', path: '/protected/usage', description: 'Your current quota and usage' },
  { method: 'POST', path: '/protected/upgrade-request', description: 'Request a plan change' },
];

function EndpointTable({ rows }: { rows: EndpointRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cam-ink">
          <tr>
            <th className="text-left p-2 text-cam-muted text-xs uppercase w-20">Method</th>
            <th className="text-left p-2 text-cam-muted text-xs uppercase">Path</th>
            <th className="text-left p-2 text-cam-muted text-xs uppercase">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cam-line">
          {rows.map((r) => (
            <tr key={r.method + r.path}>
              <td className="p-2">
                <span className="text-xs font-mono font-medium text-cam-green">{r.method}</span>
              </td>
              <td className="p-2">
                <code className="text-xs text-cam-yellow">{r.path}</code>
              </td>
              <td className="p-2 text-cam-muted text-xs">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-cam-yellow" />
        <div>
          <h1 className="text-2xl font-bold">API Documentation</h1>
          <p className="text-cam-muted text-sm">
            How to integrate the Cameroon Census API into your own application.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cam-green" /> Base URL
        </h3>
        <code className="text-sm text-cam-yellow bg-cam-ink px-3 py-2 rounded-lg block">{API_BASE}</code>
      </div>

      <div className="card">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Key className="w-4 h-4 text-cam-green" /> Authentication
        </h3>
        <p className="text-cam-muted text-sm mb-3">
          Data endpoints (<code className="text-cam-yellow">/protected/data</code> and everything under{' '}
          <code className="text-cam-yellow">/analytics</code>) require an API key sent in an{' '}
          <code className="text-cam-yellow">X-API-Key</code> header. Create a key from the{' '}
          <a href="/api-keys" className="text-cam-green underline">API Keys</a> page. Each call counts against
          your monthly quota shown there.
        </p>
        <p className="text-cam-muted text-sm mb-3">
          Account endpoints (managing keys, usage, plan requests) instead use the session token issued at
          login, sent as <code className="text-cam-yellow">Authorization: Bearer &lt;token&gt;</code>.
        </p>
        <pre className="bg-cam-ink border border-cam-line rounded-lg p-3 text-xs text-cam-muted overflow-x-auto">
{`curl "${API_BASE}/protected/data?geography=CE&indicator=POP_TOT&year=2026" \\
  -H "X-API-Key: YOUR_API_KEY"`}
        </pre>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Public endpoints <span className="text-cam-muted text-xs font-normal">(no auth required)</span></h3>
        <EndpointTable rows={PUBLIC_ENDPOINTS} />
      </div>

      <div className="card">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          Data access <Lock className="w-3.5 h-3.5 text-cam-yellow" />
          <span className="text-cam-muted text-xs font-normal">(X-API-Key required, counts against quota)</span>
        </h3>
        <EndpointTable rows={DATA_ENDPOINTS} />
      </div>

      <div className="card">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          Analytics <Lock className="w-3.5 h-3.5 text-cam-yellow" />
          <span className="text-cam-muted text-xs font-normal">(X-API-Key required, counts against quota)</span>
        </h3>
        <EndpointTable rows={ANALYTICS_ENDPOINTS} />
      </div>

      <div className="card">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          Account management <Lock className="w-3.5 h-3.5 text-cam-yellow" />
          <span className="text-cam-muted text-xs font-normal">(Bearer session token required)</span>
        </h3>
        <EndpointTable rows={ACCOUNT_ENDPOINTS} />
      </div>
    </div>
  );
}
