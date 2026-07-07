import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { publicApi, protectedApi, adminApi, getStoredApiKey, getStoredToken, getStoredUser } from '../lib/api';
import {
  Search, Download, MapPin, Database, ChevronRight, ChevronDown,
  Info, SlidersHorizontal, X, Key, Lock, Pencil, Save, RefreshCw, ShieldCheck,
} from 'lucide-react';

interface Geography {
  code: string;
  name: string;
  level: string;
  population?: number;
  parent_id?: number;
}

interface Indicator {
  code: string;
  name: string;
  unit: string;
  category: string;
}

interface DataValue {
  id?: number;
  geography_code: string;
  geography_name: string;
  geography_level: string;
  indicator_code?: string;
  indicator_name: string;
  unit: string;
  year: number;
  value: number;
  gender?: string;
  age_group?: string;
  source?: string | null;
}

const CENSUS_YEAR = 2026;

export default function DataExplorer() {
  // ============================================================
  // STATE
  // ============================================================
  const [regions, setRegions] = useState<Geography[]>([]);
  const [departments, setDepartments] = useState<Geography[]>([]);
  const [districts, setDistricts] = useState<Geography[]>([]);
  const [villages, setVillages] = useState<Geography[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [data, setData] = useState<DataValue[]>([]);
  const [filteredData, setFilteredData] = useState<DataValue[]>([]);

  // Selected filters
  const [selectedRegion, setSelectedRegion] = useState<string>('CE');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('POP_TOT');
  const [selectedYear] = useState<number>(CENSUS_YEAR);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [indicatorSearch, setIndicatorSearch] = useState<string>('');
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);

  // Loading and error
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inline editing (admin only)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string>('');

  // Current level
  const [currentLevel, setCurrentLevel] = useState<'region' | 'department' | 'district' | 'village'>('region');
  const [currentGeographyCode, setCurrentGeographyCode] = useState<string>('CE');
  const [currentGeographyName, setCurrentGeographyName] = useState<string>('Centre');

  // Department/district/village drill-down normally requires an API
  // key — the public API only serves region-level data. An admin is
  // signed in with a JWT already, so they get full-hierarchy browsing
  // (and inline editing) without needing to also hold a personal key.
  const user = getStoredUser();
  const token = getStoredToken();
  const isAdmin = user?.user_type === 'ADMIN';
  const adminClient = isAdmin && token ? adminApi(token) : null;
  const canBrowseHierarchy = !!adminClient || !!getStoredApiKey();

  const apiKey = getStoredApiKey();
  const client = apiKey ? protectedApi(apiKey) : null;

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [regionsRes, indicatorsRes] = await Promise.all([
          publicApi.getRegions(),
          publicApi.getIndicators(),
        ]);
        setRegions(regionsRes.data.data || []);
        setIndicators(indicatorsRes.data.data || []);

        if (regionsRes.data.data?.length > 0) {
          const defaultRegion = regionsRes.data.data[0];
          setSelectedRegion(defaultRegion.code);
          setCurrentGeographyCode(defaultRegion.code);
          setCurrentGeographyName(defaultRegion.name);
          await loadDepartments(defaultRegion.code);
          await loadData(defaultRegion.code, 'POP_TOT', CENSUS_YEAR);
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
        setError('Failed to load data. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadDepartments = async (regionCode: string) => {
    const source = adminClient || client;
    if (!source) {
      setDepartments([]);
      return;
    }
    try {
      const response = await source.getDepartments(regionCode);
      setDepartments(response.data.data || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]);
    }
  };

  const loadDistricts = async (deptCode: string) => {
    const source = adminClient || client;
    if (!source) {
      setDistricts([]);
      return;
    }
    try {
      const response = await source.getDistricts(deptCode);
      setDistricts(response.data.data || []);
    } catch (err) {
      console.error('Failed to load districts:', err);
      setDistricts([]);
    }
  };

  const loadVillages = async (districtCode: string) => {
    const source = adminClient || client;
    if (!source) {
      setVillages([]);
      return;
    }
    try {
      const response = await source.getVillages(districtCode);
      setVillages(response.data.data || []);
    } catch (err) {
      console.error('Failed to load villages:', err);
      setVillages([]);
    }
  };

  const loadData = async (geographyCode: string, indicatorCode: string, year: number) => {
    setLoading(true);
    try {
      let dataValues: DataValue[];
      if (adminClient) {
        // Admin path: same query the Manage Data page uses, which
        // includes each row's id — that id is what makes the table
        // below editable instead of just a read-only view.
        const response = await adminClient.listData({
          geography: geographyCode,
          indicator: indicatorCode,
          year,
          limit: 100,
        });
        dataValues = response.data.data || [];
      } else {
        const response = client
          ? await client.getData(geographyCode, indicatorCode, year)
          : await publicApi.getData(geographyCode, indicatorCode, year);
        dataValues = response.data.data || [];
      }
      setData(dataValues);
      setFilteredData(dataValues);
    } catch (err) {
      console.error('Failed to load data:', err);
      setData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const startEditValue = (row: DataValue) => {
    if (row.id == null) return;
    setEditingId(row.id);
    setEditValue(String(row.value));
    setEditError('');
  };

  const cancelEditValue = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEditValue = async (row: DataValue) => {
    if (!adminClient || row.id == null) return;
    setSavingId(row.id);
    setEditError('');
    try {
      const res = await adminClient.updateData(row.id, { value: Number(editValue) });
      const updatedValue = res.data.data.value;
      setData((prev) => prev.map((d) => (d.id === row.id ? { ...d, value: updatedValue } : d)));
      setFilteredData((prev) => prev.map((d) => (d.id === row.id ? { ...d, value: updatedValue } : d)));
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || 'Failed to save changes');
    } finally {
      setSavingId(null);
    }
  };

  // ============================================================
  // HANDLE NAVIGATION
  // ============================================================

  const handleRegionSelect = async (regionCode: string, regionName: string) => {
    setSelectedRegion(regionCode);
    setCurrentGeographyCode(regionCode);
    setCurrentGeographyName(regionName);
    setCurrentLevel('region');
    setSelectedDepartment('');
    setSelectedDistrict('');
    setSelectedVillage('');
    setDepartments([]);
    setDistricts([]);
    setVillages([]);

    await loadDepartments(regionCode);
    await loadData(regionCode, selectedIndicator, selectedYear);
  };

  const handleDepartmentSelect = async (deptCode: string, deptName: string) => {
    setSelectedDepartment(deptCode);
    setCurrentGeographyCode(deptCode);
    setCurrentGeographyName(deptName);
    setCurrentLevel('department');
    setSelectedDistrict('');
    setSelectedVillage('');
    setDistricts([]);
    setVillages([]);

    await loadDistricts(deptCode);
    await loadData(deptCode, selectedIndicator, selectedYear);
  };

  const handleDistrictSelect = async (districtCode: string, districtName: string) => {
    setSelectedDistrict(districtCode);
    setCurrentGeographyCode(districtCode);
    setCurrentGeographyName(districtName);
    setCurrentLevel('district');
    setSelectedVillage('');
    setVillages([]);

    await loadVillages(districtCode);
    await loadData(districtCode, selectedIndicator, selectedYear);
  };

  const handleVillageSelect = async (villageCode: string, villageName: string) => {
    setSelectedVillage(villageCode);
    setCurrentGeographyCode(villageCode);
    setCurrentGeographyName(villageName);
    setCurrentLevel('village');

    await loadData(villageCode, selectedIndicator, selectedYear);
  };

  const goBack = () => {
    if (currentLevel === 'village') {
      const district = districts.find(d => d.code === selectedDistrict);
      if (district) {
        setCurrentLevel('district');
        setCurrentGeographyCode(district.code);
        setCurrentGeographyName(district.name);
        setSelectedVillage('');
        loadData(district.code, selectedIndicator, selectedYear);
      }
    } else if (currentLevel === 'district') {
      const dept = departments.find(d => d.code === selectedDepartment);
      if (dept) {
        setCurrentLevel('department');
        setCurrentGeographyCode(dept.code);
        setCurrentGeographyName(dept.name);
        setSelectedDistrict('');
        loadData(dept.code, selectedIndicator, selectedYear);
      }
    } else if (currentLevel === 'department') {
      const region = regions.find(r => r.code === selectedRegion);
      if (region) {
        setCurrentLevel('region');
        setCurrentGeographyCode(region.code);
        setCurrentGeographyName(region.name);
        setSelectedDepartment('');
        loadData(region.code, selectedIndicator, selectedYear);
      }
    }
  };

  // ============================================================
  // FILTER DATA
  // ============================================================

  useEffect(() => {
    if (data.length === 0) {
      setFilteredData([]);
      return;
    }

    let filtered = [...data];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(d =>
        d.geography_name?.toLowerCase().includes(query) ||
        d.indicator_name?.toLowerCase().includes(query)
      );
    }

    if (currentLevel) {
      filtered = filtered.filter(d => d.geography_level === currentLevel);
    }

    setFilteredData(filtered);
  }, [data, searchQuery, currentLevel]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    if (currentGeographyCode) {
      loadData(currentGeographyCode, selectedIndicator, selectedYear);
    }
  }, [selectedIndicator, selectedYear]);

  useEffect(() => {
    if (selectedRegion) {
      loadDepartments(selectedRegion);
    }
  }, [selectedRegion]);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const currentIndicator = indicators.find(i => i.code === selectedIndicator);
  const totalValue = filteredData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const indicatorGroups = useMemo(() => {
    const groups: Record<string, Indicator[]> = {};
    indicators
      .filter(i => i.name.toLowerCase().includes(indicatorSearch.toLowerCase()))
      .forEach(i => {
        const cat = i.category || 'General';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(i);
      });
    return groups;
  }, [indicators, indicatorSearch]);

  const getBreadcrumbs = () => {
    const crumbs = [];
    const region = regions.find(r => r.code === selectedRegion);
    if (region) crumbs.push({ name: region.name, level: 'region', code: region.code });

    if (selectedDepartment) {
      const dept = departments.find(d => d.code === selectedDepartment);
      if (dept) crumbs.push({ name: dept.name, level: 'department', code: dept.code });
    }

    if (selectedDistrict) {
      const dist = districts.find(d => d.code === selectedDistrict);
      if (dist) crumbs.push({ name: dist.name, level: 'district', code: dist.code });
    }

    if (selectedVillage) {
      const village = villages.find(v => v.code === selectedVillage);
      if (village) crumbs.push({ name: village.name, level: 'village', code: village.code });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleExport = () => {
    if (filteredData.length === 0) return;
    const headers = ['Geography', 'Level', 'Indicator', 'Value', 'Unit', 'Year'];
    const rows = filteredData.map(d => [d.geography_name, d.geography_level, d.indicator_name, d.value, d.unit, d.year]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cameroon-census-${currentGeographyCode}-${selectedIndicator}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const geoRowClass = (active: boolean) =>
    `w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-sm transition-colors ${
      active ? 'bg-cam-green/20 text-cam-yellow font-medium' : 'text-cam-muted hover:bg-cam-panel hover:text-white'
    }`;

  // ============================================================
  // RENDER
  // ============================================================

  if (loading && regions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cam-green mx-auto"></div>
          <p className="mt-4 text-cam-muted">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <div className="text-cam-red text-lg mb-2">⚠️ Error</div>
        <p className="text-cam-muted">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Explorer</h1>
          <p className="text-cam-muted">
            Browse Cameroon census data by region, department, district and village.
          </p>
        </div>
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="btn-secondary flex items-center gap-2 lg:hidden"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* ============================================================ */}
        {/* SIDEBAR */}
        {/* ============================================================ */}
        <aside className={`space-y-4 ${showSidebar ? 'block' : 'hidden'} lg:block`}>
          <div className="flex items-center justify-between lg:hidden">
            <span className="font-medium text-white">Filters</span>
            <button onClick={() => setShowSidebar(false)} className="text-cam-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Geography Tree */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-white font-medium text-sm">
              <MapPin className="w-4 h-4 text-cam-yellow" />
              Geography
            </div>
            <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
              {regions.map(region => (
                <div key={region.code}>
                  <button
                    onClick={() => handleRegionSelect(region.code, region.name)}
                    className={geoRowClass(region.code === selectedRegion)}
                  >
                    <span className="truncate">{region.name}</span>
                    {region.code === selectedRegion
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                  </button>

                  {region.code === selectedRegion && (
                    <div className="ml-3 border-l border-cam-line pl-1">
                      {!canBrowseHierarchy ? (
                        <div className="flex items-start gap-1.5 text-xs text-cam-muted px-2 py-1.5">
                          <Lock className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>
                            <Link to="/api-keys" className="text-cam-yellow hover:underline">
                              Get an API key
                            </Link>{' '}
                            to browse departments, districts and villages.
                          </span>
                        </div>
                      ) : departments.length === 0 ? (
                        <div className="text-xs text-cam-muted px-2 py-1">No departments</div>
                      ) : null}
                      {departments.map(dept => (
                        <div key={dept.code}>
                          <button
                            onClick={() => handleDepartmentSelect(dept.code, dept.name)}
                            className={geoRowClass(dept.code === selectedDepartment)}
                          >
                            <span className="truncate">{dept.name}</span>
                            {dept.code === selectedDepartment
                              ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                          </button>

                          {dept.code === selectedDepartment && (
                            <div className="ml-3 border-l border-cam-line pl-1">
                              {districts.length === 0 && (
                                <div className="text-xs text-cam-muted px-2 py-1">No districts</div>
                              )}
                              {districts.map(dist => (
                                <div key={dist.code}>
                                  <button
                                    onClick={() => handleDistrictSelect(dist.code, dist.name)}
                                    className={geoRowClass(dist.code === selectedDistrict)}
                                  >
                                    <span className="truncate">{dist.name}</span>
                                    {dist.code === selectedDistrict
                                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                      : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                                  </button>

                                  {dist.code === selectedDistrict && (
                                    <div className="ml-3 border-l border-cam-line pl-1">
                                      {villages.length === 0 && (
                                        <div className="text-xs text-cam-muted px-2 py-1">No villages</div>
                                      )}
                                      {villages.map(v => (
                                        <button
                                          key={v.code}
                                          onClick={() => handleVillageSelect(v.code, v.name)}
                                          className={geoRowClass(v.code === selectedVillage)}
                                        >
                                          <span className="truncate">{v.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Indicators */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-white font-medium text-sm">
              <Database className="w-4 h-4 text-cam-yellow" />
              Indicators
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cam-muted" />
              <input
                type="text"
                placeholder="Search indicators..."
                value={indicatorSearch}
                onChange={(e) => setIndicatorSearch(e.target.value)}
                className="input pl-8 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {Object.entries(indicatorGroups).map(([category, items]) => (
                <div key={category}>
                  <div className="text-xs uppercase text-cam-muted font-medium mb-1 px-1">{category}</div>
                  <div className="space-y-0.5">
                    {items.map(ind => (
                      <button
                        key={ind.code}
                        onClick={() => setSelectedIndicator(ind.code)}
                        className={geoRowClass(ind.code === selectedIndicator)}
                        title={`${ind.name} (${ind.unit})`}
                      >
                        <span className="truncate">{ind.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(indicatorGroups).length === 0 && (
                <div className="text-xs text-cam-muted px-1">No indicators match "{indicatorSearch}"</div>
              )}
            </div>
          </div>

        </aside>

        {/* ============================================================ */}
        {/* MAIN */}
        {/* ============================================================ */}
        <div className="space-y-6 min-w-0">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-sm text-cam-muted flex-wrap">
            <button
              onClick={() => {
                const region = regions.find(r => r.code === selectedRegion);
                if (region) handleRegionSelect(region.code, region.name);
              }}
              className="hover:text-cam-yellow transition-colors flex items-center gap-1"
            >
              <MapPin className="w-4 h-4" />
              Home
            </button>

            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={() => {
                    if (crumb.level === 'region') handleRegionSelect(crumb.code, crumb.name);
                    else if (crumb.level === 'department') handleDepartmentSelect(crumb.code, crumb.name);
                    else if (crumb.level === 'district') handleDistrictSelect(crumb.code, crumb.name);
                    else if (crumb.level === 'village') handleVillageSelect(crumb.code, crumb.name);
                  }}
                  className={`hover:text-cam-yellow transition-colors ${
                    index === breadcrumbs.length - 1 ? 'text-cam-yellow font-medium' : 'text-cam-muted'
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}

            {currentLevel !== 'region' && (
              <button
                onClick={goBack}
                className="ml-2 text-xs text-cam-muted hover:text-cam-yellow transition-colors"
              >
                ← Back
              </button>
            )}
          </div>

          {/* Statistics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-xs text-cam-muted uppercase">Total Records</div>
              <div className="text-2xl font-bold text-white">{filteredData.length}</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-cam-muted uppercase">Total Value</div>
              <div className="text-2xl font-bold text-cam-green">
                {totalValue.toLocaleString()} {currentIndicator?.unit || ''}
              </div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-cam-muted uppercase">Current Level</div>
              <div className="text-2xl font-bold text-cam-yellow capitalize">{currentLevel}s</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs text-cam-muted uppercase">Geography</div>
              <div className="text-2xl font-bold text-white truncate" title={currentGeographyName}>
                {currentGeographyName}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cam-muted" />
              <input
                type="text"
                placeholder="Search by location or indicator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9"
              />
            </div>

            <button
              onClick={handleExport}
              disabled={filteredData.length === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Content */}
          {isAdmin && (
            <div className="flex items-start gap-2 text-xs text-cam-yellow bg-cam-yellow/10 border border-cam-yellow/20 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Admin mode — Changes save immediately
              </span>
            </div>
          )}
          {editError && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/20 text-sm">
              {editError}
            </div>
          )}

          <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cam-ink">
                    <tr>
                      <th className="text-left p-3 text-cam-muted text-xs uppercase font-medium">Geography</th>
                      <th className="text-left p-3 text-cam-muted text-xs uppercase font-medium">Level</th>
                      <th className="text-left p-3 text-cam-muted text-xs uppercase font-medium">Indicator</th>
                      <th className="text-right p-3 text-cam-muted text-xs uppercase font-medium">Value</th>
                      <th className="text-left p-3 text-cam-muted text-xs uppercase font-medium">Unit</th>
                      <th className="text-left p-3 text-cam-muted text-xs uppercase font-medium">Year</th>
                      {isAdmin && (
                        <th className="text-right p-3 text-cam-muted text-xs uppercase font-medium">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cam-line">
                    {loading ? (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-cam-muted">
                          <div className="flex justify-center items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-cam-green border-t-transparent"></span>
                            Loading...
                          </div>
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-cam-muted">
                          <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No data found for this selection
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((d, i) => {
                        const isEditingRow = isAdmin && d.id != null && editingId === d.id;
                        return (
                          <tr key={d.id ?? i} className="hover:bg-cam-panel/50 transition-colors">
                            <td className="p-3 font-medium text-white">{d.geography_name}</td>
                            <td className="p-3 text-cam-muted capitalize">{d.geography_level}</td>
                            <td className="p-3 text-cam-muted">{d.indicator_name}</td>
                            <td className="p-3 text-right font-mono text-cam-green">
                              {isEditingRow ? (
                                <input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-28 text-right focus:outline-none focus:border-cam-green"
                                  autoFocus
                                />
                              ) : (
                                Number(d.value).toLocaleString()
                              )}
                            </td>
                            <td className="p-3 text-cam-muted text-xs">{d.unit}</td>
                            <td className="p-3 text-cam-muted">{d.year}</td>
                            {isAdmin && (
                              <td className="p-3 text-right">
                                {d.id == null ? null : isEditingRow ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => saveEditValue(d)}
                                      disabled={savingId === d.id}
                                      className="inline-flex items-center gap-1 text-xs bg-cam-green/20 text-cam-green border border-cam-green/30 rounded-lg px-2 py-1 hover:bg-cam-green/30 disabled:opacity-40"
                                    >
                                      {savingId === d.id ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Save className="w-3 h-3" />
                                      )}
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditValue}
                                      disabled={savingId === d.id}
                                      className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white disabled:opacity-40"
                                    >
                                      <X className="w-3 h-3" />
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEditValue(d)}
                                    className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white hover:border-cam-yellow/40"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Edit
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2 border-t border-cam-line flex justify-between items-center text-xs text-cam-muted">
                <span>Showing {filteredData.length} of {data.length} records</span>
                <span className="text-cam-yellow">{currentLevel} level data</span>
              </div>
            </div>

          {/* About this dataset */}
          <div className="card">
            <button
              onClick={() => setShowAbout(!showAbout)}
              className="flex items-center justify-between w-full"
            >
              <span className="flex items-center gap-2 font-medium text-white">
                <Info className="w-4 h-4 text-cam-yellow" />
                About this dataset
              </span>
              {showAbout ? <ChevronDown className="w-4 h-4 text-cam-muted" /> : <ChevronRight className="w-4 h-4 text-cam-muted" />}
            </button>

            {showAbout && (
              <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="label">Source</div>
                  <div className="text-white">National Institute of Statistics, Cameroon (BUCREP)</div>
                </div>
                <div>
                  <div className="label">Indicator</div>
                  <div className="text-white">{currentIndicator?.name || '—'} {currentIndicator?.unit ? `(${currentIndicator.unit})` : ''}</div>
                </div>
                <div>
                  <div className="label flex items-center gap-1">
                    <Key className="w-3 h-3" /> Access via API
                  </div>
                  <div className="text-white">
                    This data is free to browse here. To integrate it into your own application,
                    generate a key on the <Link to="/api-keys" className="text-cam-yellow hover:underline">API Keys</Link> page.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
