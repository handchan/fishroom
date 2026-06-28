import { useEffect, useState } from "react";
import type { LogEntry, Tank, WaterType } from "./types";
import { getStatus } from "./status";

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

  const st = getStatus(draft, now);

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
            <div className="action-row">
              <button className="wc" onClick={logChange}>
                💧 Log water change
                <span className="hint">{draft.defaultChangePercent}% · {st.label}</span>
              </button>
              <button className="feed" onClick={logFeed}>
                🍤 Mark fed
                <span className="hint">
                  {st.daysSinceFeed == null
                    ? "not logged"
                    : st.daysSinceFeed === 0
                    ? "fed today"
                    : `${st.daysSinceFeed}d ago`}
                </span>
              </button>
            </div>
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
                    {l.type === "water_change" ? "💧" : "🍤"}
                  </span>
                  <div className="ld">
                    {l.type === "water_change"
                      ? `Water change${l.percent ? ` · ${l.percent}%` : ""}`
                      : "Feeding"}
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
