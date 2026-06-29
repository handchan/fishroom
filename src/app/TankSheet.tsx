import { useEffect, useState } from "react";
import type { LogEntry, Tank, WaterType } from "./types";
import { daysSince, lastLogOfType } from "./status";
import TankCharts from "./Charts";

interface Props {
  tank: Tank;
  isNew: boolean;
  now: number;
  onSave: (tank: Tank) => void;
  onDelete: (id: string) => void;
  onAddLog: (id: string, entry: Omit<LogEntry, "id">) => void;
  onRemoveLog: (tankId: string, logId: string) => void;
  onClose: () => void;
}

const WATER_TYPES: WaterType[] = [
  "freshwater",
  "planted",
  "saltwater",
  "brackish",
];

export default function TankSheet({
  tank,
  isNew,
  now,
  onSave,
  onDelete,
  onAddLog,
  onRemoveLog,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<Tank>(tank);

  // keep local draft in sync when new logs land from quick-actions
  useEffect(() => {
    setDraft((d) => ({ ...d, logs: tank.logs }));
  }, [tank.logs]);

  const set = <K extends keyof Tank>(key: K, value: Tank[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function logChange() {
    onAddLog(draft.id, {
      date: new Date().toISOString(),
      type: "water_change",
      percent: draft.defaultChangePercent,
    });
  }
  function logFeed() {
    onAddLog(draft.id, { date: new Date().toISOString(), type: "feeding" });
  }
  function logTemp() {
    const current = draft.tempF != null ? String(draft.tempF) : "";
    const input = window.prompt("Water temperature (°F)", current);
    if (input == null || input.trim() === "") return;
    const v = clampNum(input, 32, 120);
    set("tempF", v);
    onAddLog(draft.id, {
      date: new Date().toISOString(),
      type: "temp_test",
      tempF: v,
    });
  }

  const lastChange = lastLogOfType(draft, "water_change");
  const lastFeed = lastLogOfType(draft, "feeding");
  const lastTemp = lastLogOfType(draft, "temp_test");
  const ago = (iso: string | undefined) => {
    const d = daysSince(iso, now);
    if (d == null) return "—";
    return d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <button onClick={onClose}>Cancel</button>
          <span className="t">{isNew ? "New Tank" : "Edit Tank"}</span>
          <button
            onClick={() => onSave(draft)}
            style={{ fontWeight: 800 }}
          >
            Save
          </button>
        </div>

        <div className="sheet-body">
          {!isNew && (
            <>
              <div className="stat-row">
                <div className="stat">
                  <div className="stat-ic">💧</div>
                  <div className="stat-v">{ago(lastChange?.date)}</div>
                  <div className="stat-l">Last water change</div>
                </div>
                <div className="stat">
                  <div className="stat-ic">🍤</div>
                  <div className="stat-v">{ago(lastFeed?.date)}</div>
                  <div className="stat-l">Last fed</div>
                </div>
                <div className="stat">
                  <div className="stat-ic">🌡️</div>
                  <div className="stat-v">
                    {lastTemp?.tempF != null
                      ? `${lastTemp.tempF}°F`
                      : draft.tempF != null
                      ? `${draft.tempF}°F`
                      : "—"}
                  </div>
                  <div className="stat-l">
                    {lastTemp
                      ? `Tested ${ago(lastTemp.date)}`
                      : draft.tempF != null
                      ? "Not tested yet"
                      : "Last temp"}
                  </div>
                </div>
              </div>

              <div className="action-row three">
                <button className="wc" onClick={logChange}>
                  <span className="al">💧 Water</span>
                  <span className="hint">{draft.defaultChangePercent}% change</span>
                </button>
                <button className="feed" onClick={logFeed}>
                  <span className="al">🍤 Fed</span>
                  <span className="hint">mark fed now</span>
                </button>
                <button className="temp" onClick={logTemp}>
                  <span className="al">🌡️ Temp</span>
                  <span className="hint">
                    {draft.tempF != null ? `last ${draft.tempF}°F` : "log a reading"}
                  </span>
                </button>
              </div>

              {draft.logs.length > 0 && (
                <>
                  <div className="section-title">Trends</div>
                  <TankCharts tank={draft} now={now} />
                </>
              )}
            </>
          )}

          <div className="field">
            <label>Name</label>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Community 75g"
            />
          </div>

          <div className="row2">
            <div className="field">
              <label>Volume (gal)</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.volumeGallons}
                onChange={(e) =>
                  set("volumeGallons", clampNum(e.target.value, 0, 100000))
                }
              />
            </div>
            <div className="field">
              <label>Temp (°F)</label>
              <input
                type="number"
                inputMode="decimal"
                value={draft.tempF ?? ""}
                placeholder="—"
                onChange={(e) =>
                  set(
                    "tempF",
                    e.target.value === ""
                      ? undefined
                      : clampNum(e.target.value, 32, 120)
                  )
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Water type</label>
            <div className="seg-input">
              {WATER_TYPES.map((w) => (
                <button
                  key={w}
                  className={draft.waterType === w ? "on" : ""}
                  onClick={() => set("waterType", w)}
                >
                  {w === "freshwater"
                    ? "Fresh"
                    : w[0].toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Change every (days)</label>
              <input
                type="number"
                inputMode="numeric"
                value={draft.waterChangeIntervalDays}
                onChange={(e) =>
                  set(
                    "waterChangeIntervalDays",
                    clampNum(e.target.value, 1, 365)
                  )
                }
              />
            </div>
            <div className="field">
              <label>Typical change (%)</label>
              <input
                type="number"
                inputMode="numeric"
                value={draft.defaultChangePercent}
                onChange={(e) =>
                  set("defaultChangePercent", clampNum(e.target.value, 1, 100))
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Livestock</label>
            <input
              value={draft.livestock}
              onChange={(e) => set("livestock", e.target.value)}
              placeholder="e.g. Cardinal tetras, otos"
            />
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Filter, dosing, params…"
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">🌐 Share to my site</div>
              <div className="setting-sub">
                Include this tank in the public data hengchengyu.com can read.
              </div>
            </div>
            <button
              className={"switch" + (draft.shared ? " on" : "")}
              role="switch"
              aria-checked={Boolean(draft.shared)}
              onClick={() => set("shared", !draft.shared)}
            >
              <span className="knob" />
            </button>
          </div>

          {!isNew && (
            <>
              <div className="section-title">History</div>
              {draft.logs.length === 0 && (
                <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
                  No events logged yet.
                </p>
              )}
              {draft.logs.slice(0, 30).map((l) => (
                <div className="log-item" key={l.id}>
                  <span className="lt">
                    {l.type === "water_change"
                      ? "💧"
                      : l.type === "feeding"
                      ? "🍤"
                      : "🌡️"}
                  </span>
                  <div className="ld">
                    {l.type === "water_change"
                      ? `Water change${l.percent ? ` · ${l.percent}%` : ""}`
                      : l.type === "feeding"
                      ? "Feeding"
                      : `Temp test${l.tempF != null ? ` · ${l.tempF}°F` : ""}`}
                    <div className="lsub">{fmtDate(l.date)}</div>
                  </div>
                  <button
                    className="del"
                    aria-label="Delete entry"
                    onClick={() => onRemoveLog(draft.id, l.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="danger-btn"
                onClick={() => {
                  if (confirm(`Delete "${draft.name}"? This can't be undone.`))
                    onDelete(draft.id);
                }}
              >
                Delete tank
              </button>
            </>
          )}
        </div>

        <div className="save-bar">
          <button onClick={() => onSave(draft)}>
            {isNew ? "Add tank" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}

function clampNum(v: string, min: number, max: number): number {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((+now - +d) / 86400000);
  const rel =
    days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} · ${rel}`;
}
