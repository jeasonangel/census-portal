import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi, getStoredToken, getStoredUser } from '../lib/api';
import { ShieldAlert, Upload, FileText, Download, RefreshCw, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';

interface ImportSummary {
  total_rows: number;
  valid_rows: number;
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const TEMPLATE = `geography_code,indicator_code,year,value,gender,age_group,source
CE,POP_TOT,2026,4800000,all,all,Manual Import
`;

export default function DataImport() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');

  const user = getStoredUser();
  const token = getStoredToken();
  const isAdmin = user?.user_type === 'ADMIN';

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
    }
  }, []);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError('');
    setSummary(null);
    if (!file) {
      setFileName('');
      setCsvText('');
      setRowCount(0);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setFileName(file.name);
      setCsvText(text);
      setRowCount(Math.max(0, text.trim().split('\n').length - 1));
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!token || !csvText.trim()) return;
    setUploading(true);
    setError('');
    setSummary(null);
    try {
      const res = await adminApi(token).importData(csvText);
      setSummary(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'census-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Upload className="w-6 h-6 text-cam-yellow" />
          <div>
            <h1 className="text-2xl font-bold">Admin: Import Data</h1>
            <p className="text-cam-muted text-sm">
              One-off manual CSV import — there's no live BUCREP/INS connection. Upload a CSV export
              whenever new figures need to be loaded. To fix or tweak a single existing value, use{' '}
              <Link to="/admin/data" className="text-cam-yellow hover:underline">Manage Data</Link> instead.
            </p>
          </div>
        </div>
        <Link to="/admin/data" className="btn-secondary flex items-center gap-2 text-sm shrink-0">
          <Pencil className="w-4 h-4" />
          Manage Data
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <div className="card">
        <h3 className="font-bold mb-3">Expected columns</h3>
        <p className="text-cam-muted text-sm mb-3">
          <code className="text-cam-yellow">geography_code</code>,{' '}
          <code className="text-cam-yellow">indicator_code</code>,{' '}
          <code className="text-cam-yellow">year</code>, and{' '}
          <code className="text-cam-yellow">value</code> are required — the geography and indicator
          codes must already exist in the system (this imports data values, it doesn't create new
          geographies or indicators). <code className="text-cam-yellow">gender</code>,{' '}
          <code className="text-cam-yellow">age_group</code> (default <code className="text-cam-yellow">all</code>) and{' '}
          <code className="text-cam-yellow">source</code> are optional. A row overwrites any existing
          value for the same geography + indicator + year + gender + age_group.
        </p>
        <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          Download CSV template
        </button>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Upload CSV</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-secondary flex items-center gap-2 cursor-pointer text-sm">
            <FileText className="w-4 h-4" />
            Choose file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </label>
          {fileName && (
            <span className="text-sm text-cam-muted">
              {fileName} — {rowCount} row{rowCount === 1 ? '' : 's'} detected
            </span>
          )}
          <button
            onClick={handleUpload}
            disabled={!csvText.trim() || uploading}
            className="btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            {summary.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-cam-green" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-cam-yellow" />
            )}
            <h3 className="font-bold">Import result</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-cam-muted">Total rows</div>
              <div className="text-xl font-bold text-white">{summary.total_rows}</div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Inserted</div>
              <div className="text-xl font-bold text-cam-green">{summary.inserted}</div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Updated</div>
              <div className="text-xl font-bold text-cam-yellow">{summary.updated}</div>
            </div>
            <div>
              <div className="text-sm text-cam-muted">Errors</div>
              <div className="text-xl font-bold text-cam-red">{summary.errors.length}</div>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <div className="border-t border-cam-line pt-3">
              <div className="text-sm text-cam-muted mb-2">Rows skipped:</div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {summary.errors.map((e, i) => (
                  <div key={i} className="text-xs text-cam-muted bg-cam-ink rounded px-2 py-1.5">
                    <span className="text-cam-red font-medium">Row {e.row}</span>: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
