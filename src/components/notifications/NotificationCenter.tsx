/**
 * Full-page notification center. Shared by anglers and operators: the bell
 * shows the latest few, this page shows everything with read/unread and
 * category filters, paging, and the email preference toggles.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotificationCenter,
  markNotificationRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications.functions";

const V = {
  sans: "'Outfit',system-ui,sans-serif",
  ink: "#031029",
  navy: "#072057",
  cyan: "#1f9fbe",
  cyansoft: "#e2f6fa",
  line: "rgba(13,34,54,.10)",
  mut: "#5c6b78",
};

const CATEGORY_LABELS: Record<string, string> = {
  booking: "Bookings",
  payment: "Payments",
  payout: "Payouts",
  message: "Messages",
  order: "Orders",
  review: "Reviews",
  team: "Team",
  system: "System",
  other: "Other",
};

function label(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function when(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function NotificationCenter() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [limit, setLimit] = useState(30);

  const fetchFeed = useServerFn(listNotificationCenter);
  const markRead = useServerFn(markNotificationRead);
  const fetchPrefs = useServerFn(getNotificationPreferences);
  const savePrefs = useServerFn(updateNotificationPreferences);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-center", filter, category, limit],
    queryFn: () => fetchFeed({ data: { filter, category, limit, offset: 0 } }),
  });
  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => fetchPrefs(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notification-center"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const mark = useMutation({
    mutationFn: (v: { id?: string; all?: boolean }) => markRead({ data: v }),
    onSuccess: invalidate,
  });
  const prefM = useMutation({
    mutationFn: (v: { emailEnabled?: boolean; categories?: Record<string, boolean> }) =>
      savePrefs({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });

  const items = data?.items ?? [];
  const categories = Object.keys(data?.byCategory ?? {}).sort();

  const pill = (activeState: boolean) => ({
    padding: "7px 14px",
    borderRadius: 30,
    border: `1px solid ${activeState ? V.cyan : V.line}`,
    background: activeState ? V.cyan : "#fff",
    color: activeState ? "#fff" : V.navy,
    fontFamily: V.sans,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div style={{ background: "#f6f9fb", minHeight: "100vh", fontFamily: V.sans }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 18px 64px" }}>
        <Link to="/dashboard" style={{ color: V.cyan, fontSize: 14, fontWeight: 600 }}>
          ← Back to dashboard
        </Link>

        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: V.ink, fontSize: 30, letterSpacing: "-.02em" }}>
              Notifications
            </h1>
            <p style={{ margin: "6px 0 0", color: V.mut, fontSize: 14.5 }}>
              {data?.unread ? `${data.unread} unread` : "You're all caught up."}
            </p>
          </div>
          {(data?.unread ?? 0) > 0 && (
            <button type="button" style={pill(false)} onClick={() => mark.mutate({ all: true })}>
              Mark all read
            </button>
          )}
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 16px" }}>
          <button type="button" style={pill(filter === "all")} onClick={() => setFilter("all")}>
            All
          </button>
          <button
            type="button"
            style={pill(filter === "unread")}
            onClick={() => setFilter("unread")}
          >
            Unread
          </button>
          <span style={{ width: 1, background: V.line, margin: "0 4px" }} />
          <button type="button" style={pill(!category)} onClick={() => setCategory(undefined)}>
            Everything
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              style={pill(category === c)}
              onClick={() => setCategory(c)}
            >
              {label(c)} {data?.byCategory?.[c] ?? 0}
            </button>
          ))}
        </div>

        <section
          style={{
            background: "#fff",
            border: `1px solid ${V.line}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {isLoading && <p style={{ padding: 24, color: V.mut }}>Loading…</p>}
          {!isLoading && items.length === 0 && (
            <p style={{ padding: 28, color: V.mut, margin: 0 }}>
              Nothing here yet — tight lines.
            </p>
          )}
          {items.map((n) => {
            const unread = !n.read_at;
            const inner = (
              <>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: unread ? V.cyan : "transparent",
                    marginTop: 7,
                    flexShrink: 0,
                  }}
                />
                <span style={{ display: "grid", gap: 3, textAlign: "left" }}>
                  <span style={{ color: V.ink, fontWeight: unread ? 700 : 600, fontSize: 15 }}>
                    {n.title}
                  </span>
                  {n.body && (
                    <span style={{ color: V.mut, fontSize: 13.5, lineHeight: 1.45 }}>{n.body}</span>
                  )}
                  <span style={{ color: "#93a7b7", fontSize: 12 }}>
                    {label(n.category ?? "other")} · {when(n.created_at)}
                  </span>
                </span>
              </>
            );
            const style = {
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              width: "100%",
              padding: "14px 18px",
              background: unread ? V.cyansoft : "#fff",
              border: "none",
              borderBottom: `1px solid ${V.line}`,
              cursor: "pointer",
              fontFamily: V.sans,
            } as const;
            return n.link ? (
              <Link
                key={n.id}
                to={n.link}
                style={style}
                onClick={() => unread && mark.mutate({ id: n.id })}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                style={style}
                onClick={() => unread && mark.mutate({ id: n.id })}
              >
                {inner}
              </button>
            );
          })}
          {data?.hasMore && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 30)}
              style={{
                width: "100%",
                padding: 14,
                background: "#fff",
                border: "none",
                color: V.cyan,
                fontWeight: 700,
                fontFamily: V.sans,
                cursor: "pointer",
              }}
            >
              Load older notifications
            </button>
          )}
        </section>

        <section
          style={{
            background: "#fff",
            border: `1px solid ${V.line}`,
            borderRadius: 16,
            padding: 20,
            marginTop: 20,
          }}
        >
          <h2 style={{ margin: "0 0 4px", color: V.ink, fontSize: 18 }}>Email preferences</h2>
          <p style={{ margin: "0 0 14px", color: V.mut, fontSize: 13.5 }}>
            In-app notifications always appear here. Choose what also reaches your inbox.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14.5 }}>
            <input
              type="checkbox"
              checked={prefs?.emailEnabled ?? true}
              onChange={(e) => prefM.mutate({ emailEnabled: e.target.checked })}
            />
            Send me emails
          </label>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {["booking", "payment", "payout", "message", "order", "review"].map((c) => {
              const on = prefs?.categories?.[c] ?? true;
              return (
                <label
                  key={c}
                  style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!(prefs?.emailEnabled ?? true)}
                    onChange={(e) =>
                      prefM.mutate({
                        categories: { ...(prefs?.categories ?? {}), [c]: e.target.checked },
                      })
                    }
                  />
                  {label(c)}
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default NotificationCenter;
