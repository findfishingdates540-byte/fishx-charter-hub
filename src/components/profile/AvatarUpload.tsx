/**
 * Round avatar picker — upload a photo instead of pasting a URL.
 *
 * Files go to the private `avatars` bucket under `<userId>/public/<name>` and
 * are served back through the public avatar proxy route, so the bucket itself
 * stays private. Shows a live circular preview of the cropped result.
 */
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMediaUrl } from "@/lib/media-url";

const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUpload({
  userId,
  value,
  onChange,
  fallback = "?",
  size = 96,
  disabled,
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  fallback?: string;
  size?: number;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Stored value is a private-bucket path; resolve it to a signed URL so the
  // preview shows up in the editor and on every host.
  const preview = useMediaUrl(value);

  async function upload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");
    if (file.size > MAX_BYTES) return setErr("Image must be 5 MB or smaller.");

    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${crypto.randomUUID()}.${ext || "jpg"}`;
      const path = `${userId}/public/${name}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      onChange(`/api/public/avatars/${path}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flex: "none",
          background: value ? `center/cover no-repeat url(${value})` : "#E2F6FA",
          border: "2px solid #E2F6FA",
          display: "grid",
          placeItems: "center",
          color: "#1F9FBE",
          fontFamily: "'Outfit',Georgia,serif",
          fontSize: size / 3,
          fontWeight: 600,
        }}
      >
        {!value && (busy ? "…" : fallback)}
      </div>

      <div style={{ display: "grid", gap: 8, minWidth: 200 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => fileRef.current?.click()}
            style={{
              background: "#031029",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: disabled || busy ? "default" : "pointer",
              opacity: disabled || busy ? 0.65 : 1,
            }}
          >
            {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </button>
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange("")}
              style={{
                background: "transparent",
                border: "1px solid rgba(13,34,54,.16)",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#44586a",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: "#8a97a3" }}>
          JPG, PNG or WebP up to 5 MB. Square photos look best.
        </span>
        {err && <span style={{ fontSize: 12, color: "#d8514a" }}>{err}</span>}
      </div>
    </div>
  );
}
