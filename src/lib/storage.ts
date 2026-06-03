import { supabase } from "@/integrations/supabase/client";

const BUCKET = "client-files";

/**
 * Accepts either a raw storage path (e.g. "userId/foo.png") or an old public
 * URL stored before the bucket became private. Returns the path inside the
 * bucket, or null when not resolvable.
 */
export function extractStoragePath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
  if (urlOrPath.includes(marker)) {
    return urlOrPath.split(marker)[1].split("?")[0];
  }
  if (urlOrPath.includes(signedMarker)) {
    return urlOrPath.split(signedMarker)[1].split("?")[0];
  }
  // Already a path; reject absolute URLs to other origins
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) return null;
  return urlOrPath.replace(/^\/+/, "");
}

/**
 * Returns a temporary signed URL for a stored file. Falls back to the input
 * when it is an external URL we cannot sign.
 */
export async function getSignedFileUrl(
  urlOrPath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!urlOrPath) return null;
  const path = extractStoragePath(urlOrPath);
  if (!path) return urlOrPath; // external URL — return as-is
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Build the canonical storage path string we persist in DB columns. */
export function buildStoragePath(...segments: string[]): string {
  return segments.map((s) => s.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}