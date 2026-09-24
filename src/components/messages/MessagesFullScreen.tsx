/**
 * Full-screen chrome for every messaging surface (angler + all operator
 * verticals). Covers the whole viewport, keeps one header with a back button,
 * and hands the remaining space to the inbox.
 */
import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { chatPalette, type ChatTheme } from "@/components/messages/chat-ui";
import { Button } from "@/components/ui/button";

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
      className="fx-msg-fullscreen"
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
      <header className="fx-msg-fullscreen-header" data-theme={theme}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="fx-msg-fullscreen-back"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="fx-msg-fullscreen-heading">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
