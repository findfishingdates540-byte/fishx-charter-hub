/**
 * Client-safe resolver for operator media.
 *
 * Uploaded images live in the public `business-media` / `avatars` Storage
 * buckets. Older rows still hold legacy proxy paths like
 * `/api/public/media/<businessId>/public/<file>`, which broke in preview and
 * on some hosts. This maps any stored value to a directly loadable URL.
 */
const SUPABASE_URL =
  (import.meta as any)?.env?.VITE_SUPABASE_URL || "https://zibmbgvhretnuvgiytmx.supabase.co";

const LEGACY = [
  { prefix: "/api/public/media/", bucket: "business-media" },
  { prefix: "/api/public/avatars/", bucket: "avatars" },
];

export function publicStorageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function mediaUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  for (const { prefix, bucket } of LEGACY) {
    if (v.startsWith(prefix)) return publicStorageUrl(bucket, v.slice(prefix.length));
  }
  return v;
}
