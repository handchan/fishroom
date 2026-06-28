import { useState } from "react";
import type { Tank } from "./types";

interface Props {
  tank: Tank;
  now: number;
}

type Metric = "temp" | "water" | "feeding";

const W = 340;
const H = 158;
const PAD = { l: 34, r: 14, t: 16, b: 26 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

interface P {
  t: number;
  v: number;
}

export default function TankCharts({ tank, now }: Props) {
  const temp: P[] = tank.logs
    .filter((l) => l.type === "temp_test" && l.tempF != null)
    .map((l) => ({ t: +new Date(l.date), v: l.tempF as number }))
    .sort((a, b) => a.t - b.t);
  const water: P[] = tank.logs
    .filter((l) => l.type === "water_change")
    .map((l) => ({ t: +new Date(l.date), v: l.percent ?? tank.defaultChangePercent }))
    .sort((a, b) => a.t - b.t);
  const feeding: P[] = tank.logs
    .filter((l) => l.type === "feeding")
    .map((l) => ({ t: +new Date(l.date), v: 1 }))
    .sort((a, b) => a.t - b.t);

  const counts = { temp: temp.length, water: water.length, feeding: feeding.length };

  // Default to the metric that actually has data.
  const [metric, setMetric] = useState<Metric>(
    counts.temp ? "temp" : counts.water ? "water" : "feeding"
  );

  // Shared x-range: earliest event across all metrics → now (padded a little).
  const allT = [...temp, ...water, ...feeding].map((p) => p.t);
  let tMin = allT.length ? Math.min(...allT) : now - 14 * 86400000;
  const tMax = now;
  if (tMax - tMin < 7 * 86400000) tMin = tMax - 7 * 86400000;

  const x = (t: number) =>
    PAD.l + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW);

  return (
    <div className="chart-card">
      <div className="trend-tabs">
        <button
          className={metric === "temp" ? "on" : ""}
          onClick={() => setMetric("temp")}
        >
          🌡️ Temp
        </button>
        <button
          className={metric === "water" ? "on" : ""}
          onClick={() => setMetric("water")}
        >
          💧 Water
        </button>
        <button
          className={metric === "feeding" ? "on" : ""}
          onClick={() => setMetric("feeding")}
        >
          🍤 Feeding
        </button>
      </div>

      {metric === "temp" && <TempChart pts={temp} x={x} tMin={tMin} tMax={tMax} />}
      {metric === "water" && <WaterChart pts={water} x={x} tMin={tMin} tMax={tMax} />}
      {metric === "feeding" && (
        <FeedingChart pts={feeding} x={x} tMin={tMin} tMax={tMax} now={now} />
      )}
    </div>
  );
}

function Axis({ tMin, tMax }: { tMin: number; tMax: number }) {
  return (
    <>
      <line
        className="axis"
        x1={PAD.l}
        y1={H - PAD.b}
        x2={W - PAD.r}
        y2={H - PAD.b}
      />
      <text className="ax-date" x={PAD.l} y={H - 8} textAnchor="start">
        {fmtMD(tMin)}
      </text>
      <text className="ax-date" x={W - PAD.r} y={H - 8} textAnchor="end">
        {fmtMD(tMax)}
      </text>
    </>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="chart-empty">{label}</div>;
}

function ChartSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      {children}
    </svg>
  );
}

function TempChart({
  pts,
  x,
  tMin,
  tMax,
}: {
  pts: P[];
  x: (t: number) => number;
  tMin: number;
  tMax: number;
}) {
  if (pts.length === 0)
    return <Empty label="No temperature readings yet — tap 🌡️ Temp to add one." />;

  const vals = pts.map((p) => p.v);
  let vMin = Math.min(...vals);
  let vMax = Math.max(...vals);
  if (vMax - vMin < 4) {
    const mid = (vMin + vMax) / 2;
    vMin = mid - 2;
    vMax = mid + 2;
  } else {
    vMin -= 1;
    vMax += 1;
  }
  const y = (v: number) => PAD.t + (1 - (v - vMin) / (vMax - vMin)) * plotH;

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
  const area =
    `M${x(pts[0].t)},${H - PAD.b} ` +
    pts.map((p) => `L${x(p.t)},${y(p.v)}`).join(" ") +
    ` L${x(pts[pts.length - 1].t)},${H - PAD.b} Z`;
  const last = pts[pts.length - 1];

  return (
    <>
      <ChartSvg>
        <text className="ax-y" x={PAD.l - 6} y={y(vMax) + 3} textAnchor="end">
          {Math.round(vMax)}°
        </text>
        <text className="ax-y" x={PAD.l - 6} y={y(vMin) + 3} textAnchor="end">
          {Math.round(vMin)}°
        </text>
        <line className="grid" x1={PAD.l} y1={y(vMax)} x2={W - PAD.r} y2={y(vMax)} />
        <line className="grid" x1={PAD.l} y1={y(vMin)} x2={W - PAD.r} y2={y(vMin)} />
        <Axis tMin={tMin} tMax={tMax} />
        {pts.length > 1 && <path className="area temp" d={area} />}
        {pts.length > 1 && <path className="line temp" d={line} />}
        {pts.map((p, i) => (
          <circle key={i} className="dot temp" cx={x(p.t)} cy={y(p.v)} r={3} />
        ))}
        <text className="pt-label" x={x(last.t)} y={y(last.v) - 8} textAnchor="middle">
          {last.v}°F
        </text>
      </ChartSvg>
      <div className="chart-meta">
        Latest <b>{last.v}°F</b> · range {Math.min(...vals)}–{Math.max(...vals)}°F ·{" "}
        {pts.length} reading{pts.length === 1 ? "" : "s"}
      </div>
    </>
  );
}

function WaterChart({
  pts,
  x,
  tMin,
  tMax,
}: {
  pts: P[];
  x: (t: number) => number;
  tMin: number;
  tMax: number;
}) {
  if (pts.length === 0)
    return <Empty label="No water changes logged yet — tap 💧 Water to log one." />;

  const vMax = Math.max(100, ...pts.map((p) => p.v));
  const y = (v: number) => PAD.t + (1 - v / vMax) * plotH;
  const labelEach = pts.length <= 9;

  return (
    <>
      <ChartSvg>
        <text className="ax-y" x={PAD.l - 6} y={y(vMax) + 3} textAnchor="end">
          {Math.round(vMax)}%
        </text>
        <text className="ax-y" x={PAD.l - 6} y={y(0) + 3} textAnchor="end">
          0
        </text>
        <line className="grid" x1={PAD.l} y1={y(vMax)} x2={W - PAD.r} y2={y(vMax)} />
        <Axis tMin={tMin} tMax={tMax} />
        {pts.map((p, i) => {
          const cx = x(p.t);
          const top = y(p.v);
          return (
            <g key={i}>
              <rect
                className="bar water"
                x={cx - 4}
                y={top}
                width={8}
                height={H - PAD.b - top}
                rx={2}
              />
              {labelEach && (
                <text className="pt-label" x={cx} y={top - 5} textAnchor="middle">
                  {p.v}%
                </text>
              )}
            </g>
          );
        })}
      </ChartSvg>
      <div className="chart-meta">
        {pts.length} change{pts.length === 1 ? "" : "s"}
        {avgGap(pts) != null && <> · avg every <b>{avgGap(pts)}d</b></>} · last{" "}
        <b>{pts[pts.length - 1].v}%</b>
      </div>
    </>
  );
}

function FeedingChart({
  pts,
  x,
  tMin,
  tMax,
  now,
}: {
  pts: P[];
  x: (t: number) => number;
  tMin: number;
  tMax: number;
  now: number;
}) {
  if (pts.length === 0)
    return <Empty label="No feedings logged yet — tap 🍤 Fed to log one." />;

  // Bucket feedings per day to show a small density histogram.
  const dayMs = 86400000;
  const days = Math.max(1, Math.ceil((tMax - tMin) / dayMs));
  const buckets = new Map<number, number>();
  for (const p of pts) {
    const d = Math.floor((p.t - tMin) / dayMs);
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  const maxCount = Math.max(...buckets.values(), 1);
  const y = (c: number) => PAD.t + (1 - c / maxCount) * plotH;
  const bw = Math.max(2, Math.min(10, plotW / days - 1));
  const last30 = pts.filter((p) => p.t >= now - 30 * dayMs).length;

  return (
    <>
      <ChartSvg>
        <text className="ax-y" x={PAD.l - 6} y={y(maxCount) + 3} textAnchor="end">
          {maxCount}
        </text>
        <Axis tMin={tMin} tMax={tMax} />
        {[...buckets.entries()].map(([d, c]) => {
          const cx = x(tMin + d * dayMs + dayMs / 2);
          const top = y(c);
          return (
            <rect
              key={d}
              className="bar feeding"
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={H - PAD.b - top}
              rx={1.5}
            />
          );
        })}
      </ChartSvg>
      <div className="chart-meta">
        {pts.length} feeding{pts.length === 1 ? "" : "s"} · {last30} in last 30d
        {avgGap(pts) != null && <> · avg every <b>{avgGap(pts)}d</b></>}
      </div>
    </>
  );
}

function avgGap(pts: P[]): number | null {
  if (pts.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += pts[i].t - pts[i - 1].t;
  const avgDays = sum / (pts.length - 1) / 86400000;
  return Math.max(1, Math.round(avgDays));
}

function fmtMD(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
