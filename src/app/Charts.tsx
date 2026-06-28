import { useState } from "react";
import type { Tank } from "./types";

interface Props {
  tank: Tank;
  now: number;
}

type Metric = "temp" | "water" | "feeding";

const W = 340;
const H = 158;
const PAD = { l: 36, r: 16, t: 16, b: 26 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const DAY = 86400000;

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
  const [metric, setMetric] = useState<Metric>(
    counts.temp ? "temp" : counts.water ? "water" : "feeding"
  );

  // Shared x-range: earliest event across all metrics → now.
  const allT = [...temp, ...water, ...feeding].map((p) => p.t);
  let tMin = allT.length ? Math.min(...allT) : now - 14 * DAY;
  const tMax = now;
  if (tMax - tMin < 7 * DAY) tMin = tMax - 7 * DAY;
  const x = (t: number) =>
    PAD.l + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW);

  return (
    <div className="chart-card">
      <div className="trend-tabs">
        <button className={metric === "temp" ? "on" : ""} onClick={() => setMetric("temp")}>
          🌡️ Temp
        </button>
        <button className={metric === "water" ? "on" : ""} onClick={() => setMetric("water")}>
          💧 Water
        </button>
        <button className={metric === "feeding" ? "on" : ""} onClick={() => setMetric("feeding")}>
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

/* ---------- Shared line chart ---------- */

interface LineProps {
  pts: P[];
  x: (t: number) => number;
  tMin: number;
  tMax: number;
  yMin: number;
  yMax: number;
  cls: Metric;
  yFmt: (v: number) => string;
  lastFmt: (v: number) => string;
}

function LineChart({ pts, x, tMin, tMax, yMin, yMax, cls, yFmt, lastFmt }: LineProps) {
  const span = yMax - yMin || 1;
  const y = (v: number) => PAD.t + (1 - (v - yMin) / span) * plotH;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
  const area =
    `M${x(pts[0].t)},${H - PAD.b} ` +
    pts.map((p) => `L${x(p.t)},${y(p.v)}`).join(" ") +
    ` L${x(pts[pts.length - 1].t)},${H - PAD.b} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      <text className="ax-y" x={PAD.l - 6} y={y(yMax) + 3} textAnchor="end">
        {yFmt(yMax)}
      </text>
      <text className="ax-y" x={PAD.l - 6} y={y(yMin) + 3} textAnchor="end">
        {yFmt(yMin)}
      </text>
      <line className="grid" x1={PAD.l} y1={y(yMax)} x2={W - PAD.r} y2={y(yMax)} />
      <line className="grid" x1={PAD.l} y1={y(yMin)} x2={W - PAD.r} y2={y(yMin)} />
      <line className="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
      <text className="ax-date" x={PAD.l} y={H - 8} textAnchor="start">
        {fmtMD(tMin)}
      </text>
      <text className="ax-date" x={W - PAD.r} y={H - 8} textAnchor="end">
        {fmtMD(tMax)}
      </text>

      {pts.length > 1 && <path className={`area ${cls}`} d={area} />}
      {pts.length > 1 && <path className={`line ${cls}`} d={line} />}
      {pts.map((p, i) => (
        <circle key={i} className={`dot ${cls}`} cx={x(p.t)} cy={y(p.v)} r={3} />
      ))}
      <text className="pt-label" x={x(last.t)} y={y(last.v) - 8} textAnchor="middle">
        {lastFmt(last.v)}
      </text>
    </svg>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="chart-empty">{label}</div>;
}

/* ---------- Per-metric wrappers ---------- */

function TempChart({ pts, ...rest }: { pts: P[]; x: (t: number) => number; tMin: number; tMax: number }) {
  if (pts.length === 0)
    return <Empty label="No temperature readings yet — tap 🌡️ Temp to add one." />;
  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 4) {
    const mid = (lo + hi) / 2;
    lo = mid - 2;
    hi = mid + 2;
  } else {
    lo -= 1;
    hi += 1;
  }
  return (
    <>
      <LineChart
        pts={pts}
        {...rest}
        yMin={lo}
        yMax={hi}
        cls="temp"
        yFmt={(v) => `${Math.round(v)}°`}
        lastFmt={(v) => `${v}°F`}
      />
      <div className="chart-meta">
        Latest <b>{pts[pts.length - 1].v}°F</b> · range {Math.min(...vals)}–
        {Math.max(...vals)}°F · {pts.length} reading{pts.length === 1 ? "" : "s"}
      </div>
    </>
  );
}

function WaterChart({ pts, ...rest }: { pts: P[]; x: (t: number) => number; tMin: number; tMax: number }) {
  if (pts.length === 0)
    return <Empty label="No water changes logged yet — tap 💧 Water to log one." />;
  const hi = Math.max(100, ...pts.map((p) => p.v));
  return (
    <>
      <LineChart
        pts={pts}
        {...rest}
        yMin={0}
        yMax={hi}
        cls="water"
        yFmt={(v) => (v === 0 ? "0" : `${Math.round(v)}%`)}
        lastFmt={(v) => `${v}%`}
      />
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
  now,
  ...rest
}: {
  pts: P[];
  x: (t: number) => number;
  tMin: number;
  tMax: number;
  now: number;
}) {
  if (pts.length === 0)
    return <Empty label="No feedings logged yet — tap 🍤 Fed to log one." />;

  // Plot feeding frequency as a trailing 7-day rate (feedings per week).
  const rate: P[] = pts.map((p) => {
    const start = p.t - 7 * DAY;
    let c = 0;
    for (const q of pts) if (q.t > start && q.t <= p.t) c++;
    return { t: p.t, v: c };
  });
  const hi = Math.max(2, ...rate.map((r) => r.v));
  const last30 = pts.filter((p) => p.t >= now - 30 * DAY).length;

  return (
    <>
      <LineChart
        pts={rate}
        {...rest}
        yMin={0}
        yMax={hi}
        cls="feeding"
        yFmt={(v) => `${Math.round(v)}`}
        lastFmt={(v) => `${v}/wk`}
      />
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
  return Math.max(1, Math.round(sum / (pts.length - 1) / DAY));
}

function fmtMD(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
