import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getStoredToken, getStoredUser } from '../lib/api';
import { ShieldAlert, RefreshCw, Users, Key, Check, X, Inbox } from 'lucide-react';

interface AdminUserRow {
  id: number;
  email: string;
  full_name: string;
  user_type: string;
  plan: string;
  monthly_limit: number;
  requests_used: number;
  is_active: boolean;
  created_at: string;
  active_api_keys: string | number;
}

interface UpgradeRequestRow {
  id: number;
  requested_plan: string;
  status: string;
  created_at: string;
  user_id: number;
  email: string;
  full_name: string;
  current_plan: string;
}

const PLANS = ['FREE', 'PAID'];

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [requests, setRequests] = useState<UpgradeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const user = getStoredUser();
  const token = getStoredToken();
  const isAdmin = user?.user_type === 'ADMIN';

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const client = adminApi(token);
      const [usersRes, requestsRes] = await Promise.all([
        client.listUsers(),
        client.listUpgradeRequests(),
      ]);
      setUsers(usersRes.data.data || []);
      setRequests(requestsRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveRequest = async (req: UpgradeRequestRow, action: 'approve' | 'reject') => {
    if (!token) return;
    setResolvingId(req.id);
    setError('');
    setSuccess('');
    try {
      await adminApi(token).resolveUpgradeRequest(req.id, action);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (action === 'approve') {
        setUsers((prev) =>
          prev.map((u) => (u.id === req.user_id ? { ...u, plan: req.requested_plan } : u))
        );
      }
      setSuccess(
        action === 'approve'
          ? `Approved: ${req.email} moved to ${req.requested_plan}`
          : `Rejected upgrade request from ${req.email}`
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to resolve request');
    } finally {
      setResolvingId(null);
    }
  };

  const handlePlanChange = async (id: number, plan: string) => {
    if (!token) return;
    setSavingId(id);
    setError('');
    setSuccess('');
    try {
      await adminApi(token).updatePlan(id, plan);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, plan } : u)));
      setSuccess(`Updated plan for user #${id} to ${plan}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update plan');
    } finally {
      setSavingId(null);
    }
  };

  if (!user || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-cam-muted">Please login to access the admin panel</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card max-w-md mx-auto mt-12 text-center py-10">
        <ShieldAlert className="w-10 h-10 mx-auto text-cam-red mb-3" />
        <h1 className="text-xl font-bold text-white">Admin access required</h1>
        <p className="text-cam-muted text-sm mt-2">
          Your account doesn't have permission to view this page.
        </p>
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
      <div className="flex items-center gap-2">
        <Users className="w-6 h-6 text-cam-yellow" />
        <div>
          <h1 className="text-2xl font-bold">Admin: Accounts</h1>
          <p className="text-cam-muted text-sm">
            Grant or revoke plan upgrades. Upgrading a user's plan raises how many active API keys they may hold.
          </p>
        </div>
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

      <div className="card overflow-hidden p-0">
        <div className="flex items-center gap-2 p-4 border-b border-cam-line">
          <Inbox className="w-4 h-4 text-cam-yellow" />
          <h2 className="font-bold">Pending Upgrade Requests</h2>
          {requests.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cam-yellow/20 text-cam-yellow border border-cam-yellow/30">
              {requests.length}
            </span>
          )}
        </div>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-cam-muted text-sm">No pending requests</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cam-ink">
                <tr>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">User</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Current Plan</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Requested Plan</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Submitted</th>
                  <th className="text-right p-3 text-cam-muted text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cam-line">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-cam-panel/50 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-white">{r.full_name || '—'}</div>
                      <div className="text-cam-muted text-xs">{r.email}</div>
                    </td>
                    <td className="p-3 text-cam-muted text-xs">{r.current_plan}</td>
                    <td className="p-3 text-cam-yellow text-xs font-medium">{r.requested_plan}</td>
                    <td className="p-3 text-cam-muted text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleResolveRequest(r, 'approve')}
                          disabled={resolvingId === r.id}
                          className="inline-flex items-center gap-1 text-xs bg-cam-green/20 text-cam-green border border-cam-green/30 rounded-lg px-2 py-1 hover:bg-cam-green/30 disabled:opacity-40"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleResolveRequest(r, 'reject')}
                          disabled={resolvingId === r.id}
                          className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg px-2 py-1 hover:bg-red-500/30 disabled:opacity-40"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cam-ink">
              <tr>
                <th className="text-left p-3 text-cam-muted text-xs uppercase">User</th>
                <th className="text-left p-3 text-cam-muted text-xs uppercase">Role</th>
                <th className="text-left p-3 text-cam-muted text-xs uppercase">Plan</th>
                <th className="text-left p-3 text-cam-muted text-xs uppercase">Quota Used</th>
                <th className="text-center p-3 text-cam-muted text-xs uppercase">Active Keys</th>
                <th className="text-center p-3 text-cam-muted text-xs uppercase">Status</th>
                <th className="text-right p-3 text-cam-muted text-xs uppercase">Upgrade / Downgrade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cam-line">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-cam-panel/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-white">{u.full_name || '—'}</div>
                    <div className="text-cam-muted text-xs">{u.email}</div>
                  </td>
                  <td className="p-3 text-cam-muted text-xs">{u.user_type}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${
                        u.plan === 'PAID'
                          ? 'bg-cam-green/20 text-cam-green border-cam-green/30'
                          : 'bg-cam-ink text-cam-muted border-cam-line'
                      }`}
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="p-3 text-cam-muted text-xs">
                    {u.requests_used.toLocaleString()} / {u.monthly_limit.toLocaleString()}
                  </td>
                  <td className="p-3 text-center text-cam-muted text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Key className="w-3 h-3" /> {u.active_api_keys}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {u.is_active ? (
                      <span className="text-emerald-400 text-xs">Active</span>
                    ) : (
                      <span className="text-red-400 text-xs">Disabled</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <select
                      value={u.plan}
                      disabled={savingId === u.id || u.user_type === 'ADMIN'}
                      onChange={(e) => handlePlanChange(u.id, e.target.value)}
                      className="bg-cam-ink border border-cam-line rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cam-green disabled:opacity-40"
                      title={u.user_type === 'ADMIN' ? 'Admins are exempt from plan limits' : 'Change plan'}
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {savingId === u.id && (
                      <RefreshCw className="w-3 h-3 inline-block ml-2 animate-spin text-cam-muted" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-8 text-cam-muted">No accounts found</div>
        )}
      </div>
    </div>
  );
}
