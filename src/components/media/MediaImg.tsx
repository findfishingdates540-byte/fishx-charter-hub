/**
 * <img> that understands stored media paths.
 *
 * Operator uploads are stored as `/api/public/media/...` (or
 * `/api/public/avatars/...`) proxy paths. Those do not load on every host, so
 * this resolves them to signed Storage URLs in the browser before rendering.
 * Absolute URLs, blob previews and data URLs pass straight through.
 */
import type { ImgHTMLAttributes } from "react";
import { useMediaUrl } from "@/lib/media-url";

export function MediaImg({
  src,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null }) {
  const resolved = useMediaUrl(src);
  if (!resolved) return null;
  return <img {...rest} src={resolved} />;
}
