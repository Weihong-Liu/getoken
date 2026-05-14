import { useEffect, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import countries from "world-atlas/countries-110m.json";

const VIEW_W = 1200;
const VIEW_H = 720;

const projection = geoMercator()
  .scale(180)
  .center([20, 28])
  .translate([VIEW_W / 2, VIEW_H / 2]);

const pather = geoPath(projection);

type Node = {
  id: string;
  label: string;
  coords: [number, number];
};

const NODES: Node[] = [
  { id: "sfo", label: "US West", coords: [-122.4194, 37.7749] },
  { id: "nyc", label: "US East", coords: [-74.006, 40.7128] },
  { id: "sao", label: "São Paulo", coords: [-46.6333, -23.5505] },
  { id: "lon", label: "London", coords: [-0.1278, 51.5074] },
  { id: "fra", label: "Frankfurt", coords: [8.6821, 50.1109] },
  { id: "dxb", label: "Dubai", coords: [55.2708, 25.2048] },
  { id: "sin", label: "Singapore", coords: [103.8198, 1.3521] },
  { id: "hkg", label: "Hong Kong", coords: [114.1694, 22.3193] },
  { id: "tyo", label: "Tokyo", coords: [139.6503, 35.6762] },
  { id: "syd", label: "Sydney", coords: [151.2093, -33.8688] },
];

const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n.coords] as const));

const ROUTES: Array<[string, string]> = [
  ["sfo", "nyc"],
  ["nyc", "lon"],
  ["lon", "fra"],
  ["fra", "dxb"],
  ["dxb", "sin"],
  ["sin", "hkg"],
  ["hkg", "tyo"],
  ["sfo", "tyo"],
  ["fra", "tyo"],
  ["sao", "nyc"],
  ["sin", "syd"],
];

function routeD(fromId: string, toId: string): string {
  return (
    pather({
      type: "LineString",
      coordinates: [NODE_MAP[fromId], NODE_MAP[toId]],
    }) ?? ""
  );
}

const KPI_POOL = [
  { label: "调用 / 秒", base: 4280, jitter: 460 },
  { label: "节点延迟 ms", base: 86, jitter: 18 },
  { label: "上游成功率", base: 99.92, jitter: 0.06, suffix: "%", digits: 2 },
  { label: "活跃地区", base: 32, jitter: 2 },
  { label: "今日缓存命中", base: 71.4, jitter: 3.8, suffix: "%", digits: 1 },
];

function formatKpi(value: number, digits = 0, suffix = ""): string {
  return (
    value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }) + suffix
  );
}

function useKpiTicker() {
  const [values, setValues] = useState(() =>
    KPI_POOL.map((k) => formatKpi(k.base, k.digits ?? 0, k.suffix ?? "")),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setValues(
        KPI_POOL.map((k) => {
          const v = k.base + (Math.random() - 0.5) * k.jitter;
          return formatKpi(v, k.digits ?? 0, k.suffix ?? "");
        }),
      );
    }, 2200);
    return () => window.clearInterval(id);
  }, []);
  return values;
}

export function AuthDashboardMap() {
  const kpi = useKpiTicker();

  return (
    <div className="absolute inset-0 overflow-hidden bg-background text-foreground">
      {/* grid + glow backdrop (theme-aware via tokens) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--foreground) 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--foreground) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 24% 30%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 45%), radial-gradient(circle at 78% 70%, color-mix(in srgb, var(--success, var(--primary)) 18%, transparent), transparent 50%)",
        }}
      />

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 180, center: [20, 28] }}
        width={VIEW_W}
        height={VIEW_H}
        className="absolute inset-0 h-full w-full"
        style={{ background: "transparent" }}
      >
        <defs>
          <linearGradient id="countryFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="routeStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.15" />
          </linearGradient>
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Geographies geography={countries}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="url(#countryFill)"
                strokeWidth={0.6}
                style={{
                  default: {
                    outline: "none",
                    stroke: "color-mix(in srgb, var(--primary) 35%, transparent)",
                  },
                  hover: {
                    outline: "none",
                    stroke: "color-mix(in srgb, var(--primary) 35%, transparent)",
                  },
                  pressed: {
                    outline: "none",
                    stroke: "color-mix(in srgb, var(--primary) 35%, transparent)",
                  },
                }}
              />
            ))
          }
        </Geographies>

        <g>
          {ROUTES.map(([from, to], i) => {
            const d = routeD(from, to);
            const dur = 4 + (i % 4) * 0.8;
            const delay = (i % 5) * -0.7;
            return (
              <g key={`${from}-${to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="url(#routeStroke)"
                  strokeWidth={1.1}
                  opacity={0.65}
                />
                <circle r={2.4} fill="var(--primary)" filter="url(#nodeGlow)">
                  <animateMotion
                    dur={`${dur}s`}
                    begin={`${delay}s`}
                    repeatCount="indefinite"
                    path={d}
                    rotate="auto"
                  />
                </circle>
              </g>
            );
          })}
        </g>

        {NODES.map((n) => (
          <Marker key={n.id} coordinates={n.coords}>
            <g>
              <circle
                r={10}
                style={{ fill: "color-mix(in srgb, var(--primary) 22%, transparent)" }}
              >
                <animate
                  attributeName="r"
                  values="8;16;8"
                  dur="2.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.55;0;0.55"
                  dur="2.6s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r={4.2} fill="var(--primary)" filter="url(#nodeGlow)" />
              <circle r={1.6} fill="var(--background)" />
              <text
                x={9}
                y={-9}
                fontSize={11}
                style={{
                  fontFamily: "ui-sans-serif, system-ui",
                  fill: "color-mix(in srgb, var(--foreground) 72%, transparent)",
                }}
              >
                {n.label}
              </text>
            </g>
          </Marker>
        ))}
      </ComposableMap>

      <CornerBrackets />

      <div className="pointer-events-none absolute left-6 top-6 hidden md:flex md:gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/60 px-3 py-1 text-[11px] text-primary backdrop-blur">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
            <span className="absolute inset-0 rounded-full bg-success" />
          </span>
          全球节点 · 实时监控
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-6 hidden gap-2 md:flex">
        {kpi.slice(0, 3).map((value, i) => (
          <div
            key={KPI_POOL[i].label}
            className="rounded-md border border-border bg-card/55 px-3 py-2 text-right backdrop-blur"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {KPI_POOL[i].label}
            </div>
            <div className="font-mono text-base text-primary">{value}</div>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-6 left-6 right-6 hidden flex-wrap items-center gap-3 md:flex">
        {kpi.slice(3).map((value, i) => (
          <div
            key={KPI_POOL[i + 3].label}
            className="rounded-md border border-border bg-card/55 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur"
          >
            <span className="mr-2">{KPI_POOL[i + 3].label}</span>
            <span className="font-mono text-primary">{value}</span>
          </div>
        ))}
        <div className="ml-auto rounded-md border border-success/40 bg-card/55 px-3 py-2 font-mono text-[11px] text-success backdrop-blur">
          STATUS · ONLINE
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 30%, color-mix(in srgb, var(--background) 55%, transparent) 75%, color-mix(in srgb, var(--background) 88%, transparent))",
        }}
      />
    </div>
  );
}

function CornerBrackets() {
  const corners = [
    "top-4 left-4 border-l-2 border-t-2",
    "top-4 right-4 border-r-2 border-t-2",
    "bottom-4 left-4 border-l-2 border-b-2",
    "bottom-4 right-4 border-r-2 border-b-2",
  ];
  return (
    <>
      {corners.map((c) => (
        <span
          key={c}
          aria-hidden
          className={`pointer-events-none absolute size-8 border-primary/40 ${c}`}
        />
      ))}
    </>
  );
}
