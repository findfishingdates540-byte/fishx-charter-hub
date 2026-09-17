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
/** Private buckets need a short-lived signed URL (chat attachments). */
const PRIVATE_BUCKETS = new Set(["message-media"]);
const SIGN_TTL_SECONDS = 60 * 60 * 6;
const BUCKETS: Array<{ prefix: string; bucket: string }> = [
  { prefix: "/api/public/media/", bucket: "business-media" },
  { prefix: "api/public/media/", bucket: "business-media" },
  { prefix: "/api/public/avatars/", bucket: "avatars" },
  { prefix: "api/public/avatars/", bucket: "avatars" },
  { prefix: "/storage/v1/object/public/business-media/", bucket: "business-media" },
  { prefix: "/storage/v1/object/public/message-media/", bucket: "message-media" },
  { prefix: "business-media/", bucket: "business-media" },
  { prefix: "avatars/", bucket: "avatars" },
  { prefix: "message-media/", bucket: "message-media" },
];

const SIGN_RE = /\/storage\/v1\/object\/sign\/(business-media|avatars|message-media)\/([^?]+)/;
const PUBLIC_RE = /\/storage\/v1\/object\/public\/(business-media|avatars|message-media)\/(.+)$/;

function match(value: string) {
  // Legacy signed URLs stored in the DB expire — rewrite them to public URLs.
  const sign = SIGN_RE.exec(value);
  if (sign) return { bucket: sign[1]!, path: sign[2]! };
  const pub = PUBLIC_RE.exec(value);
  if (pub) return { bucket: pub[1]!, path: pub[2]! };
  for (const b of BUCKETS) {
    if (value.startsWith(b.prefix)) return { bucket: b.bucket, path: value.slice(b.prefix.length) };
  }
  return null;
}

function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const signedCache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

async function signedUrl(bucket: string, path: string): Promise<string> {
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_TTL_SECONDS);
    inflight.delete(key);
    if (error || !data?.signedUrl) return "";
    signedCache.set(key, {
      url: data.signedUrl,
      // refresh 10 minutes before the signature actually expires
      expires: Date.now() + (SIGN_TTL_SECONDS - 600) * 1000,
    });
    return data.signedUrl;
  })();
  inflight.set(key, p);
  return p;
}

/** Returns a directly loadable URL (public buckets resolve instantly). */
export function cachedMediaUrl(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v; // already an absolute/blob/data URL
  if (PRIVATE_BUCKETS.has(m.bucket)) {
    const hit = signedCache.get(`${m.bucket}/${m.path}`);
    return hit && hit.expires > Date.now() ? hit.url : "";
  }
  return publicUrl(m.bucket, m.path);
}

export async function resolveMediaUrl(value: string | null | undefined): Promise<string> {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const m = match(v);
  if (!m) return v;
  if (PRIVATE_BUCKETS.has(m.bucket)) return signedUrl(m.bucket, m.path);
  return publicUrl(m.bucket, m.path);
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
