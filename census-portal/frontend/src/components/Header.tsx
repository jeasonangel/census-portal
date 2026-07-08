import { Link, useLocation } from 'react-router-dom';
import { getStoredApiKey, getStoredUser, clearSession } from '../lib/api';

export default function Header() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const hasApiKey = !!getStoredApiKey();
  const user = getStoredUser();
  const isAdmin = user?.user_type === 'ADMIN';

  return (
    <header className="border-b border-cam-line bg-cam-panel/80 backdrop-blur sticky top-0 z-40">
      <div className="flag-bar" />
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-block w-2 h-6 bg-cam-green rounded-sm" />
          <span className="inline-block w-2 h-6 bg-cam-red rounded-sm" />
          <span className="inline-block w-2 h-6 bg-cam-yellow rounded-sm" />
          <span className="ml-2 text-white">Cameroon Census</span>
          {isAdmin && <span className="ml-1 text-cam-yellow text-sm font-normal">Admin</span>}
        </Link>

        {isAdmin ? (
          // Admin only has one page — no browsing nav, just the
          // account controls. Everything else lives on /admin itself.
          <div className="flex items-center gap-4 text-sm">
            <span className="text-cam-muted text-xs">{user.email}</span>
            <button
              onClick={() => { clearSession(); window.location.href = '/login'; }}
              className="text-cam-muted hover:text-cam-red text-xs"
            >
              Logout
            </button>
          </div>
        ) : (
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/" className={isActive('/') ? 'text-cam-yellow' : 'text-cam-muted hover:text-white'}>
              Home
            </Link>
            <Link to="/explorer" className={isActive('/explorer') ? 'text-cam-yellow' : 'text-cam-muted hover:text-white'}>
              Data Explorer
            </Link>
            <Link to="/api-keys" className={isActive('/api-keys') ? 'text-cam-yellow' : 'text-cam-muted hover:text-white'}>
              {hasApiKey ? '🔑 API Keys' : 'API Keys'}
            </Link>
            <Link to="/upgrade" className={isActive('/upgrade') ? 'text-cam-yellow' : 'text-cam-muted hover:text-white'}>
              Upgrade
            </Link>
            <Link to="/docs" className={isActive('/docs') ? 'text-cam-yellow' : 'text-cam-muted hover:text-white'}>
              Docs
            </Link>

            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-cam-muted text-xs">{user.email}</span>
                <button
                  onClick={() => { clearSession(); window.location.href = '/'; }}
                  className="text-cam-muted hover:text-cam-red text-xs"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-cam-muted hover:text-white">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm py-1.5 px-4">
                  Register
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
