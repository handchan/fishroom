import { useEffect, useMemo, useRef, useState } from "react";
import FishroomMap from "./app/FishroomMap";
import ListView from "./app/ListView";
import StockView from "./app/StockView";
import TankSheet from "./app/TankSheet";
import RackSheet from "./app/RackSheet";
import SettingsSheet from "./app/SettingsSheet";
import { newStack, newTank, useFishroom } from "./app/storage";
import { getStatus, STATUS_COLORS, stackMembers } from "./app/status";
import { useReminders } from "./app/reminders";
import { useSync } from "./app/sync";
import { useDialog } from "./app/Dialog";
import { useAppUpdate } from "./app/pwa";
import type { Stack, Tank } from "./app/types";

type View = "map" | "list" | "stock";
interface Editing {
  tank: Tank;
  isNew: boolean;
  ensureStack?: Stack;
}

export default function App() {
  const fr = useFishroom();
  const dialog = useDialog();
  const [view, setView] = useState<View>("map");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [openStackId, setOpenStackId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editRoom, setEditRoom] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { tanks, stacks, room, reminders } = fr.state;
  useReminders(tanks, reminders, now);
  const sync = useSync(fr.state, now);
  const { needRefresh, applyUpdate } = useAppUpdate();

  const summary = useMemo(() => {
    let overdue = 0;
    let due = 0;
    for (const t of tanks) {
      const lvl = getStatus(t, now).level;
      if (lvl === "never" || lvl === "overdue") overdue++;
      else if (lvl === "due") due++;
    }
    return { overdue, due, total: tanks.length };
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

  function addNewRack() {
    const stack = newStack(0.5, 0.55);
    setOpenStackId(null);
    setEditing({ tank: newTank(stack.id, 0), isNew: true, ensureStack: stack });
  }

  function addTankToStack(stackId: string) {
    const members = stackMembers(tanks, stackId);
    const nextShelf = members.reduce((m, t) => Math.max(m, t.shelf), -1) + 1;
    setOpenStackId(null);
    setEditing({ tank: newTank(stackId, nextShelf), isNew: true });
  }

  async function feedAllTanks() {
    if (tanks.length === 0) return;
    const ok = await dialog.confirm({
      title: "Feed all tanks?",
      message: `This logs a feeding right now for all ${tanks.length} tanks.`,
      confirmLabel: "Feed all",
    });
    if (ok) {
      fr.feedAll();
      flash(`🍤 Fed all ${tanks.length} tanks`);
    }
  }

  // Re-read the edited tank from state so history reflects quick logs.
  const liveEditing: Editing | null = editing
    ? {
        ...editing,
        tank: tanks.find((t) => t.id === editing.tank.id) ?? editing.tank,
      }
    : null;

  const openStack = openStackId
    ? stacks.find((s) => s.id === openStackId)
    : undefined;
  const openMembers = openStack ? stackMembers(tanks, openStack.id) : [];

  // Room editing helpers
  const roomPts = room?.points ?? [];
  const roomOpen = room?.closed === false;

  // Leave room-editing cleanly: finish a valid outline, or discard a stub.
  function exitRoomEdit() {
    if (roomOpen) {
      if (roomPts.length >= 3) fr.closeRoom();
      else fr.setRoom([]);
    }
    setEditRoom(false);
  }

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
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Reminders & settings"
          >
            🔔
          </button>
          <button className="icon-btn" onClick={addNewRack} aria-label="Add tank">
            +
          </button>
        </div>
      </div>

      {!fr.persisted && (
        <div className="banner warn" role="alert">
          ⚠️ Couldn't save to this device (storage full or private browsing).
          Changes are kept for this session only — export a backup from 🔔
          Settings.
        </div>
      )}

      <div className="segment">
        <button
          className={view === "map" ? "active" : ""}
          onClick={() => {
            setView("map");
          }}
        >
          🗺️ Map
        </button>
        <button
          className={view === "list" ? "active" : ""}
          onClick={() => {
            setView("list");
            exitRoomEdit();
          }}
        >
          📋 List
        </button>
        <button
          className={view === "stock" ? "active" : ""}
          onClick={() => {
            setView("stock");
            exitRoomEdit();
          }}
        >
          🐠 Stock
        </button>
      </div>

      <div className="summary">
        <div className="stats">
          <div className="chip">
            <div className="n">{summary.total}</div>
            <div className="l">Tanks</div>
          </div>
          <div className="chip">
            <div
              className="n"
              style={summary.due > 0 ? { color: STATUS_COLORS.due } : undefined}
            >
              {summary.due}
            </div>
            <div className="l">Due soon</div>
          </div>
          <div className="chip">
            <div
              className="n"
              style={
                summary.overdue > 0
                  ? { color: STATUS_COLORS.overdue }
                  : undefined
              }
            >
              {summary.overdue}
            </div>
            <div className="l">Overdue</div>
          </div>
        </div>
        {tanks.length > 0 && (
          <button
            className="feed-all"
            onClick={feedAllTanks}
            disabled={editRoom}
          >
            <span aria-hidden>🍤</span>
            <span>Feed all</span>
          </button>
        )}
      </div>

      <div className="content">
        {view === "map" ? (
          <>
            {tanks.length === 0 ? (
              <div className="empty">
                <div className="big" aria-hidden>
                  🪣
                </div>
                <h2>No tanks yet</h2>
                <p>
                  Add your first aquarium and start tracking water changes and
                  feedings.
                </p>
                <button className="cta" onClick={addNewRack}>
                  + Add a tank
                </button>
              </div>
            ) : (
              <FishroomMap
                stacks={stacks}
                tanks={tanks}
                room={room}
                now={now}
                editRoom={editRoom}
                onOpenStack={(s) => setOpenStackId(s.id)}
                onMoveStack={fr.moveStack}
                onRoomChange={fr.setRoom}
                onCloseRoom={fr.closeRoom}
              />
            )}

            {/* Map tools — need the map canvas, so hidden while there are no tanks */}
            {tanks.length === 0 ? null : !editRoom ? (
              <button
                className="map-tool"
                onClick={() => setEditRoom(true)}
                aria-label="Draw room shape"
              >
                ✏️ Draw room
              </button>
            ) : (
              <div className="room-tools">
                <span className="room-tip">
                  {roomOpen
                    ? roomPts.length >= 3
                      ? "Tap the first dot (or Close) to finish · drag dots to adjust"
                      : "Tap to drop corners, one at a time · drag dots to adjust"
                    : "Tap to add a corner · drag dots to reshape"}
                </span>
                <div className="room-tool-btns">
                  <button
                    onClick={() => fr.setRoom(roomPts.slice(0, -1))}
                    disabled={roomPts.length === 0}
                  >
                    Undo
                  </button>
                  <button
                    onClick={() => fr.setRoom([])}
                    disabled={roomPts.length === 0}
                  >
                    Clear
                  </button>
                  {roomOpen && roomPts.length >= 3 && (
                    <button className="close-shape" onClick={fr.closeRoom}>
                      Close shape
                    </button>
                  )}
                  <button className="done" onClick={exitRoomEdit}>
                    Done
                  </button>
                </div>
              </div>
            )}

            {!editRoom && (
              <button className="fab" onClick={addNewRack} aria-label="Add tank">
                +
              </button>
            )}
          </>
        ) : view === "list" ? (
          <ListView
            tanks={tanks}
            now={now}
            onOpen={(t) => setEditing({ tank: t, isNew: false })}
            onLogChange={quickChange}
            onLogFeed={quickFeed}
            onAdd={addNewRack}
          />
        ) : (
          <StockView
            tanks={tanks}
            species={fr.state.species}
            onOpenTank={(t) => setEditing({ tank: t, isNew: false })}
            onRemoveSpecies={fr.removeSpecies}
          />
        )}

        {view === "list" && (
          <button className="fab" onClick={addNewRack} aria-label="Add tank">
            +
          </button>
        )}
      </div>

      {view === "map" && tanks.length > 0 && !editRoom && (
        <div
          className="legend-wrap"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
        >
          <div className="legend">
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
        </div>
      )}

      {openStack && !editing && (
        <RackSheet
          stack={openStack}
          members={openMembers}
          now={now}
          onRename={(label) => fr.setStackLabel(openStack.id, label)}
          onEditTank={(t) => {
            setOpenStackId(null);
            setEditing({ tank: t, isNew: false });
          }}
          onQuickChange={quickChange}
          onQuickFeed={quickFeed}
          onAddTank={() => addTankToStack(openStack.id)}
          onClose={() => setOpenStackId(null)}
        />
      )}

      {liveEditing && (
        <TankSheet
          tank={liveEditing.tank}
          isNew={liveEditing.isNew}
          now={now}
          species={fr.state.species}
          onSave={(t) => {
            fr.upsertTank(t, liveEditing.ensureStack);
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
            flash(
              entry.type === "water_change"
                ? "💧 Water change logged"
                : entry.type === "temp_test"
                ? `🌡️ Temp logged${entry.tempF != null ? ` · ${entry.tempF}°F` : ""}`
                : "🍤 Fed"
            );
          }}
          onRemoveLog={fr.removeLog}
          onClose={() => setEditing(null)}
        />
      )}

      {showSettings && (
        <SettingsSheet
          reminders={reminders}
          onRemindersChange={fr.setReminders}
          state={fr.state}
          onImport={(s) => {
            fr.replaceState(s);
            setShowSettings(false);
            flash("✓ Data imported");
          }}
          sync={sync}
          syncPrefs={fr.state.sync ?? { slug: "", publish: false }}
          onSyncPrefsChange={fr.setSync}
          onClose={() => setShowSettings(false)}
        />
      )}

      {needRefresh && (
        <div className="update-toast" role="status">
          <span>🔄 A new version is ready.</span>
          <button onClick={applyUpdate}>Update</button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
