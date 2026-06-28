import { useLayoutEffect, useRef, useState } from "react";
import type { Tank } from "./types";
import { getStatus, nodeRadius, statusColor } from "./status";

interface Props {
  tanks: Tank[];
  now: number;
  onOpen: (tank: Tank) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const DRAG_THRESHOLD = 6; // px before a press becomes a drag

export default function FishroomMap({ tanks, now, onOpen, onMove }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{
    id: string;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [, force] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  function clientToNorm(clientX: number, clientY: number) {
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: Math.max(0.04, Math.min(0.96, x)),
      y: Math.max(0.05, Math.min(0.95, y)),
    };
  }

  function onPointerDown(e: React.PointerEvent, tank: Tank) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = {
      id: tank.id,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const travelled = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.moved && travelled < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      force((n) => n + 1); // re-render to show dragging style
    }
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    onMove(d.id, x, y);
  }

  function onPointerUp(e: React.PointerEvent, tank: Tank) {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved) onOpen(tank);
  }

  return (
    <div className="map-wrap" ref={wrapRef}>
      <div className="map-canvas">
        {size.w > 0 &&
          tanks.map((t) => {
            const st = getStatus(t, now);
            const r = nodeRadius(t.volumeGallons);
            const color = statusColor(st.ratio);
            const left = t.x * size.w;
            const top = t.y * size.h;
            const dragging = drag.current?.id === t.id && drag.current.moved;
            return (
              <div key={t.id}>
                <div
                  className={"node" + (dragging ? " dragging" : "")}
                  style={{
                    left,
                    top,
                    width: r * 2,
                    height: r * 2,
                    background: `radial-gradient(circle at 35% 30%, ${lighten(
                      color
                    )}, ${color})`,
                  }}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => onPointerUp(e, t)}
                  onPointerCancel={() => (drag.current = null)}
                >
                  <span className="node-vol">{fmtVol(t.volumeGallons)}</span>
                  <span className="node-days">
                    {st.daysSinceChange == null
                      ? "—"
                      : `${st.daysSinceChange}d`}
                  </span>
                </div>
                <div
                  className="node-label"
                  style={{ left, top: top + r + 4 }}
                >
                  {t.name}
                </div>
              </div>
            );
          })}
      </div>
      <div className="map-hint">Tap a tank to edit · drag to arrange</div>
    </div>
  );
}

function fmtVol(g: number): string {
  return g >= 100 ? `${Math.round(g)}` : `${g}g`;
}

// quick perceptual lighten for the node highlight
function lighten(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  const [r, g, b] = m.map(Number);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
