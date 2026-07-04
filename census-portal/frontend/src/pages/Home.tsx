import { Link } from 'react-router-dom';
import { Search, Key, TrendingUp, MapPin } from 'lucide-react';

// Abstract data-network visualization (deliberately not a literal map):
// a central hub — the portal — connected to a node per region, with the
// two largest cities called out. Avoids claiming geographic accuracy.
const REGION_NODES = [
  { cx: 160, cy: 50, label: 'Yaoundé', featured: true },
  { cx: 224.7, cy: 71.0, color: '#FCD116' },
  { cx: 264.6, cy: 126.0, color: '#EF3340' },
  { cx: 264.6, cy: 194.0, color: '#FCD116' },
  { cx: 224.7, cy: 249.0, color: '#EF3340' },
  { cx: 160, cy: 270, label: 'Douala', featured: true },
  { cx: 95.3, cy: 249.0, color: '#FCD116' },
  { cx: 55.4, cy: 194.0, color: '#EF3340' },
  { cx: 55.4, cy: 126.0, color: '#FCD116' },
  { cx: 95.3, cy: 71.0, color: '#EF3340' },
];
const HUB = { cx: 160, cy: 160 };

function RegionsNetworkArt() {
  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-40 blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #006B3F 0%, transparent 55%), radial-gradient(circle at 65% 70%, #FCD116 0%, transparent 50%), radial-gradient(circle at 50% 90%, #EF3340 0%, transparent 45%)',
        }}
      />
      <div className="relative card overflow-hidden p-6 flex items-center justify-center">
        <svg
          viewBox="0 0 320 320"
          className="w-full max-w-[280px] h-auto"
          role="img"
          aria-label="Diagram of the census portal connecting data across all 10 regions"
        >
          <defs>
            <radialGradient id="hub-fill" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#0f8a52" />
              <stop offset="100%" stopColor="#006B3F" />
            </radialGradient>
            <pattern id="cm-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="#8ba39a" strokeOpacity="0.1" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="320" height="320" fill="url(#cm-grid)" />

          {/* Orbit ring, slowly rotating for a "live" feel */}
          <g>
            <circle
              cx={HUB.cx}
              cy={HUB.cy}
              r="110"
              fill="none"
              stroke="#2a3a33"
              strokeWidth="1.5"
              strokeDasharray="3 7"
            />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${HUB.cx} ${HUB.cy}`}
              to={`360 ${HUB.cx} ${HUB.cy}`}
              dur="60s"
              repeatCount="indefinite"
            />
          </g>

          {/* Spokes connecting each region node to the central hub */}
          {REGION_NODES.map((n, i) => (
            <line
              key={i}
              x1={HUB.cx}
              y1={HUB.cy}
              x2={n.cx}
              y2={n.cy}
              stroke={n.featured ? '#FCD116' : '#2a3a33'}
              strokeWidth={n.featured ? 2 : 1.5}
              strokeOpacity={n.featured ? 0.8 : 1}
            />
          ))}

          {/* Region nodes */}
          {REGION_NODES.map((n, i) =>
            n.featured ? (
              <g key={i}>
                <circle cx={n.cx} cy={n.cy} r="9" fill="#FFFFFF" stroke="#101815" strokeWidth="1.5" />
                <circle cx={n.cx} cy={n.cy} r="9" fill="none" stroke="#FCD116" strokeWidth="1.5">
                  <animate attributeName="r" values="9;20;9" dur="2.8s" begin={`${i * 1.4}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2.8s" begin={`${i * 1.4}s`} repeatCount="indefinite" />
                </circle>
                <text
                  x={n.cx}
                  y={n.cy < HUB.cy ? n.cy - 16 : n.cy + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#8ba39a"
                >
                  {n.label}
                </text>
              </g>
            ) : (
              <circle key={i} cx={n.cx} cy={n.cy} r="5" fill={n.color} stroke="#101815" strokeWidth="1.2" />
            )
          )}

          {/* Central hub — the portal aggregating every region's data */}
          <circle cx={HUB.cx} cy={HUB.cy} r="28" fill="url(#hub-fill)" stroke="#FCD116" strokeWidth="2" />
          <text x={HUB.cx} y={HUB.cy + 7} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#FFFFFF">
            10
          </text>
        </svg>
      </div>

      <div className="absolute -bottom-4 -left-4 card py-2 px-4 flex items-center gap-2 shadow-lg">
        <MapPin className="w-4 h-4 text-cam-yellow shrink-0" />
        <div className="text-xs">
          <div className="font-bold text-white leading-tight">10 Regions</div>
          <div className="text-cam-muted leading-tight">Nationwide coverage</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="grid md:grid-cols-2 gap-10 items-center py-12">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Cameroon Census Data
          </h1>
          <p className="text-xl text-cam-muted mt-4 max-w-2xl mx-auto md:mx-0">
            Access official census data for all regions, departments, districts, and villages.
            Free and open for everyone.
          </p>
          <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-4">
            <Link to="/explorer" className="btn-primary">
              Browse Data
            </Link>
            <Link to="/api-keys" className="btn-secondary">
              Get API Key
            </Link>
          </div>
        </div>
        <div className="px-4 md:px-0">
          <RegionsNetworkArt />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-cam-green">10</div>
          <div className="text-cam-muted text-sm">Regions</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-cam-yellow">58</div>
          <div className="text-cam-muted text-sm">Departments</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-cam-red">360</div>
          <div className="text-cam-muted text-sm">Districts</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-white">10,000+</div>
          <div className="text-cam-muted text-sm">Villages</div>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card hover:border-cam-green/30 transition-colors">
          <Search className="w-8 h-8 text-cam-green mb-3" />
          <h3 className="text-lg font-bold text-white">Explore Data</h3>
          <p className="text-cam-muted text-sm mt-2">
            Browse census data by region, department, district, or village.
            Search for any location.
          </p>
        </div>
        <div className="card hover:border-cam-green/30 transition-colors">
          <Key className="w-8 h-8 text-cam-yellow mb-3" />
          <h3 className="text-lg font-bold text-white">Get API Key</h3>
          <p className="text-cam-muted text-sm mt-2">
            Register and get your API key to integrate census data into your own applications.
          </p>
        </div>
        <div className="card hover:border-cam-green/30 transition-colors">
          <TrendingUp className="w-8 h-8 text-cam-red mb-3" />
          <h3 className="text-lg font-bold text-white">Build Apps</h3>
          <p className="text-cam-muted text-sm mt-2">
            Use our API to build applications, dashboards, and visualizations
            with real census data.
          </p>
        </div>
      </div>
    </div>
  );
}
