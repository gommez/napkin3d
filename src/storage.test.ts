import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { loadDocument, saveDocument } from "./storage";
import { newPart, type Document } from "./model";
it("round trips the full versioned document through IndexedDB without losing entity IDs or photos", async () => {
  expect(await loadDocument()).toEqual({ version: 1, projects: [] });
  const part = newPart("folder", "Bracket");
  part.sourceImage = {
    data: "data:image/jpeg;base64,dGVzdA==",
    width: 200,
    height: 100,
    mmPerPixel: 0.25,
    opacity: 0.5,
  };
  part.entities = [
    { id: "circle-1", type: "circle", x: 12.5, y: -7, diameter: 8 },
  ];
  const doc: Document = {
    version: 1,
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
