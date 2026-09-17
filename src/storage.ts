import { openDB } from "idb";
import type { Document } from "./model";
const db = () =>
  openDB("napkin3d", 1, {
    upgrade(db) {
      db.createObjectStore("documents");
    },
  });
export async function loadDocument(): Promise<Document> {
  return (
    (await (await db()).get("documents", "workspace")) ?? {
      version: 1,
      projects: [],
    }
  );
}
export async function saveDocument(document: Document) {
  await (await db()).put("documents", document, "workspace");
}
