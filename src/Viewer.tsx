import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPart, disposePart } from "./export";
import type { Part } from "./model";
import { NumberField } from "./Editor";
export default function Viewer({
  part,
  onChange,
}: {
  part: Part;
  onChange: (p: Part) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    preset = useRef<(v: string) => void>(() => {});
  const [display, setDisplay] = useState("Solid"),
    [error, setError] = useState("");
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "3D needs WebGL. Try another browser; SVG and STL exports still work.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9eeeb");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    const group = buildPart(part);
    scene.add(group);
    group.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (display === "Transparent") {
        mat.transparent = true;
        mat.opacity = 0.4;
        mat.depthWrite = false;
      }
      if (display === "Edges") {
        mat.visible = false;
        mesh.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry),
            new THREE.LineBasicMaterial({ color: 0x163d38 }),
          ),
        );
      }
    });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x495953, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(50, -80, 100);
    scene.add(light);
    const size = new THREE.Box3()
      .setFromObject(group)
      .getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 5);
    preset.current = (v) => {
      const vectors: Record<string, number[]> = {
        Front: [0, -1, 0],
        Top: [0, 0, 1],
        Side: [1, 0, 0],
        Isometric: [1, -1, 1],
      };
      camera.position
        .fromArray(vectors[v] ?? vectors.Isometric)
        .normalize()
        .multiplyScalar(radius * 3.5);
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controls.update();
    };
    preset.current("Isometric");
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      disposePart(group);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [part, display]);
  return (
    <>
      <div className="toolbar">
        <NumberField
          label="Extrusion depth (mm)"
          value={part.depth}
          min={0.1}
          onChange={(depth) => onChange({ ...part, depth })}
        />
        <label>
          Display{" "}
          <select value={display} onChange={(e) => setDisplay(e.target.value)}>
            {["Solid", "Edges", "Transparent"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="viewer" ref={host}>
        {error && <p role="alert">{error}</p>}
      </div>
      {!part.entities.some((e) => e.type !== "line") && (
        <p className="notice">
          Draw a rectangle or circle in 2D to create a solid.
        </p>
      )}
      <p className="hint">
        Camera orbit: drag with one finger. Pinch to zoom; use two fingers to
        pan. Desktop: drag to orbit, right-drag to pan.
      </p>
      <div className="toolbar">
        {["Front", "Top", "Side", "Isometric"].map((v) => (
          <button key={v} onClick={() => preset.current(v)}>
            {v}
          </button>
        ))}
        <button onClick={() => preset.current("Isometric")}>
          Reset camera
        </button>
      </div>
      <details>
        <summary>Part orientation (affects STL)</summary>
        <div className="toolbar">
          {["X", "Y", "Z"].map((axis, i) => (
            <button
              key={axis}
              onClick={() => {
                const orientation = [...part.orientation] as [
                  number,
                  number,
                  number,
                ];
                orientation[i] = (orientation[i] + 90) % 360;
                onChange({ ...part, orientation });
              }}
            >
              Rotate {axis} · {part.orientation[i]}°
            </button>
          ))}
        </div>
      </details>
      <p className="notice">
        Rectangles are outer solids, circles remain separate solids, and
        explicit holes cut through their linked rectangle. Lines are guides
        only and do not extrude.
      </p>
    </>
  );
}
