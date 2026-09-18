import { useEffect, useRef, useState } from "react";
import {
  bounds,
  updateDepth,
  updateHole,
  updateRectangle,
  type DimensionAxis,
  type Entity,
  type Part,
  type RectangleSide,
} from "./model";

type Dimension = DimensionAxis | "diameter" | "depth";
type Drag =
  | { kind: "rectangle"; side: RectangleSide; pointerId: number }
  | { kind: "hole-move"; pointerId: number }
  | { kind: "hole-diameter"; pointerId: number }
  | { kind: "depth"; pointerId: number };

type Props = {
  part: Part;
  onChange: (part: Part) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onFallback: () => void;
};

const LONG_PRESS_MS = 800;
const MIN_TOUCH_MOVE = 8;

function format(value: number) {
  return `${Number(value.toFixed(2))} mm`;
}

export default function DirectEditView({
  part,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  onFallback,
}: Props) {
  const outer = part.entities.find(
    (entity): entity is Extract<Entity, { type: "rectangle" }> =>
      entity.type === "rectangle",
  );
  const holes = part.entities.filter(
    (entity): entity is Extract<Entity, { type: "hole" }> =>
      entity.type === "hole" && entity.outerId === outer?.id,
  );
  const [selected, setSelected] = useState<string>(outer?.id ?? "");
  const [surface, setSurface] = useState<"xy" | "depth">("xy");
  const [editing, setEditing] = useState<Dimension>();
  const [draft, setDraft] = useState("");
  const drag = useRef<Drag | undefined>(undefined);
  const press = useRef<{
    dimension: Dimension;
    startX: number;
    startY: number;
    timer: number;
  } | undefined>(undefined);
  const svg = useRef<SVGSVGElement>(null);
  const depthSvg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (outer && !part.entities.some((entity) => entity.id === selected))
      setSelected(outer.id);
  }, [outer, part.entities, selected]);

  if (!outer) {
    return (
      <div className="direct-edit-empty">
        <p>Direct Edit necesita una pieza rectangular.</p>
        <button onClick={onFallback}>Abrir editor avanzado</button>
      </div>
    );
  }

  const selectedHole = holes.find((hole) => hole.id === selected);
  const selectedBody = selected === outer.id;
  const view = (() => {
    const b = bounds([outer, ...holes]);
    const padding = Math.max(b.width, b.height, 10) * 0.32;
    return {
      x: b.x - padding,
      y: b.y - padding,
      width: b.width + padding * 2,
      height: b.height + padding * 2,
    };
  })();
  const scale = Math.min(view.width / 280, view.height / 220);
  const dimensionFont = Math.max(3.5, Math.min(view.width, view.height) / 24);

  function xyPoint(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.height,
    };
  }

  function depthPoint(event: React.PointerEvent<SVGSVGElement>) {
    const rect = depthSvg.current!.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * 100;
  }

  function stopPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = undefined;
  }

  function openNumeric(dimension: Dimension) {
    const value =
      dimension === "width"
        ? outer!.width
        : dimension === "height"
          ? outer!.height
          : dimension === "depth"
            ? part.depth
            : selectedHole?.diameter ?? 0;
    setEditing(dimension);
    setDraft(String(Number(value.toFixed(6))));
  }

  function finishNumeric(save: boolean) {
    if (!editing) return;
    const value = Number(draft);
    if (save && Number.isFinite(value) && value > 0) {
      if (editing === "width")
        onChange(updateRectangle(part, outer!.id, "right", outer!.x + value));
      else if (editing === "height")
        onChange(updateRectangle(part, outer!.id, "bottom", outer!.y + value));
      else if (editing === "depth") onChange(updateDepth(part, value));
      else if (selectedHole) onChange(updateHole(part, selectedHole.id, { diameter: value }));
    }
    setEditing(undefined);
  }

  function beginDimension(event: React.PointerEvent, dimension: Dimension) {
    event.stopPropagation();
    stopPress();
    press.current = {
      dimension,
      startX: event.clientX,
      startY: event.clientY,
      timer: window.setTimeout(() => openNumeric(dimension), LONG_PRESS_MS),
    };
  }

  function moveDimension(event: React.PointerEvent) {
    if (!press.current) return;
    if (
      Math.hypot(
        event.clientX - press.current.startX,
        event.clientY - press.current.startY,
      ) > MIN_TOUCH_MOVE
    )
      stopPress();
  }

  function tapDimension(dimension: Dimension) {
    if (!editing) setSelected(dimension === "diameter" ? selectedHole?.id ?? selected : outer!.id);
  }

  function startXY(event: React.PointerEvent<SVGSVGElement>) {
    if (editing || (event.pointerType === "mouse" && event.button !== 0)) return;
    const target = event.target as SVGElement;
    const id = target.dataset.id;
    const handle = target.dataset.handle;
    if (!id && !handle) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (id) setSelected(id);
    if (handle === "right" || handle === "left" || handle === "top" || handle === "bottom") {
      drag.current = { kind: "rectangle", side: handle, pointerId: event.pointerId };
    } else if (handle === "hole-center") {
      drag.current = { kind: "hole-move", pointerId: event.pointerId };
    } else if (handle === "hole-diameter") {
      drag.current = { kind: "hole-diameter", pointerId: event.pointerId };
    } else return;
    onInteractionStart?.();
  }

  function startHandle(
    event: React.PointerEvent<SVGCircleElement>,
    handle: RectangleSide | "hole-center" | "hole-diameter",
  ) {
    event.stopPropagation();
    if (editing) return;
    drag.current =
      handle === "hole-center"
        ? { kind: "hole-move", pointerId: event.pointerId }
        : handle === "hole-diameter"
          ? { kind: "hole-diameter", pointerId: event.pointerId }
          : { kind: "rectangle", side: handle, pointerId: event.pointerId };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Mouse fallback handlers continue the gesture when pointer capture is unavailable.
    }
    onInteractionStart?.();
  }

  function continueHandle(event: React.PointerEvent<SVGCircleElement>) {
    moveXY(event as unknown as React.PointerEvent<SVGSVGElement>);
  }

  function finishHandle(event: React.PointerEvent<SVGCircleElement>) {
    endXY(event as unknown as React.PointerEvent<SVGSVGElement>);
  }

  function mouseHandleDown(
    event: React.MouseEvent<SVGCircleElement>,
    handle: RectangleSide | "hole-center" | "hole-diameter",
  ) {
    startHandle(event as unknown as React.PointerEvent<SVGCircleElement>, handle);
  }

  function mouseHandleMove(event: React.MouseEvent<SVGCircleElement>) {
    continueHandle(event as unknown as React.PointerEvent<SVGCircleElement>);
  }

  function mouseHandleUp(event: React.MouseEvent<SVGCircleElement>) {
    finishHandle(event as unknown as React.PointerEvent<SVGCircleElement>);
  }

  function moveXY(event: React.PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = xyPoint(event);
    if (active.kind === "rectangle")
      onChange(updateRectangle(part, outer!.id, active.side, active.side === "left" || active.side === "right" ? point.x : point.y));
    else if (selectedHole) {
      if (active.kind === "hole-move") onChange(updateHole(part, selectedHole.id, point));
      else onChange(updateHole(part, selectedHole.id, { diameter: Math.hypot(point.x - selectedHole.x, point.y - selectedHole.y) * 2 }));
    }
  }

  function endXY(event: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    onInteractionEnd?.();
  }

  function startDepth(event: React.PointerEvent<SVGSVGElement>) {
    if (editing || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as SVGElement).dataset.handle !== "depth") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind: "depth", pointerId: event.pointerId };
    onInteractionStart?.();
  }

  function moveDepth(event: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.kind !== "depth" || drag.current.pointerId !== event.pointerId) return;
    const value = Math.max(0.1, depthPoint(event) / 10);
    onChange(updateDepth(part, value));
  }

  function endDepth(event: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.kind !== "depth" || drag.current.pointerId !== event.pointerId) return;
    drag.current = undefined;
    onInteractionEnd?.();
  }

  function startDepthHandle(event: React.PointerEvent<SVGCircleElement>) {
    event.stopPropagation();
    if (editing) return;
    drag.current = { kind: "depth", pointerId: event.pointerId };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The depth value is still updated by the SVG move fallback.
    }
    onInteractionStart?.();
  }

  function moveDepthHandle(event: React.PointerEvent<SVGCircleElement>) {
    moveDepth(event as unknown as React.PointerEvent<SVGSVGElement>);
  }

  function endDepthHandle(event: React.PointerEvent<SVGCircleElement>) {
    endDepth(event as unknown as React.PointerEvent<SVGSVGElement>);
  }

  function dimensionLabel(
    dimension: Dimension,
    x: number,
    y: number,
    value: number,
    anchor: "middle" | "start" = "middle",
  ) {
    const active = editing === dimension;
    return (
      <g
        className={`dimension-label ${active ? "active" : ""}`}
        onPointerDown={(event) => beginDimension(event, dimension)}
        onPointerMove={moveDimension}
        onPointerUp={() => {
          stopPress();
          tapDimension(dimension);
        }}
        onPointerCancel={stopPress}
      >
        <rect x={x - dimensionFont * 2.8} y={y - dimensionFont * 1.35} width={dimensionFont * 5.6} height={dimensionFont * 1.8} rx={dimensionFont * 0.25} />
        {active ? (
          <foreignObject x={x - dimensionFont * 2.5} y={y - dimensionFont * 1.2} width={dimensionFont * 5} height={dimensionFont * 1.7}>
            <input
              autoFocus
              className="inline-dimension-input"
              value={draft}
              inputMode="decimal"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => finishNumeric(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") finishNumeric(true);
                if (event.key === "Escape") finishNumeric(false);
              }}
            />
          </foreignObject>
        ) : (
          <text x={x} y={y} textAnchor={anchor}>{dimension === "diameter" ? `Ø${format(value)}` : format(value)}</text>
        )}
      </g>
    );
  }

  return (
    <section className="direct-edit" aria-label="Direct part editor">
      <div className="direct-edit-context">
        <strong>{selectedHole ? "Agujero seleccionado" : "Cuerpo seleccionado"}</strong>
        <button onClick={onFallback}>Editor avanzado</button>
      </div>
      {surface === "xy" ? (
        <svg
          ref={svg}
          className="direct-edit-surface"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          onPointerDown={startXY}
          onPointerMove={moveXY}
          onPointerUp={endXY}
          onPointerCancel={endXY}
        >
          <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="#fafbf6" />
          <rect data-id={outer.id} x={outer.x} y={outer.y} width={outer.width} height={outer.height} fill="#27b69822" stroke={selectedBody ? "#e27525" : "#163d38"} strokeWidth={scale} />
          {selectedBody && (
            <>
              <circle data-handle="left" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "left")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "left")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={outer.x} cy={outer.y + outer.height / 2} r={scale * 4} />
              <circle data-handle="right" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "right")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "right")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={outer.x + outer.width} cy={outer.y + outer.height / 2} r={scale * 4} />
              <circle data-handle="top" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "top")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "top")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={outer.x + outer.width / 2} cy={outer.y} r={scale * 4} />
              <circle data-handle="bottom" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "bottom")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "bottom")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={outer.x + outer.width / 2} cy={outer.y + outer.height} r={scale * 4} />
            </>
          )}
          {holes.map((hole) => {
            const active = hole.id === selected;
            return (
              <g key={hole.id} data-id={hole.id}>
                <circle data-id={hole.id} pointerEvents="all" cx={hole.x} cy={hole.y} r={hole.diameter / 2} fill={active ? "#e2752533" : "#087d6911"} stroke={active ? "#e27525" : "#087d69"} strokeWidth={scale * (active ? 1.5 : 1)} strokeDasharray={active ? "none" : `${scale * 4} ${scale * 3}`} />
                {active && (
                  <>
                    <circle data-handle="hole-center" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "hole-center")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "hole-center")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={hole.x} cy={hole.y} r={scale * 5} fill="#e27525" />
                    <circle data-handle="hole-diameter" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={(event) => startHandle(event, "hole-diameter")} onPointerMove={continueHandle} onPointerUp={finishHandle} onMouseDown={(event) => mouseHandleDown(event, "hole-diameter")} onMouseMove={mouseHandleMove} onMouseUp={mouseHandleUp} cx={hole.x + hole.diameter / 2} cy={hole.y} r={scale * 4} fill="white" stroke="#e27525" strokeWidth={scale} />
                  </>
                )}
              </g>
            );
          })}
          {dimensionLabel("width", outer.x + outer.width / 2, outer.y - dimensionFont * 2, outer.width)}
          {dimensionLabel("height", outer.x - dimensionFont * 3.5, outer.y + outer.height / 2, outer.height, "start")}
          {selectedHole && dimensionLabel("diameter", selectedHole.x, selectedHole.y + selectedHole.diameter / 2 + dimensionFont * 3, selectedHole.diameter)}
        </svg>
      ) : (
        <svg
          ref={depthSvg}
          className="direct-depth-surface"
          viewBox="0 0 100 80"
          onPointerDown={startDepth}
          onPointerMove={moveDepth}
          onPointerUp={endDepth}
          onPointerCancel={endDepth}
        >
          <rect x="10" y="30" width="80" height="20" rx="3" fill="#27b69822" stroke="#163d38" strokeWidth="1" />
          <line x1="10" y1="60" x2="90" y2="60" stroke="#9aada4" strokeWidth="1" />
          <circle data-handle="depth" pointerEvents="all" style={{ touchAction: "none" }} onPointerDown={startDepthHandle} onPointerMove={moveDepthHandle} onPointerUp={endDepthHandle} cx={10 + Math.min(80, part.depth * 10)} cy="60" r="5" fill="#e27525" />
          {dimensionLabel("depth", 50, 22, part.depth)}
        </svg>
      )}
      {surface === "depth" && (
        <label className="direct-depth-range">
          Grosor {format(part.depth)}
          <input
            aria-label="Grosor directo"
            type="range"
            min="0.1"
            max="50"
            step="0.1"
            value={part.depth}
            onChange={(event) => onChange(updateDepth(part, event.target.valueAsNumber))}
          />
        </label>
      )}
      <div className="direct-edit-tools">
        <button className={surface === "xy" ? "active" : ""} onClick={() => setSurface("xy")}>Editar forma</button>
        <button className={surface === "depth" ? "active" : ""} onClick={() => setSurface("depth")}>Grosor {format(part.depth)}</button>
        {selectedHole && <button onClick={() => onChange({ ...part, entities: part.entities.filter((entity) => entity.id !== selectedHole.id) })}>Eliminar agujero</button>}
        <button onClick={() => setSelected(outer.id)}>Seleccionar cuerpo</button>
      </div>
      <p className="direct-edit-hint">Arrastra los puntos naranjas. Toca una medida para seleccionarla; mantenla 800 ms para editarla con precisión.</p>
    </section>
  );
}
