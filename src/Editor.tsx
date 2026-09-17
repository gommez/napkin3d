import { useEffect, useRef, useState } from "react";
import {
  anchors,
  bounds,
  calibration,
  move,
  snap,
  uid,
  type Entity,
  type Part,
  type Point,
} from "./model";
export function NumberField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(6))));
  useEffect(() => setDraft(String(Number(value.toFixed(6)))), [value]);
  return (
    <label className="number">
      {label}
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={draft}
        onBlur={() => setDraft(String(Number(value.toFixed(6))))}
        min={min}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && (min === undefined || v >= min))
            onChange(v);
        }}
      />
    </label>
  );
}
export default function Editor({
  part,
  onChange,
}: {
  part: Part;
  onChange: (p: Part) => void;
}) {
  const [tool, setTool] = useState("Select"),
    [selected, setSelected] = useState<string>(),
    [grid, setGrid] = useState(true),
    [gridSnap, setGridSnap] = useState(false),
    [featureSnap, setFeatureSnap] = useState(true),
    [view, setView] = useState({ x: -10, y: -10, w: 120 }),
    [compare, setCompare] = useState("Both"),
    [points, setPoints] = useState<Point[]>([]),
    [distance, setDistance] = useState(10),
    [past, setPast] = useState<Part[]>([]),
    [future, setFuture] = useState<Part[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    start: Point;
    original: Part;
    entity?: Entity;
    handle?: number;
    pan?: typeof view;
    screen?: Point;
    pointerId?: number;
  }>(undefined);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    const el = svg.current!;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setRatio(r.height / r.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const photo = part.sourceImage;
  const entity = part.entities.find((e) => e.id === selected);
  function commit(p: Part) {
    setPast((s) => [...s.slice(-49), part]);
    setFuture([]);
    onChange(p);
  }
  function updateEntity(e: Entity) {
    commit({
      ...part,
      entities: part.entities.map((v) => (v.id === e.id ? e : v)),
    });
  }
  function point(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: view.x + ((e.clientX - r.left) / r.width) * view.w,
      y: view.y + ((e.clientY - r.top) / r.height) * view.w * ratio,
    };
  }
  function down(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || drag.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    setRatio(r.height / r.width);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    const target = e.target as SVGElement;
    const id = target.dataset.id;
    const ent = part.entities.find((v) => v.id === id);
    if (tool === "Calibrate") {
      setPoints((s) => (s.length >= 2 ? [p] : [...s, p]));
      return;
    }
    if (tool === "Pan") {
      drag.current = {
        start: p,
        original: part,
        pan: view,
        screen: { x: e.clientX, y: e.clientY },
        pointerId: e.pointerId,
      };
      return;
    }
    if (tool === "Select") {
      setSelected(id);
      if (ent)
        drag.current = {
          start: p,
          original: part,
          pointerId: e.pointerId,
          entity: ent,
          handle:
            target.dataset.handle === undefined
              ? undefined
              : Number(target.dataset.handle),
        };
      return;
    }
    const a = snap(p, part.entities, gridSnap, featureSnap, view.w / 40);
    const newEntity: Entity =
      tool === "Line"
        ? { id: uid(), type: "line", x1: a.x, y1: a.y, x2: a.x, y2: a.y }
        : tool === "Circle"
          ? { id: uid(), type: "circle", x: a.x, y: a.y, diameter: 0.1 }
          : {
              id: uid(),
              type: "rectangle",
              x: a.x,
              y: a.y,
              width: 0.1,
              height: 0.1,
            };
    drag.current = {
      start: a,
      original: part,
      entity: newEntity,
      handle: -1,
      pointerId: e.pointerId,
    };
    onChange({ ...part, entities: [...part.entities, newEntity] });
    setSelected(newEntity.id);
  }
  function moving(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    let p = point(e);
    if (d.pan) {
      const r = svg.current!.getBoundingClientRect();
      setView({
        ...d.pan,
        x: d.pan.x - ((e.clientX - d.screen!.x) / r.width) * d.pan.w,
        y: d.pan.y - ((e.clientY - d.screen!.y) / r.height) * d.pan.w * ratio,
      });
      return;
    }
    if (!d.entity) return;
    p = snap(
      p,
      d.original.entities.filter((v) => v.id !== d.entity!.id),
      gridSnap,
      featureSnap,
      view.w / 40,
    );
    let next = d.entity;
    const a = d.start;
    if (d.handle === undefined) next = move(next, p.x - a.x, p.y - a.y);
    else if (next.type === "line") {
      next =
        d.handle === 0
          ? { ...next, x1: p.x, y1: p.y }
          : { ...next, x2: p.x, y2: p.y };
    } else if (next.type === "circle") {
      next = {
        ...next,
        diameter: Math.max(0.1, 2 * Math.hypot(p.x - next.x, p.y - next.y)),
      };
    } else {
      const origin = d.handle === -1 ? d.start : { x: next.x, y: next.y };
      next = {
        ...next,
        x: Math.min(origin.x, p.x),
        y: Math.min(origin.y, p.y),
        width: Math.max(0.1, Math.abs(p.x - origin.x)),
        height: Math.max(0.1, Math.abs(p.y - origin.y)),
      };
    }
    const exists = d.original.entities.some((v) => v.id === next.id);
    onChange({
      ...part,
      entities: exists
        ? d.original.entities.map((v) => (v.id === next.id ? next : v))
        : [...d.original.entities, next],
    });
  }
  function end(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    if (drag.current && !drag.current.pan) {
      const original = drag.current.original;
      setPast((s) => [...s.slice(-49), original]);
      setFuture([]);
    }
    drag.current = undefined;
  }
  function zoom(f: number) {
    const w = Math.min(10000, Math.max(2, view.w * f));
    setView({
      ...view,
      x: view.x + (view.w - w) / 2,
      y: view.y + ((view.w - w) * ratio) / 2,
      w,
    });
  }
  function fit() {
    const b = photo
      ? {
          x: 0,
          y: 0,
          width: photo.width * photo.mmPerPixel,
          height: photo.height * photo.mmPerPixel,
        }
      : bounds(part.entities);
    const w = Math.max(b.width, b.height / ratio, 10) * 1.15;
    setView({
      x: b.x - (w - b.width) / 2,
      y: b.y - (w * ratio - b.height) / 2,
      w,
    });
  }
  async function importPhoto(file?: File) {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      commit({
        ...part,
        sourceImage: {
          data: canvas.toDataURL("image/jpeg", 0.85),
          width: canvas.width,
          height: canvas.height,
          mmPerPixel: 100 / canvas.width,
          opacity: 0.55,
        },
      });
      setView({
        x: -10,
        y: -10,
        w: Math.max(120, ((canvas.height / canvas.width) * 100) / ratio + 20),
      });
    } catch {
      alert("This image could not be opened. Try a JPEG or PNG photo.");
    }
  }
  function shape(e: Entity) {
    const props = {
      "data-id": e.id,
      stroke: e.id === selected ? "#e27525" : "#087d69",
      strokeWidth: view.w / 250,
      fill: e.type === "line" ? "none" : "#27b69822",
    };
    return e.type === "line" ? (
      <line
        {...props}
        x1={e.x1}
        y1={e.y1}
        x2={e.x2}
        y2={e.y2}
        style={{ pointerEvents: "stroke" }}
      />
    ) : e.type === "rectangle" ? (
      <rect {...props} x={e.x} y={e.y} width={e.width} height={e.height} />
    ) : (
      <circle {...props} cx={e.x} cy={e.y} r={e.diameter / 2} />
    );
  }
  return (
    <>
      <div className="toolbar">
        <label className="button">
          Camera
          <input
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              void importPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <label className="button">
          Add photo
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              void importPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          disabled={!past.length}
          onClick={() => {
            setFuture([part, ...future]);
            onChange(past[past.length - 1]);
            setPast(past.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button
          disabled={!future.length}
          onClick={() => {
            setPast([...past, part]);
            onChange(future[0]);
            setFuture(future.slice(1));
          }}
        >
          Redo
        </button>
      </div>
      <div className="toolbar">
        {["Select", "Pan", "Line", "Rectangle", "Circle", "Calibrate"].map(
          (t) => (
            <button
              className={tool === t ? "active" : ""}
              key={t}
              disabled={t === "Calibrate" && !photo}
              onClick={() => {
                setTool(t);
                setPoints([]);
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <div className="canvas-wrap">
        <svg
          ref={svg}
          className="editor"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w * ratio}`}
          onPointerDown={down}
          onPointerMove={moving}
          onPointerUp={end}
          onPointerCancel={() => {
            if (drag.current) onChange(drag.current.original);
            drag.current = undefined;
          }}
          onWheel={(e) => zoom(e.deltaY > 0 ? 1.1 : 0.9)}
        >
          <defs>
            <pattern
              id="grid"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke="#b6c6c0"
                strokeWidth={view.w / 900}
              />
            </pattern>
          </defs>
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.w * ratio}
            fill="#fafbf6"
          />
          {photo && compare !== "Vector" && (
            <image
              href={photo.data}
              width={photo.width * photo.mmPerPixel}
              height={photo.height * photo.mmPerPixel}
              opacity={compare === "Photo" ? 1 : photo.opacity}
              pointerEvents="none"
            />
          )}
          {grid && (
            <rect
              x={view.x}
              y={view.y}
              width={view.w}
              height={view.w * ratio}
              fill="url(#grid)"
              pointerEvents="none"
            />
          )}
          {compare !== "Photo" &&
            part.entities.map((e) => (
              <g key={e.id}>
                {e.type === "line" && (
                  <line
                    data-id={e.id}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke="transparent"
                    strokeWidth={view.w / 25}
                  />
                )}{" "}
                {shape(e)}
              </g>
            ))}
          {entity &&
            compare !== "Photo" &&
            (entity.type === "rectangle"
              ? [{ x: entity.x + entity.width, y: entity.y + entity.height }]
              : entity.type === "circle"
                ? [{ x: entity.x + entity.diameter / 2, y: entity.y }]
                : anchors(entity)
            ).map((p, i) => (
              <circle
                key={i}
                data-id={entity.id}
                data-handle={i}
                cx={p.x}
                cy={p.y}
                r={view.w / 65}
                fill="white"
                stroke="#e27525"
                strokeWidth={view.w / 250}
              />
            ))}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={view.w / 80} fill="#e27525" />
          ))}
          {points.length === 2 && (
            <line
              x1={points[0].x}
              y1={points[0].y}
              x2={points[1].x}
              y2={points[1].y}
              stroke="#e27525"
              strokeWidth={view.w / 250}
            />
          )}
        </svg>
        <div className="zoom">
          <button aria-label="Zoom in" onClick={() => zoom(0.8)}>
            +
          </button>
          <button aria-label="Zoom out" onClick={() => zoom(1.25)}>
            −
          </button>
          <button onClick={fit}>Fit</button>
        </div>
      </div>
      <p className="hint">
        {tool === "Calibrate"
          ? "Tap two points on the photo, then enter their real distance."
          : tool === "Select"
            ? "Tap to select. Drag to move; drag white handles to resize."
            : tool === "Pan"
              ? "Drag the canvas to pan. Use + / − to zoom."
              : "Drag on the canvas to draw. Enter exact dimensions below."}{" "}
        All dimensions in mm.
      </p>
      <div className="toolbar">
        <label>
          <input
            type="checkbox"
            checked={grid}
            onChange={(e) => setGrid(e.target.checked)}
          />{" "}
          Grid (5 mm)
        </label>
        <label>
          <input
            type="checkbox"
            checked={gridSnap}
            onChange={(e) => setGridSnap(e.target.checked)}
          />{" "}
          Snap 1 mm
        </label>
        <label>
          <input
            type="checkbox"
            checked={featureSnap}
            onChange={(e) => setFeatureSnap(e.target.checked)}
          />{" "}
          Snap points
        </label>
      </div>
      {photo && (
        <details open={tool === "Calibrate"}>
          <summary>Photo & calibration</summary>
          <div className="toolbar">
            {["Photo", "Both", "Vector"].map((v) => (
              <button
                key={v}
                className={compare === v ? "active" : ""}
                onClick={() => setCompare(v)}
              >
                {v}
              </button>
            ))}
            <label>
              Opacity{" "}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={photo.opacity}
                onChange={(e) =>
                  onChange({
                    ...part,
                    sourceImage: { ...photo, opacity: +e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="fields">
            <NumberField
              label="mm / image pixel"
              value={photo.mmPerPixel}
              min={0.000001}
              onChange={(v) =>
                commit({ ...part, sourceImage: { ...photo, mmPerPixel: v } })
              }
            />
            {tool === "Calibrate" && (
              <>
                <NumberField
                  label="Real distance (mm)"
                  value={distance}
                  min={0.001}
                  onChange={setDistance}
                />
                <button
                  disabled={points.length !== 2}
                  onClick={() => {
                    try {
                      const px =
                        Math.hypot(
                          points[1].x - points[0].x,
                          points[1].y - points[0].y,
                        ) / photo.mmPerPixel;
                      commit({
                        ...part,
                        sourceImage: {
                          ...photo,
                          mmPerPixel: calibration(px, distance),
                        },
                      });
                      setPoints([]);
                      setTool("Select");
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  }}
                >
                  Apply calibration
                </button>
              </>
            )}
          </div>
          <p className="hint">
            Calibrate before tracing. Recalibration resizes the photo; existing
            geometry keeps its exact mm dimensions.
          </p>
        </details>
      )}
      <div className="properties">
        <label>
          Entities{" "}
          <select
            value={selected ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setTool("Select");
            }}
          >
            <option value="">Select an entity</option>
            {part.entities.map((e, i) => (
              <option key={e.id} value={e.id}>
                {i + 1}. {e.type}
              </option>
            ))}
          </select>
        </label>
        {entity ? (
          <>
            <div className="fields">
              {Object.entries(entity)
                .filter(([k]) => !["id", "type"].includes(k))
                .map(([k, v]) => (
                  <NumberField
                    key={k}
                    label={k}
                    value={v as number}
                    min={
                      ["width", "height", "diameter"].includes(k)
                        ? 0.1
                        : undefined
                    }
                    onChange={(n) => updateEntity({ ...entity, [k]: n })}
                  />
                ))}
            </div>
            <div className="toolbar">
              <button
                onClick={() => {
                  const copy = { ...move(entity, 5, 5), id: uid() };
                  commit({ ...part, entities: [...part.entities, copy] });
                  setSelected(copy.id);
                }}
              >
                Duplicate
              </button>
              <button
                onClick={() => {
                  commit({
                    ...part,
                    entities: part.entities.filter((e) => e.id !== selected),
                  });
                  setSelected(undefined);
                }}
              >
                Delete entity
              </button>
            </div>
          </>
        ) : (
          <p className="hint">
            Trace a rectangle, circle or line over your sketch.
          </p>
        )}
      </div>
    </>
  );
}
