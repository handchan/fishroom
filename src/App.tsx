import { useEffect, useMemo, useRef, useState } from "react";
import { KoiPond } from "./KoiPond";
import FishroomMap from "./app/FishroomMap";
import ListView from "./app/ListView";
import TankSheet from "./app/TankSheet";
import { newTank, useFishroom } from "./app/storage";
import { getStatus, STATUS_COLORS } from "./app/status";
import type { Tank } from "./app/types";

type View = "map" | "list";

export default function App() {
  const fr = useFishroom();
  const [view, setView] = useState<View>("map");
  const [editing, setEditing] = useState<{ tank: Tank; isNew: boolean } | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // A ticking "now" so relative times and statuses refresh while open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tanks = fr.state.tanks;

  const summary = useMemo(() => {
    let overdue = 0;
    let due = 0;
    const total = tanks.length;
    for (const t of tanks) {
      const lvl = getStatus(t, now).level;
      if (lvl === "never" || lvl === "overdue") overdue++;
      else if (lvl === "due") due++;
    }
    return { overdue, due, total };
  }, [tanks, now]);

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1700);
  }

  function quickChange(t: Tank) {
    fr.addLog(t.id, {
      date: new Date().toISOString(),
      type: "water_change",
      percent: t.defaultChangePercent,
    });
    flash(`💧 Water change logged · ${t.name}`);
  }
  function quickFeed(t: Tank) {
    fr.addLog(t.id, { date: new Date().toISOString(), type: "feeding" });
    flash(`🍤 Fed · ${t.name}`);
  }

  function openAdd() {
    setEditing({ tank: newTank(), isNew: true });
  }

  // The currently-edited tank, re-read from state so the history list
  // reflects quick-logs made from inside the sheet.
  const liveEditing = editing
    ? {
        tank:
          tanks.find((t) => t.id === editing.tank.id) ?? editing.tank,
        isNew: editing.isNew,
      }
    : null;

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>
            <span aria-hidden>🐟</span> Fishroom
          </h1>
          <div className="sub">
            {summary.total} tanks ·{" "}
            {summary.overdue > 0 ? (
              <span style={{ color: STATUS_COLORS.overdue }}>
                {summary.overdue} need attention
              </span>
            ) : (
              <span style={{ color: STATUS_COLORS.fresh }}>all good 🎉</span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={openAdd} aria-label="Add tank">
          +
        </button>
      </div>

      <div className="segment">
        <button
          className={view === "map" ? "active" : ""}
          onClick={() => setView("map")}
        >
          🗺️ Map
        </button>
        <button
          className={view === "list" ? "active" : ""}
          onClick={() => setView("list")}
        >
          📋 List
        </button>
      </div>

      <div className="summary">
        <div className="chip">
          <div className="n">{summary.total}</div>
          <div className="l">Tanks</div>
        </div>
        <div className="chip">
          <div className="n" style={{ color: STATUS_COLORS.due }}>
            {summary.due}
          </div>
          <div className="l">Due soon</div>
        </div>
        <div className="chip">
          <div className="n" style={{ color: STATUS_COLORS.overdue }}>
            {summary.overdue}
          </div>
          <div className="l">Overdue</div>
        </div>
      </div>

      <div className="content">
        {view === "map" ? (
          <>
            <div className="map-pond">
              <KoiPond
                fishCount={5}
                showLilyPads={false}
                showVignette={false}
                speed={0.5}
              />
            </div>
            {tanks.length === 0 ? (
              <div className="empty">
                <div className="big">🪣</div>
                <p>No tanks yet. Tap + to add your first aquarium.</p>
              </div>
            ) : (
              <FishroomMap
                tanks={tanks}
                now={now}
                onOpen={(t) => setEditing({ tank: t, isNew: false })}
                onMove={fr.setPosition}
              />
            )}
          </>
        ) : (
          <ListView
            tanks={tanks}
            now={now}
            onOpen={(t) => setEditing({ tank: t, isNew: false })}
            onLogChange={quickChange}
            onLogFeed={quickFeed}
          />
        )}

        <button className="fab" onClick={openAdd} aria-label="Add tank">
          +
        </button>
      </div>

      {view === "map" && tanks.length > 0 && (
        <div className="legend" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
          <span>
            <i style={{ background: STATUS_COLORS.fresh }} /> Fresh
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.due }} /> Due
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.overdue }} /> Overdue
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.never }} /> Needs change
          </span>
        </div>
      )}

      {liveEditing && (
        <TankSheet
          tank={liveEditing.tank}
          isNew={liveEditing.isNew}
          now={now}
          onSave={(t) => {
            fr.upsertTank(t);
            setEditing(null);
            flash(liveEditing.isNew ? "🪣 Tank added" : "✓ Saved");
          }}
          onDelete={(id) => {
            fr.removeTank(id);
            setEditing(null);
            flash("Tank deleted");
          }}
          onAddLog={(id, entry) => {
            fr.addLog(id, entry);
            flash(entry.type === "water_change" ? "💧 Logged" : "🍤 Fed");
          }}
          onRemoveLog={fr.removeLog}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
