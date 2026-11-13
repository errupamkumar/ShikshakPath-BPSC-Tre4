import "server-only";
import { type EbookType, isEbookType } from "./ebook-types";
import { db } from "./firebase-admin";

/** A PDF (eBook) uploaded by the admin: Notes, PYQ, Strategy guide or Others. Firestore resources/{id}. */
export type ResourceType = EbookType;
export type ResourceDoc = {
  type: ResourceType;
  title: string;
  description: string;
  author: string; // e.g. "A. Kumar, BPSC TRE selected teacher" (strategy guides by experts)
  subject: string; // subject key, or "" for all subjects
  examKey: string; // exam key, or ""
  free: boolean;
  hidden: boolean;
  storagePath: string; // resources/<uuid>.pdf in the Storage bucket
  fileName: string;
  size: number; // bytes
  createdAt: number;
  uploadedBy: string;
};
export type Resource = ResourceDoc & { id: string };

export const isResourceType = isEbookType;

export async function listResources(opts: { type?: ResourceType; includeHidden?: boolean } = {}): Promise<Resource[]> {
  const snap = await db().collection("resources").orderBy("createdAt", "desc").limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ResourceDoc) }))
    .filter((r) => (!opts.type || r.type === opts.type) && (opts.includeHidden || !r.hidden));
}

export async function getResource(id: string): Promise<Resource | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) return null;
  const snap = await db().doc(`resources/${id}`).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as ResourceDoc) } : null;
}

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
