import { useLayoutEffect, useRef, useState } from "react";
import type { Pt, RoomShape, Stack, Tank } from "./types";
import {
  getStatus,
  nodeRadius,
  stackMembers,
  statusColor,
  summarizeStack,
} from "./status";

interface Props {
  stacks: Stack[];
  tanks: Tank[];
  room?: RoomShape;
  now: number;
  editRoom: boolean;
  onOpenStack: (stack: Stack) => void;
  onMoveStack: (id: string, x: number, y: number) => void;
  onRoomChange: (points: Pt[]) => void;
  onCloseRoom: () => void;
}

/** How close (px) a tap must be to the first dot to close the outline. */
const CLOSE_HIT = 20;

const DRAG_THRESHOLD = 6;

export default function FishroomMap({
  stacks,
  tanks,
  room,
  now,
  editRoom,
  onOpenStack,
  onMoveStack,
  onRoomChange,
  onCloseRoom,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{
    kind: "stack" | "vertex";
    id: string;
    index?: number;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [, force] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  function clientToNorm(clientX: number, clientY: number): Pt {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    };
  }

  // ---- Stack drag / tap ----
  function stackDown(e: React.PointerEvent, stack: Stack) {
    if (editRoom) return;
    capturePointer(e);
    drag.current = {
      kind: "stack",
      id: stack.id,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }

  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const travelled = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.moved && travelled < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      force((n) => n + 1);
    }
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    if (d.kind === "stack") onMoveStack(d.id, x, y);
    else if (d.kind === "vertex" && room) {
      const pts = room.points.map((p, i) =>
        i === d.index ? { x, y } : p
      );
      onRoomChange(pts);
    }
  }

  function stackUp(e: React.PointerEvent, stack: Stack) {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved) onOpenStack(stack);
  }

  // ---- Room editing ----
  function vertexDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    capturePointer(e);
    drag.current = {
      kind: "vertex",
      id: "room",
      index,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }
  function vertexUp(e: React.PointerEvent, index: number) {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.pointerId) return;
    // While drawing, a tap (no drag) on the first dot closes the outline.
    if (!d.moved && drawing && index === 0 && points.length >= 3) onCloseRoom();
  }

  function bgClick(e: React.PointerEvent) {
    if (!editRoom) return;
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    // Tapping near the first dot finishes the shape instead of adding a corner.
    if (drawing && points.length >= 3) {
      const p0 = points[0];
      if (Math.hypot((p0.x - x) * size.w, (p0.y - y) * size.h) < CLOSE_HIT) {
        onCloseRoom();
        return;
      }
    }
    onRoomChange([...points, { x, y }]);
  }

  const points = room?.points ?? [];
  // `closed === false` means the user is still dropping corners.
  const drawing = editRoom && room?.closed === false;
  const polyPoints = points.map((p) => `${p.x * size.w},${p.y * size.h}`).join(" ");

  return (
    <div className="map-wrap" ref={wrapRef}>
      {/* Room outline + (in edit mode) the click surface */}
      {size.w > 0 && (
        <svg
          className="room-svg"
          width={size.w}
          height={size.h}
          onPointerDown={editRoom ? bgClick : undefined}
          style={{ pointerEvents: editRoom ? "auto" : "none" }}
        >
          {points.length >= 2 &&
            (drawing ? (
              <polyline
                className="room-line"
                points={polyPoints}
                style={{ pointerEvents: "none" }}
              />
            ) : (
              <polygon
                className="room-poly"
                points={polyPoints}
                style={{ pointerEvents: "none" }}
              />
            ))}
          {editRoom &&
            points.map((p, i) => {
              const isCloseTarget = drawing && i === 0 && points.length >= 3;
              return (
                <circle
                  key={i}
                  cx={p.x * size.w}
                  cy={p.y * size.h}
                  r={isCloseTarget ? 13 : 11}
                  className={"room-handle" + (isCloseTarget ? " start" : "")}
                  onPointerDown={(e) => vertexDown(e, i)}
                  onPointerMove={pointerMove}
                  onPointerUp={(e) => vertexUp(e, i)}
                />
              );
            })}
        </svg>
      )}

      {/* Stacks / racks */}
      {size.w > 0 &&
        !editRoom &&
        stacks.map((stack) => {
          const members = stackMembers(tanks, stack.id);
          if (members.length === 0) return null;
          const sum = summarizeStack(members, now);
          const left = stack.x * size.w;
          const top = stack.y * size.h;
          const dragging = drag.current?.id === stack.id && drag.current.moved;
          const label = stack.label || members[0].name;

          return (
            <div key={stack.id}>
              {members.length === 1
                ? renderSingle(members[0], left, top, now, dragging)
                : renderRack(members, sum, left, top, now, dragging)}
              <div
                className="node-hit"
                style={{
                  left,
                  top,
                  width: hitSize(sum.maxVolume, members.length),
                  height: hitSize(sum.maxVolume, members.length),
                }}
                onPointerDown={(e) => stackDown(e, stack)}
                onPointerMove={pointerMove}
                onPointerUp={(e) => stackUp(e, stack)}
                onPointerCancel={() => (drag.current = null)}
              />
              <div className="node-label" style={{ left, top: top + labelOffset(sum, members.length) }}>
                {label}
                {members.length > 1 && (
                  <span className="count"> · {members.length}</span>
                )}
              </div>
            </div>
          );
        })}

      {!editRoom && (
        <div className="map-hint">Tap a rack to open · drag to arrange</div>
      )}
    </div>
  );
}

/** Capture the pointer, ignoring failures (e.g. already-released pointers). */
function capturePointer(e: React.PointerEvent) {
  try {
    (e.target as Element).setPointerCapture(e.pointerId);
  } catch {
    /* capture is a best-effort optimization; dragging still works without it */
  }
}

function clamp(v: number, lo = 0.04, hi = 0.96): number {
  return Math.max(lo, Math.min(hi, v));
}

function fmtVol(g: number): string {
  return g >= 100 ? `${Math.round(g)}` : `${g}g`;
}

function hitSize(maxVolume: number, count: number): number {
  if (count === 1) return nodeRadius(maxVolume) * 2;
  return Math.max(rackWidth(maxVolume), 52);
}
function labelOffset(sum: { maxVolume: number }, count: number): number {
  if (count === 1) return nodeRadius(sum.maxVolume) + 4;
  return rackHeight(count) / 2 + 6;
}

function rackWidth(maxVolume: number): number {
  // Wide enough that the volume + days labels on a shelf never collide.
  return Math.max(64, Math.min(96, nodeRadius(maxVolume) * 1.7));
}
function rackHeight(count: number): number {
  const band = 16;
  const gap = 4;
  const pad = 10;
  return count * band + (count - 1) * gap + pad;
}

function renderSingle(
  t: Tank,
  left: number,
  top: number,
  now: number,
  dragging: boolean
) {
  const st = getStatus(t, now);
  const r = nodeRadius(t.volumeGallons);
  const color = statusColor(st.ratio);
  return (
    <div
      className={"node" + (dragging ? " dragging" : "")}
      style={{
        left,
        top,
        width: r * 2,
        height: r * 2,
        background: `radial-gradient(circle at 35% 30%, ${lighten(color)}, ${color})`,
      }}
    >
      <span className="node-vol">{fmtVol(t.volumeGallons)}</span>
      <span className="node-days">
        {st.daysSinceChange == null ? "—" : `${st.daysSinceChange}d`}
      </span>
    </div>
  );
}

function renderRack(
  members: Tank[],
  sum: { maxVolume: number; attention: number },
  left: number,
  top: number,
  now: number,
  dragging: boolean
) {
  const w = rackWidth(sum.maxVolume);
  const h = rackHeight(members.length);
  return (
    <div
      className={"rack" + (dragging ? " dragging" : "")}
      style={{ left, top, width: w, height: h }}
    >
      {members.map((t) => {
        const st = getStatus(t, now);
        const color = statusColor(st.ratio);
        return (
          <div
            key={t.id}
            className="shelf"
            style={{
              background: `linear-gradient(90deg, ${color}, ${lighten(color)})`,
            }}
          >
            <span className="shelf-vol">{fmtVol(t.volumeGallons)}</span>
            <span className="shelf-days">
              {st.daysSinceChange == null ? "—" : `${st.daysSinceChange}d`}
            </span>
          </div>
        );
      })}
      {sum.attention > 0 && <span className="rack-badge">{sum.attention}</span>}
    </div>
  );
}

function lighten(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  const [r, g, b] = m.map(Number);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
