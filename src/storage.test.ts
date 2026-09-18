import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { loadDocument, saveDocument } from "./storage";
import { newPart, type Document, type LegacyDocument } from "./model";
it("round trips the full versioned document through IndexedDB without losing entity IDs or photos", async () => {
  expect(await loadDocument()).toEqual({ version: 2, projects: [] });
  const part = newPart("folder", "Bracket");
  part.sourceImage = {
    data: "data:image/jpeg;base64,dGVzdA==",
    width: 200,
    height: 100,
    mmPerPixel: 0.25,
    opacity: 0.5,
  };
  part.entities = [
    { id: "outer-1", type: "rectangle", x: 0, y: 0, width: 40, height: 30 },
    { id: "circle-1", type: "circle", x: 12.5, y: -7, diameter: 8 },
    {
      id: "hole-1",
      type: "hole",
      x: 20,
      y: 15,
      diameter: 6,
      outerId: "outer-1",
    },
  ];
  const doc: Document = {
    version: 2,
    projects: [
      {
        id: "project",
        name: "Test",
        folders: [{ id: "folder", name: "Parts" }],
        parts: [part],
        createdAt: part.createdAt,
        updatedAt: part.updatedAt,
      },
    ],
  };
  await saveDocument(doc);
  expect(await loadDocument()).toEqual(doc);
  expect(JSON.parse(JSON.stringify(await loadDocument()))).toEqual(doc);
  await saveDocument({ version: 1, projects: [] });
  expect((await loadDocument()).projects).toEqual([]);
});

it("migrates version 1 documents without changing additive circles", async () => {
  const legacyPart = newPart("folder", "Legacy");
  legacyPart.entities = [
    { id: "circle-legacy", type: "circle", x: 4, y: 5, diameter: 6 },
  ];
  const legacy: LegacyDocument = {
    version: 1,
    projects: [
      {
        id: "legacy-project",
        name: "Legacy",
        folders: [{ id: "folder", name: "Parts" }],
        parts: [legacyPart],
        createdAt: legacyPart.createdAt,
        updatedAt: legacyPart.updatedAt,
      },
    ],
  };
  await saveDocument(legacy);
  const migrated = await loadDocument();
  expect(migrated.version).toBe(2);
  expect(migrated.projects[0].parts[0].entities).toEqual(legacyPart.entities);
});
