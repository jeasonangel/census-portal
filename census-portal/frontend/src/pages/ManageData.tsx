import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi, getStoredToken, getStoredUser } from '../lib/api';
import { ShieldAlert, RefreshCw, Pencil, Save, X, Search, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

interface DataRow {
  id: number;
  geography_code: string;
  geography_name: string;
  indicator_code: string;
  indicator_name: string;
  unit: string;
  year: number;
  value: string | number;
  gender: string;
  age_group: string;
  source: string | null;
  last_updated: string;
}

interface EditState {
  year: string;
  value: string;
  gender: string;
  age_group: string;
  source: string;
}

const PAGE_SIZE = 25;

export default function ManageData() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [geography, setGeography] = useState('');
  const [indicator, setIndicator] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const user = getStoredUser();
  const token = getStoredToken();
  const isAdmin = user?.user_type === 'ADMIN';

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }
    if (!isAdmin) return;
    fetchData(1);
  }, []);

  const fetchData = async (targetPage: number) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApi(token).listData({
        geography: geography.trim() || undefined,
        indicator: indicator.trim() || undefined,
        year: year.trim() ? Number(year.trim()) : undefined,
        search: search.trim() || undefined,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setRows(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
      setPage(targetPage);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    fetchData(1);
  };

  const startEdit = (row: DataRow) => {
    setEditingId(row.id);
    setEditState({
      year: String(row.year),
      value: String(row.value),
      gender: row.gender,
      age_group: row.age_group,
      source: row.source || '',
    });
    setSuccess('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const handleSave = async (row: DataRow) => {
    if (!token || !editState) return;
    setSavingId(row.id);
    setError('');
    setSuccess('');
    try {
      const res = await adminApi(token).updateData(row.id, {
        year: Number(editState.year),
        value: Number(editState.value),
        gender: editState.gender.trim() || 'all',
        age_group: editState.age_group.trim() || 'all',
        source: editState.source.trim(),
      });
      const updated = res.data.data;
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                year: updated.year,
                value: updated.value,
                gender: updated.gender,
                age_group: updated.age_group,
                source: updated.source,
                last_updated: updated.last_updated,
              }
            : r
        )
      );
      setSuccess(`Updated ${row.geography_name} / ${row.indicator_name} (${row.year}) — live on the public and API endpoints now.`);
      setEditingId(null);
      setEditState(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save changes');
    } finally {
      setSavingId(null);
    }
  };

  if (!user || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-cam-muted">Please login to access this page</p>
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Pencil className="w-6 h-6 text-cam-yellow" />
          <div>
            <h1 className="text-2xl font-bold">Admin: Manage Data</h1>
            <p className="text-cam-muted text-sm">
              Find and correct a single data value. Changes save immediately and are what NGO
              websites and API integrations see on their next request — no re-import needed.
            </p>
          </div>
        </div>
        <Link to="/admin/import" className="btn-secondary flex items-center gap-2 text-sm shrink-0">
          <Upload className="w-4 h-4" />
          Bulk CSV Import
        </Link>
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

      <form onSubmit={handleSearchSubmit} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-cam-muted mb-1">Geography code</label>
          <input
            value={geography}
            onChange={(e) => setGeography(e.target.value)}
            placeholder="e.g. CE"
            className="bg-cam-ink border border-cam-line rounded-lg px-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-cam-green"
          />
        </div>
        <div>
          <label className="block text-xs text-cam-muted mb-1">Indicator code</label>
          <input
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            placeholder="e.g. POP_TOT"
            className="bg-cam-ink border border-cam-line rounded-lg px-3 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-cam-green"
          />
        </div>
        <div>
          <label className="block text-xs text-cam-muted mb-1">Year</label>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2026"
            className="bg-cam-ink border border-cam-line rounded-lg px-3 py-1.5 text-sm text-white w-24 focus:outline-none focus:border-cam-green"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-cam-muted mb-1">Search name</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Region or indicator name"
            className="bg-cam-ink border border-cam-line rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-cam-green"
          />
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
          <Search className="w-4 h-4" />
          Search
        </button>
      </form>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <RefreshCw className="w-8 h-8 animate-spin text-cam-green" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cam-ink">
                <tr>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Geography</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Indicator</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Year</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Gender</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Age group</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Value</th>
                  <th className="text-left p-3 text-cam-muted text-xs uppercase">Source</th>
                  <th className="text-right p-3 text-cam-muted text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cam-line">
                {rows.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-cam-panel/50 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-white">{row.geography_name}</div>
                        <div className="text-cam-muted text-xs">{row.geography_code}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-white">{row.indicator_name}</div>
                        <div className="text-cam-muted text-xs">
                          {row.indicator_code} ({row.unit})
                        </div>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editState!.year}
                            onChange={(e) => setEditState({ ...editState!, year: e.target.value })}
                            className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-cam-green"
                          />
                        ) : (
                          <span className="text-cam-muted">{row.year}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editState!.gender}
                            onChange={(e) => setEditState({ ...editState!, gender: e.target.value })}
                            className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-cam-green"
                          />
                        ) : (
                          <span className="text-cam-muted">{row.gender}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editState!.age_group}
                            onChange={(e) => setEditState({ ...editState!, age_group: e.target.value })}
                            className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-24 focus:outline-none focus:border-cam-green"
                          />
                        ) : (
                          <span className="text-cam-muted">{row.age_group}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editState!.value}
                            onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                            className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-28 focus:outline-none focus:border-cam-green"
                          />
                        ) : (
                          <span className="font-medium text-white">{row.value}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={editState!.source}
                            onChange={(e) => setEditState({ ...editState!, source: e.target.value })}
                            className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-32 focus:outline-none focus:border-cam-green"
                          />
                        ) : (
                          <span className="text-cam-muted text-xs">{row.source || '—'}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSave(row)}
                              disabled={savingId === row.id}
                              className="inline-flex items-center gap-1 text-xs bg-cam-green/20 text-cam-green border border-cam-green/30 rounded-lg px-2 py-1 hover:bg-cam-green/30 disabled:opacity-40"
                            >
                              {savingId === row.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingId === row.id}
                              className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white disabled:opacity-40"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white hover:border-cam-yellow/40"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="text-center py-8 text-cam-muted">No matching data values found</div>
            )}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-cam-line text-xs text-cam-muted">
            <span>
              {total} record{total === 1 ? '' : 's'} — page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 bg-cam-ink border border-cam-line rounded-lg px-2 py-1 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </button>
              <button
                onClick={() => fetchData(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 bg-cam-ink border border-cam-line rounded-lg px-2 py-1 hover:text-white disabled:opacity-30"
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
