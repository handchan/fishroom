import type { Tank } from "./types";
import {
  getStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  statusColor,
} from "./status";

interface Props {
  tanks: Tank[];
  now: number;
  onOpen: (tank: Tank) => void;
  onLogChange: (tank: Tank) => void;
  onLogFeed: (tank: Tank) => void;
  onAdd: () => void;
}

const TYPE_ICON: Record<Tank["waterType"], string> = {
  freshwater: "🐟",
  planted: "🌿",
  saltwater: "🐠",
  brackish: "🦀",
};

export default function ListView({
  tanks,
  now,
  onOpen,
  onLogChange,
  onLogFeed,
  onAdd,
}: Props) {
  if (tanks.length === 0) {
    return (
      <div className="list">
        <div className="empty">
          <div className="big" aria-hidden>
            🪣
          </div>
          <h2>No tanks yet</h2>
          <p>
            Add your first aquarium and start tracking water changes and
            feedings.
          </p>
          <button className="cta" onClick={onAdd}>
            + Add a tank
          </button>
        </div>
      </div>
    );
  }

  const sorted = [...tanks].sort(
    (a, b) => getStatus(b, now).ratio - getStatus(a, now).ratio
  );

  return (
    <div className="list">
      {sorted.map((t) => {
        const st = getStatus(t, now);
        return (
          <div className="card" key={t.id}>
            <span
              className="dot"
              style={{ color: statusColor(st.ratio) }}
            />
            <div className="body" onClick={() => onOpen(t)}>
              <div className="title-row">
                <span className="name">
                  {TYPE_ICON[t.waterType]} {t.name}
                </span>
                <span className="vol">{t.volumeGallons} gal</span>
              </div>
              <div className="meta">
                <span
                  className="pill mini"
                  style={{ "--pill-c": STATUS_COLORS[st.level] } as React.CSSProperties}
                >
                  {STATUS_LABELS[st.level]}
                </span>
                <span>
                  💧 <b>{st.label}</b>
                </span>
                <span>
                  🍤{" "}
                  {st.daysSinceFeed == null
                    ? "not fed"
                    : st.daysSinceFeed === 0
                    ? "fed today"
                    : `${st.daysSinceFeed}d ago`}
                </span>
              </div>
            </div>
            <div className="quick">
              <button
                className="primary"
                onClick={() => onLogChange(t)}
                aria-label={`Log water change for ${t.name}`}
              >
                Water ✓
              </button>
              <button
                onClick={() => onLogFeed(t)}
                aria-label={`Log feeding for ${t.name}`}
              >
                Fed ✓
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
