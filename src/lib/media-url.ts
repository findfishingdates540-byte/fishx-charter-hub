/**
 * Client-side resolver for operator media.
 *
 * Uploaded images are stored as stable paths like
 * `/api/public/media/<businessId>/public/<file>` or
 * `/api/public/avatars/<path>`. That proxy route is not reachable from every
 * host (the editor preview gates it), which shows up as broken images in
 * dashboards and editors.
 *
 * Both `business-media` and `avatars` are PUBLIC buckets, so those paths
 * resolve instantly to permanent public URLs — no signing, no round trips.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_BUCKETS = new Set(["business-media", "avatars"]);
const BUCKETS: Array<{ prefix: string; bucket: string }> = [
  { prefix: "/api/public/media/", bucket: "business-media" },
  { prefix: "api/public/media/", bucket: "business-media" },
  { prefix: "/api/public/avatars/", bucket: "avatars" },
  { prefix: "api/public/avatars/", bucket: "avatars" },
  { prefix: "/storage/v1/object/public/business-media/", bucket: "business-media" },
  { prefix: "business-media/", bucket: "business-media" },
  { prefix: "avatars/", bucket: "avatars" },
];

const SIGN_RE = /\/storage\/v1\/object\/sign\/(business-media|avatars)\/([^?]+)/;

function match(value: string) {
  // Legacy signed URLs stored in the DB expire — rewrite them to public URLs.
  const sign = SIGN_RE.exec(value);
  if (sign) return { bucket: sign[1]!, path: sign[2]! };
  for (const b of BUCKETS) {
    if (value.startsWith(b.prefix)) return { bucket: b.bucket, path: value.slice(b.prefix.length) };
  }
  return null;
}

function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Returns a directly loadable URL (public buckets resolve instantly). */
export function cachedMediaUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v; // already an absolute/blob/data URL
  return publicUrl(m.bucket, m.path);
}

export async function resolveMediaUrl(value: string | null | undefined): Promise<string> {
  return cachedMediaUrl(value);
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
