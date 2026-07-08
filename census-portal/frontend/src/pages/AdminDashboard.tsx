import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, publicApi, getStoredToken, getStoredUser } from '../lib/api';
import {
  Search, Download, MapPin, Database, ChevronRight, ChevronDown, SlidersHorizontal, X,
  Pencil, Save, RefreshCw, Plus, Trash2, ShieldAlert, Key, Check, Inbox,
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
  // False only for synthetic placeholder rows (a geography with no
  // figure yet) — lets the table show every row instead of silently
  // skipping the ones with gaps, each with its own Create action.
  hasValue?: boolean;
}

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

const CENSUS_YEAR = 2026;
const PLANS = ['FREE', 'PAID'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const token = getStoredToken();
  const isAdmin = user?.user_type === 'ADMIN';
  const adminClient = token ? adminApi(token) : null;

  const [tab, setTab] = useState<'data' | 'accounts'>('data');

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
    }
  }, []);

  if (!user || !token) {
    return (
      <div className="text-center py-12">
        <p className="text-cam-muted">Please login to access the admin dashboard</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-cam-muted">Everything you can do as an admin, in one place.</p>
      </div>

      <div className="flex gap-2 border-b border-cam-line">
        <button
          onClick={() => setTab('data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'data' ? 'border-cam-yellow text-cam-yellow' : 'border-transparent text-cam-muted hover:text-white'
          }`}
        >
          Census Data
        </button>
        <button
          onClick={() => setTab('accounts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'accounts' ? 'border-cam-yellow text-cam-yellow' : 'border-transparent text-cam-muted hover:text-white'
          }`}
        >
          Accounts
        </button>
      </div>

      {tab === 'data' ? <DataTab adminClient={adminClient!} /> : <AccountsTab token={token} />}
    </div>
  );
}

// ============================================================
// DATA TAB — browse every geography level, and add/edit/delete
// data values and departments/districts/villages directly.
// ============================================================
function DataTab({ adminClient }: { adminClient: ReturnType<typeof adminApi> }) {
  const [regions, setRegions] = useState<Geography[]>([]);
  const [departments, setDepartments] = useState<Geography[]>([]);
  const [districts, setDistricts] = useState<Geography[]>([]);
  const [villages, setVillages] = useState<Geography[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [data, setData] = useState<DataValue[]>([]);
  const [filteredData, setFilteredData] = useState<DataValue[]>([]);

  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('POP_TOT');
  const [selectedYear] = useState<number>(CENSUS_YEAR);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [indicatorSearch, setIndicatorSearch] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentLevel, setCurrentLevel] = useState<'region' | 'department' | 'district' | 'village'>('region');
  const [currentGeographyCode, setCurrentGeographyCode] = useState<string>('');
  const [currentGeographyName, setCurrentGeographyName] = useState<string>('');

  // Inline editing an existing value
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string>('');

  // Inline creating a value for a row that has none yet
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [createValue, setCreateValue] = useState<string>('');
  const [savingCreateKey, setSavingCreateKey] = useState<string | null>(null);

  // Adding a department/district/village
  const [addingLevel, setAddingLevel] = useState<'department' | 'district' | 'village' | null>(null);
  const [newGeoCode, setNewGeoCode] = useState<string>('');
  const [newGeoName, setNewGeoName] = useState<string>('');
  const [newGeoPopulation, setNewGeoPopulation] = useState<string>('');
  const [addingGeo, setAddingGeo] = useState<boolean>(false);
  const [addGeoError, setAddGeoError] = useState<string>('');

  // Regions/indicators aren't admin-scoped resources — reuse the
  // public endpoints for the reference lists, then browse/edit
  // everything below region level via the admin API.
  useEffect(() => {
    const loadRefLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const [regionsRes, indicatorsRes] = await Promise.all([publicApi.getRegions(), publicApi.getIndicators()]);
        const regionList: Geography[] = regionsRes.data.data || [];
        setRegions(regionList);
        setIndicators(indicatorsRes.data.data || []);

        if (regionList.length > 0) {
          const defaultRegion = regionList[0];
          setSelectedRegion(defaultRegion.code);
          setCurrentGeographyCode(defaultRegion.code);
          setCurrentGeographyName(defaultRegion.name);
          await loadDepartments(defaultRegion.code);
          await loadData(defaultRegion.code, 'POP_TOT', CENSUS_YEAR, defaultRegion.name, 'region');
        }
      } catch (err) {
        console.error('Failed to load reference lists:', err);
        setError('Failed to load data. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };
    loadRefLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDepartments = async (regionCode: string) => {
    try {
      const response = await adminClient.getDepartments(regionCode);
      setDepartments(response.data.data || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]);
    }
  };

  const loadDistricts = async (deptCode: string) => {
    try {
      const response = await adminClient.getDistricts(deptCode);
      setDistricts(response.data.data || []);
    } catch (err) {
      console.error('Failed to load districts:', err);
      setDistricts([]);
    }
  };

  const loadVillages = async (districtCode: string): Promise<Geography[]> => {
    try {
      const response = await adminClient.getVillages(districtCode);
      const list: Geography[] = response.data.data || [];
      setVillages(list);
      return list;
    } catch (err) {
      console.error('Failed to load villages:', err);
      setVillages([]);
      return [];
    }
  };

  // District level shows every village underneath it with its own
  // value, instead of just the district's own aggregate figure —
  // gaps (villages with no figure yet) show up as "No data" rows
  // with an inline Create action rather than silently vanishing.
  const loadVillagesData = async (villageList: Geography[], indicatorCode: string, year: number) => {
    setLoading(true);
    try {
      const results = await Promise.all(
        villageList.map(async (v): Promise<DataValue[]> => {
          try {
            const r = await adminClient.listData({ geography: v.code, indicator: indicatorCode, year, limit: 10 });
            const rows: DataValue[] = r.data.data || [];
            if (rows.length > 0) return rows;
          } catch (err) {
            console.error(`Failed to load data for village ${v.code}:`, err);
          }
          const ind = indicators.find((i) => i.code === indicatorCode);
          return [
            {
              geography_code: v.code,
              geography_name: v.name,
              geography_level: 'village',
              indicator_code: indicatorCode,
              indicator_name: ind?.name || indicatorCode,
              unit: ind?.unit || '',
              year,
              value: 0,
              hasValue: false,
            },
          ];
        })
      );
      const merged = results.flat();
      setData(merged);
      setFilteredData(merged);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (
    geographyCode: string,
    indicatorCode: string,
    year: number,
    geographyName?: string,
    level?: string
  ) => {
    setLoading(true);
    try {
      const response = await adminClient.listData({ geography: geographyCode, indicator: indicatorCode, year, limit: 100 });
      let dataValues: DataValue[] = response.data.data || [];

      if (dataValues.length === 0) {
        const ind = indicators.find((i) => i.code === indicatorCode);
        dataValues = [
          {
            geography_code: geographyCode,
            geography_name: geographyName ?? currentGeographyName,
            geography_level: level ?? currentLevel,
            indicator_code: indicatorCode,
            indicator_name: ind?.name || indicatorCode,
            unit: ind?.unit || '',
            year,
            value: 0,
            hasValue: false,
          },
        ];
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
    if (row.id == null) return;
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

  const deleteValue = async (row: DataValue) => {
    if (row.id == null) return;
    if (!window.confirm(`Delete this ${row.indicator_name} value for ${row.geography_name}? This cannot be undone.`)) {
      return;
    }
    setSavingId(row.id);
    setEditError('');
    try {
      await adminClient.deleteData(row.id);
      setData((prev) => prev.filter((d) => d.id !== row.id));
      setFilteredData((prev) => prev.filter((d) => d.id !== row.id));
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || 'Failed to delete value');
    } finally {
      setSavingId(null);
    }
  };

  const startCreateValue = (row: DataValue) => {
    setCreatingKey(row.geography_code);
    setCreateValue('');
    setEditError('');
  };

  const cancelCreateValue = () => {
    setCreatingKey(null);
    setCreateValue('');
  };

  const submitCreateValue = async (row: DataValue) => {
    if (!createValue.trim()) {
      setEditError('Value is required');
      return;
    }
    setSavingCreateKey(row.geography_code);
    setEditError('');
    try {
      const res = await adminClient.addData({
        geography_code: row.geography_code,
        indicator_code: row.indicator_code || selectedIndicator,
        year: row.year,
        value: Number(createValue),
        gender: row.gender || 'all',
        age_group: row.age_group || 'all',
      });
      const created = res.data.data;
      const apply = (d: DataValue) =>
        d.geography_code === row.geography_code ? { ...d, id: created.id, value: created.value, hasValue: true } : d;
      setData((prev) => prev.map(apply));
      setFilteredData((prev) => prev.map(apply));
      setCreatingKey(null);
      setCreateValue('');
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || 'Failed to add value');
    } finally {
      setSavingCreateKey(null);
    }
  };

  const addGeoParentCode =
    addingLevel === 'department' ? selectedRegion
    : addingLevel === 'district' ? selectedDepartment
    : addingLevel === 'village' ? selectedDistrict
    : '';

  const startAddGeo = (level: 'department' | 'district' | 'village') => {
    setAddingLevel(level);
    setNewGeoCode('');
    setNewGeoName('');
    setNewGeoPopulation('');
    setAddGeoError('');
  };

  const cancelAddGeo = () => {
    setAddingLevel(null);
    setAddGeoError('');
  };

  const submitAddGeo = async () => {
    if (!addingLevel || !addGeoParentCode) return;
    if (!newGeoCode.trim() || !newGeoName.trim()) {
      setAddGeoError('Code and name are required');
      return;
    }
    setAddingGeo(true);
    setAddGeoError('');
    try {
      await adminClient.addGeography({
        code: newGeoCode.trim().toUpperCase(),
        name: newGeoName.trim(),
        level: addingLevel,
        parent_code: addGeoParentCode,
        population: newGeoPopulation.trim() ? Number(newGeoPopulation.trim()) : undefined,
      });
      if (addingLevel === 'department') await loadDepartments(selectedRegion);
      else if (addingLevel === 'district') await loadDistricts(selectedDepartment);
      else if (addingLevel === 'village') {
        const villageList = await loadVillages(selectedDistrict);
        await loadVillagesData(villageList, selectedIndicator, selectedYear);
      }
      setAddingLevel(null);
    } catch (err: any) {
      setAddGeoError(err.response?.data?.error?.message || 'Failed to add');
    } finally {
      setAddingGeo(false);
    }
  };

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
    setAddingLevel(null);

    await loadDepartments(regionCode);
    await loadData(regionCode, selectedIndicator, selectedYear, regionName, 'region');
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
    setAddingLevel(null);

    await loadDistricts(deptCode);
    await loadData(deptCode, selectedIndicator, selectedYear, deptName, 'department');
  };

  const handleDistrictSelect = async (districtCode: string, districtName: string) => {
    setSelectedDistrict(districtCode);
    setCurrentGeographyCode(districtCode);
    setCurrentGeographyName(districtName);
    setCurrentLevel('district');
    setSelectedVillage('');
    setVillages([]);
    setAddingLevel(null);

    const villageList = await loadVillages(districtCode);
    await loadVillagesData(villageList, selectedIndicator, selectedYear);
  };

  const handleVillageSelect = async (villageCode: string, villageName: string) => {
    setSelectedVillage(villageCode);
    setCurrentGeographyCode(villageCode);
    setCurrentGeographyName(villageName);
    setCurrentLevel('village');

    await loadData(villageCode, selectedIndicator, selectedYear, villageName, 'village');
  };

  const goBack = () => {
    if (currentLevel === 'village') {
      const district = districts.find((d) => d.code === selectedDistrict);
      if (district) {
        setCurrentLevel('district');
        setCurrentGeographyCode(district.code);
        setCurrentGeographyName(district.name);
        setSelectedVillage('');
        loadVillagesData(villages, selectedIndicator, selectedYear);
      }
    } else if (currentLevel === 'district') {
      const dept = departments.find((d) => d.code === selectedDepartment);
      if (dept) {
        setCurrentLevel('department');
        setCurrentGeographyCode(dept.code);
        setCurrentGeographyName(dept.name);
        setSelectedDistrict('');
        loadData(dept.code, selectedIndicator, selectedYear, dept.name, 'department');
      }
    } else if (currentLevel === 'department') {
      const region = regions.find((r) => r.code === selectedRegion);
      if (region) {
        setCurrentLevel('region');
        setCurrentGeographyCode(region.code);
        setCurrentGeographyName(region.name);
        setSelectedDepartment('');
        loadData(region.code, selectedIndicator, selectedYear, region.name, 'region');
      }
    }
  };

  useEffect(() => {
    if (data.length === 0) {
      setFilteredData([]);
      return;
    }
    let filtered = [...data];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (d) => d.geography_name?.toLowerCase().includes(q) || d.indicator_name?.toLowerCase().includes(q)
      );
    }
    setFilteredData(filtered);
  }, [data, searchQuery]);

  useEffect(() => {
    if (!currentGeographyCode) return;
    if (currentLevel === 'district') {
      loadVillagesData(villages, selectedIndicator, selectedYear);
    } else {
      loadData(currentGeographyCode, selectedIndicator, selectedYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndicator, selectedYear]);

  const currentIndicator = indicators.find((i) => i.code === selectedIndicator);
  const totalValue = filteredData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const indicatorGroups = useMemo(() => {
    const groups: Record<string, Indicator[]> = {};
    indicators
      .filter((i) => i.name.toLowerCase().includes(indicatorSearch.toLowerCase()))
      .forEach((i) => {
        const cat = i.category || 'General';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(i);
      });
    return groups;
  }, [indicators, indicatorSearch]);

  const getBreadcrumbs = () => {
    const crumbs = [];
    const region = regions.find((r) => r.code === selectedRegion);
    if (region) crumbs.push({ name: region.name, level: 'region', code: region.code });
    if (selectedDepartment) {
      const dept = departments.find((d) => d.code === selectedDepartment);
      if (dept) crumbs.push({ name: dept.name, level: 'department', code: dept.code });
    }
    if (selectedDistrict) {
      const dist = districts.find((d) => d.code === selectedDistrict);
      if (dist) crumbs.push({ name: dist.name, level: 'district', code: dist.code });
    }
    if (selectedVillage) {
      const village = villages.find((v) => v.code === selectedVillage);
      if (village) crumbs.push({ name: village.name, level: 'village', code: village.code });
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  const handleExport = () => {
    const exportable = filteredData.filter((d) => d.hasValue !== false);
    if (exportable.length === 0) return;
    const headers = ['Geography', 'Level', 'Indicator', 'Value', 'Unit', 'Year'];
    const rows = exportable.map((d) => [d.geography_name, d.geography_level, d.indicator_name, d.value, d.unit, d.year]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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

  const renderAddGeo = (level: 'department' | 'district' | 'village', label: string) => {
    if (addingLevel !== level) {
      return (
        <button
          onClick={() => startAddGeo(level)}
          className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-xs text-cam-yellow/80 hover:text-cam-yellow hover:bg-cam-panel transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add {label}
        </button>
      );
    }
    return (
      <div className="px-2 py-2 space-y-1.5 bg-cam-ink rounded border border-cam-line mt-1">
        {addGeoError && <div className="text-xs text-cam-red">{addGeoError}</div>}
        <input
          value={newGeoCode}
          onChange={(e) => setNewGeoCode(e.target.value)}
          placeholder="Code (e.g. NEW1)"
          className="w-full bg-cam-panel border border-cam-line rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cam-green"
        />
        <input
          value={newGeoName}
          onChange={(e) => setNewGeoName(e.target.value)}
          placeholder={`${label} name`}
          className="w-full bg-cam-panel border border-cam-line rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cam-green"
        />
        <input
          value={newGeoPopulation}
          onChange={(e) => setNewGeoPopulation(e.target.value)}
          placeholder="Population (optional)"
          className="w-full bg-cam-panel border border-cam-line rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cam-green"
        />
        <div className="flex justify-end gap-2 pt-0.5">
          <button
            onClick={submitAddGeo}
            disabled={addingGeo}
            className="inline-flex items-center gap-1 text-xs bg-cam-green/20 text-cam-green border border-cam-green/30 rounded px-2 py-1 hover:bg-cam-green/30 disabled:opacity-40"
          >
            {addingGeo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
          <button
            onClick={cancelAddGeo}
            disabled={addingGeo}
            className="inline-flex items-center gap-1 text-xs bg-cam-panel text-cam-muted border border-cam-line rounded px-2 py-1 hover:text-white disabled:opacity-40"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  };

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
        <button onClick={() => window.location.reload()} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-cam-muted text-sm">
          Browse every region, department, district and village, and add, edit or delete any data value directly.
          Changes save immediately and are what the public site and NGO API integrations see next.
        </p>
        <button onClick={() => setShowSidebar(!showSidebar)} className="btn-secondary flex items-center gap-2 lg:hidden">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <aside className={`space-y-4 ${showSidebar ? 'block' : 'hidden'} lg:block`}>
          <div className="flex items-center justify-between lg:hidden">
            <span className="font-medium text-white">Filters</span>
            <button onClick={() => setShowSidebar(false)} className="text-cam-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-white font-medium text-sm">
              <MapPin className="w-4 h-4 text-cam-yellow" />
              Geography
            </div>
            <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
              {regions.map((region) => (
                <div key={region.code}>
                  <button
                    onClick={() => handleRegionSelect(region.code, region.name)}
                    className={geoRowClass(region.code === selectedRegion)}
                  >
                    <span className="truncate">{region.name}</span>
                    {region.code === selectedRegion ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
                    )}
                  </button>

                  {region.code === selectedRegion && (
                    <div className="ml-3 border-l border-cam-line pl-1">
                      {departments.length === 0 && <div className="text-xs text-cam-muted px-2 py-1">No departments</div>}
                      {departments.map((dept) => (
                        <div key={dept.code}>
                          <button
                            onClick={() => handleDepartmentSelect(dept.code, dept.name)}
                            className={geoRowClass(dept.code === selectedDepartment)}
                          >
                            <span className="truncate">{dept.name}</span>
                            {dept.code === selectedDepartment ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
                            )}
                          </button>

                          {dept.code === selectedDepartment && (
                            <div className="ml-3 border-l border-cam-line pl-1">
                              {districts.length === 0 && (
                                <div className="text-xs text-cam-muted px-2 py-1">No districts</div>
                              )}
                              {districts.map((dist) => (
                                <div key={dist.code}>
                                  <button
                                    onClick={() => handleDistrictSelect(dist.code, dist.name)}
                                    className={geoRowClass(dist.code === selectedDistrict)}
                                  >
                                    <span className="truncate">{dist.name}</span>
                                    {dist.code === selectedDistrict ? (
                                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
                                    )}
                                  </button>

                                  {dist.code === selectedDistrict && (
                                    <div className="ml-3 border-l border-cam-line pl-1">
                                      {villages.length === 0 && (
                                        <div className="text-xs text-cam-muted px-2 py-1">No villages</div>
                                      )}
                                      {villages.map((v) => (
                                        <button
                                          key={v.code}
                                          onClick={() => handleVillageSelect(v.code, v.name)}
                                          className={geoRowClass(v.code === selectedVillage)}
                                        >
                                          <span className="truncate">{v.name}</span>
                                        </button>
                                      ))}
                                      {renderAddGeo('village', 'village')}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {renderAddGeo('district', 'district')}
                            </div>
                          )}
                        </div>
                      ))}
                      {renderAddGeo('department', 'department')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

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
                    {items.map((ind) => (
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

        <div className="space-y-6 min-w-0">
          <div className="flex items-center gap-2 text-sm text-cam-muted flex-wrap">
            <button
              onClick={() => {
                const region = regions.find((r) => r.code === selectedRegion);
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
              <button onClick={goBack} className="ml-2 text-xs text-cam-muted hover:text-cam-yellow transition-colors">
                ← Back
              </button>
            )}
          </div>

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
              disabled={filteredData.every((d) => d.hasValue === false)}
              className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {editError && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/20 text-sm">{editError}</div>
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
                    <th className="text-right p-3 text-cam-muted text-xs uppercase font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cam-line">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-cam-muted">
                        <div className="flex justify-center items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-cam-green border-t-transparent"></span>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-cam-muted">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No data found for this selection
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((d, i) => {
                      const isEditingRow = d.id != null && editingId === d.id;
                      const isCreatingRow = d.id == null && creatingKey === d.geography_code;
                      return (
                        <tr key={d.id ?? `${d.geography_code}-${i}`} className="hover:bg-cam-panel/50 transition-colors">
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
                            ) : isCreatingRow ? (
                              <input
                                value={createValue}
                                onChange={(e) => setCreateValue(e.target.value)}
                                className="bg-cam-ink border border-cam-line rounded px-2 py-1 text-xs text-white w-28 text-right focus:outline-none focus:border-cam-green"
                                autoFocus
                              />
                            ) : d.hasValue === false ? (
                              <span className="text-cam-muted italic font-sans">No data</span>
                            ) : (
                              Number(d.value).toLocaleString()
                            )}
                          </td>
                          <td className="p-3 text-cam-muted text-xs">{d.unit}</td>
                          <td className="p-3 text-cam-muted">{d.year}</td>
                          <td className="p-3 text-right">
                            {d.id == null ? (
                              isCreatingRow ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => submitCreateValue(d)}
                                    disabled={savingCreateKey === d.geography_code}
                                    className="inline-flex items-center gap-1 text-xs bg-cam-green/20 text-cam-green border border-cam-green/30 rounded-lg px-2 py-1 hover:bg-cam-green/30 disabled:opacity-40"
                                  >
                                    {savingCreateKey === d.geography_code ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelCreateValue}
                                    disabled={savingCreateKey === d.geography_code}
                                    className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white disabled:opacity-40"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startCreateValue(d)}
                                  className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white hover:border-cam-green/40"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add
                                </button>
                              )
                            ) : isEditingRow ? (
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
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => startEditValue(d)}
                                  className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-white hover:border-cam-yellow/40"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteValue(d)}
                                  disabled={savingId === d.id}
                                  className="inline-flex items-center gap-1 text-xs bg-cam-ink text-cam-muted border border-cam-line rounded-lg px-2 py-1 hover:text-cam-red hover:border-cam-red/40 disabled:opacity-40"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-cam-line flex justify-between items-center text-xs text-cam-muted">
              <span>
                Showing {filteredData.length} of {data.length} records
              </span>
              <span className="text-cam-yellow">{currentLevel === 'district' ? 'village' : currentLevel} level data</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNTS TAB — user plans and upgrade requests.
// ============================================================
function AccountsTab({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [requests, setRequests] = useState<UpgradeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const client = adminApi(token);
      const [usersRes, requestsRes] = await Promise.all([client.listUsers(), client.listUpgradeRequests()]);
      setUsers(usersRes.data.data || []);
      setRequests(requestsRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveRequest = async (req: UpgradeRequestRow, action: 'approve' | 'reject') => {
    setResolvingId(req.id);
    setError('');
    setSuccess('');
    try {
      await adminApi(token).resolveUpgradeRequest(req.id, action);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (action === 'approve') {
        setUsers((prev) => prev.map((u) => (u.id === req.user_id ? { ...u, plan: req.requested_plan } : u)));
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-cam-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-cam-muted text-sm">
        Grant or revoke plan upgrades. Upgrading a user's plan raises how many active API keys they may hold.
      </p>

      {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/20">{error}</div>}
      {success && <div className="bg-green-500/20 text-green-400 p-3 rounded-lg border border-green-500/20">{success}</div>}

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
                    <td className="p-3 text-cam-muted text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
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
                    {savingId === u.id && <RefreshCw className="w-3 h-3 inline-block ml-2 animate-spin text-cam-muted" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <div className="text-center py-8 text-cam-muted">No accounts found</div>}
      </div>
    </div>
  );
}
