/**
 * Image picker for operator forms — upload a file instead of pasting a URL.
 *
 * Files go to the private `business-media` bucket under
 * `<businessId>/public/<name>` and are served back through the public media
 * proxy route, so anglers can see them on listings without the bucket itself
 * being public. Pasting a URL still works for operators using their own CDN.
 */
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMediaUrl } from "@/lib/media-url";

const MAX_BYTES = 8 * 1024 * 1024;

export function ImageUpload({
  businessId,
  value,
  onChange,
  label = "Image",
  aspect = "16 / 9",
  disabled,
}: {
  businessId: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  aspect?: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Instant local preview while the upload (and later the media proxy) resolves.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // The preview belongs to one specific value. When the parent swaps in another
  // record (e.g. editing a different boat) the stale object URL must go, or every
  // form would keep showing the first image that was uploaded in this session.
  const [previewFor, setPreviewFor] = useState<string>(value);
  if (previewFor !== value && !busy) {
    setPreviewFor(value);
    setLocalPreview(null);
  }

  async function upload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");
    if (file.size > MAX_BYTES) return setErr("Image must be 8 MB or smaller.");

    setBusy(true);
    setLocalPreview(URL.createObjectURL(file));
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${crypto.randomUUID()}.${ext || "jpg"}`;
      const path = `${businessId}/public/${name}`;
      const { error } = await supabase.storage
        .from("business-media")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const nextUrl = `/api/public/media/${path}`;
      setPreviewFor(nextUrl);
      onChange(nextUrl);
    } catch (e) {
      setLocalPreview(null);
      setPreviewFor(value);
      setErr(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Stored values are private-bucket paths; resolve to a signed URL so the
  // preview renders in the editor and on every host.
  const resolvedValue = useMediaUrl(value);
  const preview = localPreview || resolvedValue;


  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "#92A0AB",
          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 168,
            aspectRatio: aspect,
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,.16)",
            background: "#1C2936",
            display: "grid",
            placeItems: "center",
            color: "#92A0AB",
            fontSize: 12,
            flex: "none",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt={label}
              loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            busy ? "Uploading…" : "No image"
          )}
        </div>


        <div style={{ display: "grid", gap: 8, minWidth: 220, flex: 1 }}>
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
                background: "#1C2936",
                color: "#F0F2F5",
                border: 0,
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: disabled || busy ? "default" : "pointer",
                opacity: disabled || busy ? 0.65 : 1,
              }}
            >
              {busy ? "Uploading…" : preview ? "Replace image" : "Upload image"}
            </button>
            {preview && !disabled && (
              <button
                type="button"
                onClick={() => { setLocalPreview(null); onChange(""); }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 10,
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#A9B6C1",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>

          <span style={{ fontSize: 11.5, color: "#92A0AB" }}>
            JPG, PNG or WebP up to 8 MB. Landscape photos look best.
          </span>
          {err && <span style={{ fontSize: 12, color: "#F87171" }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}
