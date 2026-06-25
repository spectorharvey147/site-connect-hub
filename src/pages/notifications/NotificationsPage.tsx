import { CheckCheck, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { notificationService } from "@/services/notificationService";
import type {
  AppNotification,
  NotificationType,
} from "@/types/notifications";

const types: Array<NotificationType | "all"> = [
  "all",
  "claim",
  "leave",
  "task",
  "message",
  "payment",
  "vendor",
  "material",
  "system",
];

const typeTone: Record<
  NotificationType,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  claim: "info",
  leave: "success",
  task: "warning",
  message: "info",
  payment: "success",
  vendor: "neutral",
  material: "warning",
  system: "neutral",
};

function actionPath(notification: AppNotification) {
  if (!notification.relatedId) return undefined;
  if (notification.relatedType === "claim") return `/claims/${notification.relatedId}`;
  if (notification.relatedType === "task") return `/tasks/${notification.relatedId}`;
  if (notification.relatedType === "message") return `/messages/${notification.relatedId}`;
  if (notification.relatedType === "vendor") return `/vendors/${notification.relatedId}`;
  if (notification.relatedType === "leave") return "/leave/history";
  if (notification.relatedType === "material") return "/materials";
  return undefined;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [type, setType] = useState<NotificationType | "all">("all");
  const [visibility, setVisibility] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setNotifications(await notificationService.listNotifications());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return user
      ? notificationService.subscribe(user.id, () => void load())
      : undefined;
  }, [load, user]);

  const filtered = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          (type === "all" || notification.type === type) &&
          (visibility === "all" || !notification.readAt),
      ),
    [notifications, type, visibility],
  );
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread update${unreadCount === 1 ? "" : "s"} across approvals, payments and operations.`}
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Notifications" }]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<CheckCheck className="h-4 w-4" />}
            disabled={unreadCount === 0}
            onClick={() =>
              void notificationService.markAllRead(user ?? undefined).then(load)
            }
          >
            Mark All Read
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          aria-label="Filter notifications by type"
          className="h-10 rounded-md border border-surface-border bg-surface-card px-3 text-sm text-text-primary"
          value={type}
          onChange={(event) =>
            setType(event.target.value as NotificationType | "all")
          }
        >
          {types.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All types" : item[0].toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex rounded-md border border-surface-border bg-surface-card p-1">
          {(["all", "unread"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={visibility === item ? "primary" : "ghost"}
              onClick={() => setVisibility(item)}
            >
              {item === "all" ? "All" : "Unread"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <LoadingState label="Loading notifications" /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title="No notifications yet."
          description="Important updates, approvals and messages will appear here."
        />
      ) : null}
      {!loading && !error && filtered.length > 0 ? (
        <Card>
          <CardContent className="divide-y divide-surface-border p-0">
            {filtered.map((notification) => {
              const path = actionPath(notification);
              return (
                <article
                  key={notification.id}
                  className={`flex items-start justify-between gap-4 p-4 ${
                    notification.readAt ? "" : "bg-brand-light/35"
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      void notificationService
                        .markRead(notification.id, user ?? undefined)
                        .then(load)
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">
                        {notification.title}
                      </p>
                      <Badge tone={typeTone[notification.type]}>
                        {notification.type}
                      </Badge>
                      <Badge tone={notification.readAt ? "neutral" : "info"}>
                        {notification.readAt ? "Read" : "Unread"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {notification.message || "Open the related record for details."}
                    </p>
                    <p className="mt-2 text-xs text-text-tertiary">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </button>
                  {path ? (
                    <Link
                      to={path}
                      className="flex shrink-0 items-center gap-1 text-xs font-semibold"
                    >
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
