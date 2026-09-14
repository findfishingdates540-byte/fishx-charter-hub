/**
 * Client-side resolver for operator media.
 *
 * Uploaded images live in private Storage buckets and are stored as stable
 * paths like `/api/public/media/<businessId>/public/<file>`. That proxy route
 * is not reachable from every host (the editor preview gates it), which shows
 * up as broken images in dashboards and editors. Resolving the path to a
 * short-lived signed Storage URL in the browser makes it render everywhere:
 * operators and staff already have read access to their own bucket paths.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 60 * 60 * 6;
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

/** Returns a directly loadable URL, or "" when it still needs resolving. */
export function cachedMediaUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  if (!match(v)) return v; // already an absolute/blob/data URL
  const hit = cache.get(v);
  return hit && hit.exp > Date.now() ? hit.url : "";
}

export async function resolveMediaUrl(value: string | null | undefined): Promise<string> {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v;

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
