/**
 * Client-side resolver for operator media.
 *
 * Uploaded images are stored as stable paths like
 * `/api/public/media/<businessId>/public/<file>` or
 * `/api/public/avatars/<path>`. That proxy route is not reachable from every
 * host (the editor preview gates it), which shows up as broken images in
 * dashboards and editors.
 *
 * `business-media` is a PUBLIC bucket, so those paths resolve instantly to
 * permanent public URLs. `avatars` remains private, so its paths resolve to
 * short-lived signed URLs (authenticated users have read access to their own
 * avatar paths).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 60 * 60 * 6;
const PUBLIC_BUCKETS = new Set(["business-media"]);
const BUCKETS: Array<{ prefix: string; bucket: string }> = [
  { prefix: "/api/public/media/", bucket: "business-media" },
  { prefix: "/api/public/avatars/", bucket: "avatars" },
];

const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();

function match(value: string) {
  for (const b of BUCKETS) {
    if (value.startsWith(b.prefix)) return { bucket: b.bucket, path: value.slice(b.prefix.length) };
  }
  return null;
}

function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Returns a directly loadable URL, or "" when it still needs resolving. */
export function cachedMediaUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v; // already an absolute/blob/data URL
  if (PUBLIC_BUCKETS.has(m.bucket)) return publicUrl(m.bucket, m.path);
  const hit = cache.get(v);
  return hit && hit.exp > Date.now() ? hit.url : "";
}

export async function resolveMediaUrl(value: string | null | undefined): Promise<string> {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v;

  // Public buckets resolve instantly — no signing, no network round trip.
  if (PUBLIC_BUCKETS.has(m.bucket)) return publicUrl(m.bucket, m.path);

  const hit = cache.get(v);
  if (hit && hit.exp > Date.now()) return hit.url;

  const existing = inflight.get(v);
  if (existing) return existing;

  const p = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(m.bucket)
        .createSignedUrl(m.path, TTL_SECONDS);
      if (error || !data?.signedUrl) return v;
      cache.set(v, { url: data.signedUrl, exp: Date.now() + (TTL_SECONDS - 600) * 1000 });
      return data.signedUrl;
    } catch {
      return v;
    } finally {
      inflight.delete(v);
    }
  })();

  inflight.set(v, p);
  return p;
}

/** Hook form: resolves on mount and whenever the stored value changes. */
export function useMediaUrl(value: string | null | undefined): string {
  const [url, setUrl] = useState(() => cachedMediaUrl(value) || (value ?? ""));

  useEffect(() => {
    let alive = true;
    const immediate = cachedMediaUrl(value);
    if (immediate) {
      setUrl(immediate);
      return;
    }
    setUrl(value ?? "");
    void resolveMediaUrl(value).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return url;
}
