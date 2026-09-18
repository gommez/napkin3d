import { openDB } from "idb";
import type { Document, LegacyDocument } from "./model";
const db = () =>
  openDB("napkin3d", 1, {
    upgrade(db) {
      db.createObjectStore("documents");
    },
  });
export async function loadDocument(): Promise<Document> {
  const stored = (await (await db()).get("documents", "workspace")) as
    | Document
    | LegacyDocument
    | undefined;
  if (!stored) return { version: 2, projects: [] };
  return stored.version === 1 ? { ...stored, version: 2 } : stored;
}
export async function saveDocument(document: Document | LegacyDocument) {
  await (await db()).put("documents", document, "workspace");
}
