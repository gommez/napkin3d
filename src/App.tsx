import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Editor from "./Editor";
import {
  newPart,
  now,
  uid,
  type Document,
  type Part,
  type Project,
} from "./model";
import { loadDocument, saveDocument } from "./storage";
const Viewer = lazy(() => import("./Viewer"));
const named = (question: string, initial = "") =>
  prompt(question, initial)?.trim();
export default function App() {
  const [doc, setDoc] = useState<Document>({ version: 1, projects: [] }),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Loading…"),
    [projectId, setProjectId] = useState(""),
    [partId, setPartId] = useState(""),
    [mode, setMode] = useState("PROJECT");
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    loadDocument()
      .then((d) => {
        setDoc(d);
        setReady(true);
        setStatus("Saved on this device");
      })
      .catch(() =>
        setStatus(
          "Local storage unavailable. Reload or enable browser storage to continue.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!ready) return;
    setStatus("Saving…");
    let current = true;
    queue.current = queue.current
      .catch(() => {})
      .then(() => {
        if (current) return saveDocument(doc);
      })
      .then(() => {
        if (current) setStatus("Saved on this device");
      })
      .catch(() => {
        if (current)
          setStatus(
            "Save failed — storage may be full. Export your parts before closing.",
          );
      });
    return () => {
      current = false;
    };
  }, [doc, ready]);
  const project = doc.projects.find((p) => p.id === projectId),
    part = project?.parts.find((p) => p.id === partId);
  function updateProject(p: Project) {
    setDoc((d) => ({
      ...d,
      projects: d.projects.map((v) =>
        v.id === p.id ? { ...p, updatedAt: now() } : v,
      ),
    }));
  }
  function updatePart(p: Part) {
    if (project)
      updateProject({
        ...project,
        parts: project.parts.map((v) =>
          v.id === p.id ? { ...p, updatedAt: now() } : v,
        ),
      });
  }
  function addProject() {
    const name = named("Project name", "My first project");
    if (!name) return;
    const p: Project = {
      id: uid(),
      name,
      folders: [{ id: uid(), name: "Parts" }],
      parts: [],
      createdAt: now(),
      updatedAt: now(),
    };
    setDoc({ ...doc, projects: [...doc.projects, p] });
    setProjectId(p.id);
  }
  function addPart(folderId: string) {
    if (!project) return;
    const name = named("Part name", "New part");
    if (!name) return;
    const p = newPart(folderId, name);
    updateProject({ ...project, parts: [...project.parts, p] });
    setPartId(p.id);
    setMode("2D");
  }
  async function exportFile(format: "SVG" | "STL") {
    if (!part) return;
    try {
      const { exportSVG, exportSTL, download } = await import("./export");
      download(
        format === "SVG" ? exportSVG(part) : exportSTL(part),
        `${part.name.replace(/[^a-z0-9_-]/gi, "_")}.${format.toLowerCase()}`,
        format === "SVG" ? "image/svg+xml" : "model/stl",
      );
    } catch {
      alert("Export failed. Check your geometry and try again.");
    }
  }
  return (
    <div className="app">
      <header>
        <div>
          <h1>
            napkin<span>3d</span>
          </h1>
          <p>From sketch to something real.</p>
        </div>
        <small role="status">{status}</small>
      </header>
      <nav>
        {["PROJECT", "2D", "3D"].map((v) => (
          <button
            key={v}
            className={mode === v ? "active" : ""}
            disabled={v !== "PROJECT" && !part}
            onClick={() => setMode(v)}
          >
            {v}
          </button>
        ))}
      </nav>
      <main>
        {mode === "PROJECT" ? (
          <>
            <div className="section-title">
              <h2>Your projects</h2>
              <button
                disabled={!ready}
                className="primary"
                onClick={addProject}
              >
                + Project
              </button>
            </div>
            <p className="hint">
              Your work stays in this browser on this device. Export important
              parts; clearing browser data removes local projects.
            </p>
            {!doc.projects.length && (
              <div className="empty">
                <h2>A napkin is a great starting point.</h2>
                <p>
                  Create a project, add a part, then photograph your sketch and
                  trace it with simple shapes.
                </p>
                <button
                  disabled={!ready}
                  className="primary"
                  onClick={addProject}
                >
                  Create your first project
                </button>
              </div>
            )}
            <div className="project-list">
              {doc.projects.map((p) => (
                <button
                  className={projectId === p.id ? "active" : ""}
                  key={p.id}
                  onClick={() => {
                    setProjectId(p.id);
                    setPartId("");
                  }}
                >
                  {p.name}
                  <small>{p.parts.length} parts</small>
                </button>
              ))}
            </div>
            {project && (
              <section className="card">
                <div className="section-title">
                  <h2>{project.name}</h2>
                  <div className="toolbar">
                    <button
                      onClick={() => {
                        const name = named("Rename project", project.name);
                        if (name) updateProject({ ...project, name });
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(`Delete “${project.name}” and all its parts?`)
                        ) {
                          setDoc({
                            ...doc,
                            projects: doc.projects.filter(
                              (p) => p.id !== project.id,
                            ),
                          });
                          setProjectId("");
                          setPartId("");
                        }
                      }}
                    >
                      Delete project
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const name = named("Folder name", "New folder");
                    if (name)
                      updateProject({
                        ...project,
                        folders: [...project.folders, { id: uid(), name }],
                      });
                  }}
                >
                  + Folder
                </button>
                {project.folders.map((f) => (
                  <section className="folder" key={f.id}>
                    <div className="section-title">
                      <h3>▱ {f.name}</h3>
                      <button onClick={() => addPart(f.id)}>+ Part</button>
                    </div>
                    {project.parts
                      .filter((p) => p.folderId === f.id)
                      .map((p) => (
                        <div className="part-row" key={p.id}>
                          <button
                            className="part-open"
                            onClick={() => {
                              setPartId(p.id);
                              setMode("2D");
                            }}
                          >
                            <strong>{p.name}</strong>
                            <small>
                              {p.entities.length} entities · {p.depth} mm deep
                            </small>
                          </button>
                          <button
                            aria-label={`Rename ${p.name}`}
                            onClick={() => {
                              const name = named("Rename part", p.name);
                              if (name)
                                updateProject({
                                  ...project,
                                  parts: project.parts.map((v) =>
                                    v.id === p.id
                                      ? { ...v, name, updatedAt: now() }
                                      : v,
                                  ),
                                });
                            }}
                          >
                            Rename
                          </button>
                          <button
                            aria-label={`Delete ${p.name}`}
                            onClick={() => {
                              if (confirm(`Delete “${p.name}”?`)) {
                                updateProject({
                                  ...project,
                                  parts: project.parts.filter(
                                    (v) => v.id !== p.id,
                                  ),
                                });
                                if (partId === p.id) setPartId("");
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </section>
                ))}
              </section>
            )}
          </>
        ) : (
          part && (
            <>
              <div className="section-title">
                <div>
                  <small>{project?.name}</small>
                  <h2>{part.name}</h2>
                </div>
                <div className="toolbar">
                  <button
                    disabled={!part.entities.length}
                    onClick={() => void exportFile("SVG")}
                  >
                    SVG ↓
                  </button>
                  <button
                    disabled={!part.entities.some((e) => e.type !== "line")}
                    onClick={() => void exportFile("STL")}
                  >
                    STL ↓
                  </button>
                </div>
              </div>
              {mode === "2D" ? (
                <Editor key={part.id} part={part} onChange={updatePart} />
              ) : (
                <Suspense fallback={<p>Loading 3D viewer…</p>}>
                  <Viewer part={part} onChange={updatePart} />
                </Suspense>
              )}
            </>
          )
        )}
      </main>
      <footer>Made for rough sketches. Built in millimetres.</footer>
    </div>
  );
}
