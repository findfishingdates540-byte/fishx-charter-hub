/**
 * Full-screen chrome for every messaging surface (angler + all operator
 * verticals). Covers the whole viewport, keeps one header with a back button,
 * and hands the remaining space to the inbox.
 */
import { useEffect, type ReactNode } from "react";
import { chatPalette, type ChatTheme } from "@/components/messages/chat-ui";

export function MessagesFullScreen({
  theme = "dark",
  title = "Messages",
  subtitle,
  onBack,
  children,
}: {
  theme?: ChatTheme;
  title?: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const c = chatPalette(theme);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        zIndex: 120,
        background: c.surface,
        color: c.text,
        fontFamily: c.sans,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          borderBottom: `1px solid ${c.line}`,
          background: c.surface,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            background: "transparent",
            border: `1px solid ${c.line}`,
            color: c.text,
            borderRadius: 10,
            padding: "8px 13px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            flex: "none",
          }}
        >
          ← Back
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "clamp(16px, 4.4vw, 19px)",
              fontWeight: 700,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: c.mut,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
