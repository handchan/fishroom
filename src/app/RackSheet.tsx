import { useState } from "react";
import type { Stack, Tank } from "./types";
import {
  getStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  statusColor,
} from "./status";

interface Props {
  stack: Stack;
  members: Tank[]; // ordered top → bottom
  now: number;
  onRename: (label: string) => void;
  onEditTank: (tank: Tank) => void;
  onQuickChange: (tank: Tank) => void;
  onQuickFeed: (tank: Tank) => void;
  onAddTank: () => void;
  onClose: () => void;
}

const TYPE_ICON: Record<Tank["waterType"], string> = {
  freshwater: "🐟",
  planted: "🌿",
  saltwater: "🐠",
  brackish: "🦀",
};

export default function RackSheet({
  stack,
  members,
  now,
  onRename,
  onEditTank,
  onQuickChange,
  onQuickFeed,
  onAddTank,
  onClose,
}: Props) {
  const [label, setLabel] = useState(stack.label ?? "");

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <button onClick={onClose}>Close</button>
          <span className="t">Rack</span>
          <button onClick={onAddTank} style={{ fontWeight: 800 }}>
            + Tank
          </button>
        </div>

        <div className="sheet-body">
          <div className="field">
            <label>Rack name</label>
            <input
              value={label}
              placeholder="e.g. Main rack"
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => onRename(label)}
            />
          </div>

          <div className="section-title">
            {members.length} {members.length === 1 ? "tank" : "tanks"} · top → bottom
          </div>

          <div className="rack-stack">
            {members.map((t) => {
              const st = getStatus(t, now);
              return (
                <div className="rack-row" key={t.id}>
                  <span
                    className="dot"
                    style={{ color: statusColor(st.ratio) }}
                  />
                  <div className="rack-row-body" onClick={() => onEditTank(t)}>
                    <div className="rack-row-top">
                      <span className="name">
                        {TYPE_ICON[t.waterType]} {t.name}
                      </span>
                      <span className="vol">{t.volumeGallons} gal</span>
                    </div>
                    <div className="meta">
                      <span>💧 <b>{st.label}</b></span>
                      <span>
                        🍤{" "}
                        {st.daysSinceFeed == null
                          ? "not fed"
                          : st.daysSinceFeed === 0
                          ? "fed today"
                          : `${st.daysSinceFeed}d`}
                      </span>
                      <span
                        className="pill mini"
                        style={{ "--pill-c": STATUS_COLORS[st.level] } as React.CSSProperties}
                      >
                        {STATUS_LABELS[st.level]}
                      </span>
                    </div>
                  </div>
                  <div className="quick">
                    <button className="primary" onClick={() => onQuickChange(t)}>
                      Water ✓
                    </button>
                    <button onClick={() => onQuickFeed(t)}>Fed ✓</button>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="add-shelf" onClick={onAddTank}>
            + Add a tank to this rack
          </button>
        </div>
      </div>
    </>
  );
}
