import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi, getStoredToken, getStoredUser } from '../lib/api';
import { Key, Copy, Check, Trash2, RefreshCw, XCircle, Plus, Lock, Sparkles } from 'lucide-react';

interface ApiKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
}

interface Usage {
  monthly_limit: number;
  requests_used: number;
  remaining: number;
  percentage_used: number;
  is_unlimited: boolean;
  plan: string;
  api_keys_used: number;
  api_keys_limit: number; // -1 means unlimited (admin)
}

export default function ApiKeyManager() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);

  const user = getStoredUser();
  const token = getStoredToken();

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }
    if (user.user_type === 'ADMIN') {
      navigate('/admin');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const client = accountApi(token);
      const [keysRes, usageRes] = await Promise.all([
        client.getKeys(),
        client.getUsage(),
      ]);
      setKeys(keysRes.data.data || []);
      setUsage(usageRes.data.data);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.response?.data?.error?.message || 'Failed to load your API keys. Please try signing in again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    setError('');
    setSuccess('');

    if (!newKeyName.trim()) {
      setError('Key name is required');
      return;
    }
    if (!token) return;

    setCreating(true);
    try {
      const client = accountApi(token);
      const response = await client.createKey(newKeyName.trim());
      const { api_key, name } = response.data.data;
      setNewKeyValue(api_key);
      setShowModal(true);
      setCopied(false);
      setSuccess(`Key "${name}" created successfully!`);
      setNewKeyName('');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"?`)) return;
    if (!token) return;

    setError('');
    setSuccess('');
    try {
      const client = accountApi(token);
      await client.deleteKey(id);
      setSuccess(`Key "${name}" revoked successfully`);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to revoke key');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setSuccess('Copied to clipboard!');
  };

  const closeModal = () => {
    setShowModal(false);
    setNewKeyValue('');
    setCopied(false);
  };

  const atKeyLimit = !!usage && usage.api_keys_limit !== -1 && usage.api_keys_used >= usage.api_keys_limit;

  if (!user || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-cam-muted">Please login to manage API keys</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-cam-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Key Management</h1>
        <p className="text-cam-muted text-sm">
          Manage your API keys. Keys are shown only once on creation.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 text-green-400 p-3 rounded-lg border border-green-500/20">
          {success}
        </div>
      )}

      {/* Usage Card */}
      {usage && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Usage Statistics</h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-cam-ink text-cam-yellow border border-cam-line">
              {usage.plan === 'FREE' ? <Lock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {usage.plan} plan · {usage.api_keys_limit === -1 ? 'unlimited' : usage.api_keys_limit} key{usage.api_keys_limit === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-cam-muted">Monthly Limit</div>
              <div className="text-xl font-bold text-white">
                {usage.is_unlimited ? 'Unlimited' : usage.monthly_limit.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Used</div>
              <div className="text-xl font-bold text-cam-yellow">
                {usage.requests_used.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Remaining</div>
              <div className="text-xl font-bold text-cam-green">
                {usage.remaining >= 0 ? usage.remaining.toLocaleString() : 'Unlimited'}
              </div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Usage</div>
              <div className="text-xl font-bold text-white">
                {usage.percentage_used.toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 bg-cam-ink rounded-full overflow-hidden">
            <div
              className="h-full bg-cam-green transition-all"
              style={{ width: `${Math.min(100, usage.percentage_used)}%` }}
            />
          </div>
        </div>
      )}

      {/* Create Key Form */}
      <div className="card">
        <h3 className="font-bold mb-3">Create New API Key</h3>
        {atKeyLimit ? (
          <div className="flex items-start gap-3 bg-cam-ink border border-cam-line rounded-lg p-4">
            <Lock className="w-5 h-5 text-cam-yellow shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium">
                You've used all {usage!.api_keys_limit} key{usage!.api_keys_limit === 1 ? '' : 's'} available to your account.
              </p>
              <p className="text-cam-muted text-sm mt-1">
                Every account is limited to one active API key — one website only ever needs one. Revoke your
                existing key above to create a new one.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Key name (e.g. Production App)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
              className="input flex-1"
            />
            <button
              onClick={handleCreateKey}
              disabled={creating}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        )}
      </div>

      {/* Keys Table */}
      <div className="card overflow-hidden">
        {keys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 mx-auto text-cam-muted opacity-30 mb-3" />
            <p className="text-cam-muted">No API keys created yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cam-ink">
                <tr>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Name</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Prefix</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Created</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Last Used</th>
                  <th className="text-center p-3 text-cam-muted text-xs uppercase">Status</th>
                  <th className="text-right p-3 text-cam-muted text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-cam-line">
                    <td className="p-3 font-medium text-white">{k.name}</td>
                    <td className="p-3">
                      <code className="text-xs text-cam-yellow bg-cam-ink px-2 py-1 rounded">
                        {k.key_prefix}…
                      </code>
                    </td>
                    <td className="p-3 text-cam-muted text-xs">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-cam-muted text-xs">
                      {k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-3 text-center">
                      {k.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                          <XCircle className="w-3 h-3" /> Revoked
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {k.is_active && (
                        <button
                          onClick={() => handleRevokeKey(k.id, k.name)}
                          className="text-cam-muted hover:text-cam-red transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Key Display Modal */}
      {showModal && newKeyValue && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-cam-panel border border-cam-line rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-2">Your API Key</h2>
            <p className="text-cam-muted text-sm mb-4">
              This is your API key. It will <span className="text-cam-yellow font-medium">not</span> be shown again.
            </p>
            <div className="bg-cam-ink p-3 rounded-lg border border-cam-line mb-4">
              <code className="text-sm text-cam-green break-all font-mono">{newKeyValue}</code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={closeModal} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
