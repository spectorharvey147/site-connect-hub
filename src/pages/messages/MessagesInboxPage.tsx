import {
  Archive,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ConversationList } from "@/components/messages/ConversationList";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CONVERSATION_TAB_LABELS } from "@/constants/messages";
import { useAuth } from "@/hooks/useAuth";
import { messagingService } from "@/services/messagingService";
import type {
  Conversation,
  ConversationFilters,
  ConversationTab,
  MessageDashboardSummary,
} from "@/types/messages";
import { cn } from "@/utils/cn";

export function MessagesInboxPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ConversationFilters>({
    search: "",
    tab: "all",
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [summary, setSummary] = useState<MessageDashboardSummary | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void Promise.all([
      messagingService.listConversations(user, filters),
      messagingService.getDashboard(user),
    ]).then(([list, dashboard]) => {
      setConversations(list);
      setSummary(dashboard.summary);
    });
  }, [filters, user]);

  if (!user || !summary) {
    return null;
  }

  function setTab(tab: ConversationTab) {
    setFilters((current) => ({ ...current, tab }));
  }

  return (
    <>
      <PageHeader
        title="Messages"
        description="Open team conversations, group threads, attachments and read receipts."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Messages" },
        ]}
        action={
          <Link to="/messages/new">
            <Button type="button" leftIcon={<Plus className="h-4 w-4" />}>
              New Chat
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Conversations",
            value: String(summary.totalConversations),
            tone: "info",
          }}
          icon={<MessageSquareText className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Unread",
            value: String(summary.unreadConversations),
            tone: "warning",
          }}
          icon={<Search className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Groups",
            value: String(summary.groupConversations),
            tone: "success",
          }}
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Attachments",
            value: String(summary.sharedAttachments),
            tone: "neutral",
          }}
          icon={<Paperclip className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Search"
                value={filters.search ?? ""}
                leftIcon={<Search className="h-4 w-4" />}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CONVERSATION_TAB_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-semibold transition",
                      filters.tab === value
                        ? "border-brand-blue bg-brand-light text-brand-blue"
                        : "border-surface-border bg-white text-text-secondary hover:border-brand-blue",
                    )}
                    onClick={() => setTab(value as ConversationTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="secondary"
            leftIcon={<Archive className="h-4 w-4" />}
            onClick={() => setTab("archived")}
          >
            Archived
          </Button>
        </div>

        <ConversationList conversations={conversations} currentUser={user} />
      </div>
    </>
  );
}
