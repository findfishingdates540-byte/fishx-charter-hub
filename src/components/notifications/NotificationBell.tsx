import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/notifications.functions";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const mark = useMutation({
    mutationFn: (v: { id?: string; all?: boolean }) => markRead({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="notif-trigger"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} strokeWidth={1.7} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <button className="notif-scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <header className="notif-head">
              <span>Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={() => mark.mutate({ all: true })}>
                  Mark all read
                </button>
              )}
            </header>

            <div className="notif-list">
              {items.length === 0 && <p className="notif-empty">Nothing yet — tight lines.</p>}
              {items.map((n) => {
                const body = (
                  <>
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <em>{timeAgo(n.created_at)}</em>
                  </>
                );
                const cls = `notif-item${n.read_at ? "" : " is-unread"} sev-${n.severity ?? "info"}`;
                return n.link ? (
                  <Link
                    key={n.id}
                    to={n.link}
                    className={cls}
                    onClick={() => {
                      if (!n.read_at) mark.mutate({ id: n.id });
                      setOpen(false);
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    className={cls}
                    onClick={() => !n.read_at && mark.mutate({ id: n.id })}
                  >
                    {body}
                  </button>
                );
              })}
            </div>

            <Link
              to="/notifications"
              className="notif-all"
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "11px 14px",
                textAlign: "center",
                fontWeight: 700,
                fontSize: 13,
                borderTop: "1px solid rgba(13,34,54,.10)",
              }}
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
