import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi, getStoredToken, getStoredUser } from '../lib/api';
import { ArrowUpCircle, Check, Clock, RefreshCw, Sparkles } from 'lucide-react';

interface Usage {
  plan: string;
}

interface UpgradeRequest {
  id: number;
  requested_plan: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

const PLANS = [
  {
    key: 'FREE',
    label: 'Free',
    tagline: 'For trying things out',
    features: ['1 active API key', 'Standard monthly request quota', 'Community support'],
  },
  {
    key: 'PAID',
    label: 'Paid',
    tagline: 'For production integrations',
    features: ['Up to 10 active API keys', 'Standard monthly request quota', 'Priority support'],
  },
];

export default function UpgradePlan() {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      const [usageRes, requestRes] = await Promise.all([
        client.getUsage(),
        client.getUpgradeRequest(),
      ]);
      setUsage(usageRes.data.data);
      setRequest(requestRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load plan information');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (plan: string) => {
    if (!token) return;
    setError('');
    setSuccess('');
    setRequesting(plan);
    try {
      const res = await accountApi(token).requestUpgrade(plan);
      setRequest(res.data.data);
      setSuccess(`Your request to move to the ${plan} plan has been sent to an admin for review.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit upgrade request');
    } finally {
      setRequesting(null);
    }
  };

  if (!user || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-cam-muted">Please login to manage your plan</p>
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

  const currentPlan = usage?.plan || 'FREE';
  const pending = request?.status === 'PENDING' ? request : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="w-6 h-6 text-cam-yellow" />
        <div>
          <h1 className="text-2xl font-bold">Upgrade Plan</h1>
          <p className="text-cam-muted text-sm">
            Choose a plan and request an upgrade. An admin reviews every request before it takes effect.
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

      {pending && (
        <div className="flex items-start gap-3 bg-cam-ink border border-cam-line rounded-lg p-4">
          <Clock className="w-5 h-5 text-cam-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-white text-sm font-medium">
              Your request to move to the {pending.requested_plan} plan is pending admin review.
            </p>
            <p className="text-cam-muted text-sm mt-1">
              Submitted {new Date(pending.created_at).toLocaleString()}. You'll be able to request another
              change once this one is resolved.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANS.map((p) => {
          const isCurrent = p.key === currentPlan;
          const disabled = isCurrent || !!pending || requesting === p.key;

          return (
            <div
              key={p.key}
              className={`card flex flex-col ${isCurrent ? 'border-cam-green' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-lg">{p.label}</h3>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-cam-green/20 text-cam-green border border-cam-green/30">
                    <Sparkles className="w-3 h-3" /> Current plan
                  </span>
                )}
              </div>
              <p className="text-cam-muted text-sm mb-4">{p.tagline}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-cam-green shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleRequest(p.key)}
                disabled={disabled}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {requesting === p.key ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpCircle className="w-4 h-4" />
                )}
                {isCurrent ? 'Current plan' : requesting === p.key ? 'Requesting...' : `Request ${p.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
