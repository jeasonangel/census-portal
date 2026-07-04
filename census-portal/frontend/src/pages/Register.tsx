import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, setStoredApiKey, setStoredToken, setStoredUser } from '../lib/api';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    organization: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.register(
        form.email,
        form.password,
        form.full_name,
        form.organization
      );

      const { user, api_key, token } = response.data.data;

      setStoredUser(user);
      setStoredApiKey(api_key);
      setStoredToken(token);
      setCreatedApiKey(api_key);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdApiKey) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card">
          <h1 className="text-2xl font-bold mb-2 text-white">Account Created</h1>
          <p className="text-cam-muted text-sm mb-4">
            Here is your API key. Copy it now — it will{' '}
            <span className="text-cam-yellow font-medium">not</span> be shown again.
          </p>

          <div className="bg-cam-ink p-3 rounded-lg border border-cam-line mb-4">
            <code className="text-sm text-cam-green break-all font-mono">{createdApiKey}</code>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCopy} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => navigate('/api-keys')} className="btn-secondary">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Create Account</h1>
        <p className="text-cam-muted text-sm mb-6">
          Register to get your API key and start building.
        </p>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              name="full_name"
              className="input"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              name="email"
              className="input"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label">Organization (Optional)</label>
            <input
              type="text"
              name="organization"
              className="input"
              value={form.organization}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="input pr-10"
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cam-muted hover:text-white"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-cam-muted text-xs mt-1">Minimum 8 characters</p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-cam-muted text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-cam-yellow hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
