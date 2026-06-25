import { MessageSquarePlus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CONVERSATION_TYPE_LABELS } from "@/constants/messages";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { messagingService } from "@/services/messagingService";
import type { AppUser } from "@/types/auth";
import type {
  ConversationType,
  MessageAttachment,
  NewConversationInput,
} from "@/types/messages";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function NewConversationPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<AppUser[]>([]);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [form, setForm] = useState<Omit<NewConversationInput, "attachments">>({
    type: "direct",
    title: "",
    description: "",
    participantIds: contacts[0] ? [contacts[0].id] : [],
    projectId: "",
    firstMessage: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      void messagingService.listContacts(user).then(setContacts);
    }
  }, [user]);

  useEffect(() => {
    if (form.participantIds.length === 0 && contacts[0]) {
      setForm((current) => ({
        ...current,
        participantIds: [contacts[0].id],
      }));
    }
  }, [contacts, form.participantIds.length]);

  useEffect(() => {
    if (projects[0]) {
      setForm((current) => ({
        ...current,
        projectId: projects.some((project) => project.id === current.projectId)
          ? current.projectId
          : projects[0].id,
      }));
    }
  }, [projects]);

  useEffect(() => {
    if (form.type === "direct" && form.participantIds.length > 1) {
      setForm((current) => ({
        ...current,
        participantIds: current.participantIds.slice(0, 1),
      }));
    }
  }, [form.type, form.participantIds.length]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleParticipant(userId: string) {
    setForm((current) => {
      if (current.type === "direct") {
        return { ...current, participantIds: [userId] };
      }
      return {
        ...current,
        participantIds: current.participantIds.includes(userId)
          ? current.participantIds.filter((item) => item !== userId)
          : [...current.participantIds, userId],
      };
    });
  }

  function addAttachments(files: FileList | null) {
    const currentUser = user;
    if (!files || !currentUser) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      })),
    ]);
  }

  async function submit() {
    const currentUser = user;
    if (!currentUser) {
      return;
    }
    setSubmitting(true);
    try {
      const conversation = await messagingService.createConversation(
        { ...form, attachments },
        currentUser,
      );
      toast.success("Conversation created.");
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create conversation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New Chat"
        description="Start a direct conversation or create a group thread with attachments."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Messages", to: "/messages" },
          { label: "New" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Type">
              <select
                className={selectClass}
                value={form.type}
                onChange={(event) =>
                  update("type", event.target.value as ConversationType)
                }
              >
                {Object.entries(CONVERSATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>

            {form.type !== "direct" ? (
              <>
                <Input
                  label="Title"
                  value={form.title ?? ""}
                  onChange={(event) => update("title", event.target.value)}
                />
                <Textarea
                  label="Description"
                  value={form.description ?? ""}
                  onChange={(event) => update("description", event.target.value)}
                />
              </>
            ) : null}

            {form.type === "project" ? (
              <FormField label="Project">
                <select
                  className={selectClass}
                  value={form.projectId ?? ""}
                  onChange={(event) => update("projectId", event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

            <Textarea
              label="First message"
              value={form.firstMessage}
              onChange={(event) => update("firstMessage", event.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants & Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-border p-3 transition hover:border-brand-blue"
                >
                  <input
                    type={form.type === "direct" ? "radio" : "checkbox"}
                    name="participants"
                    className="mt-1 h-4 w-4 rounded border-surface-border text-brand-blue focus:ring-brand-blue"
                    checked={form.participantIds.includes(contact.id)}
                    onChange={() => toggleParticipant(contact.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-text-primary">
                      {contact.fullName}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {contact.role.split("_").join(" ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-slate-50 p-5 text-center hover:border-brand-blue">
              <Upload className="h-6 w-6 text-brand-blue" />
              <span className="mt-2 text-sm font-semibold text-text-primary">
                Add attachments
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => addAttachments(event.target.files)}
              />
            </label>

            {attachments.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg border border-surface-border p-3"
                  >
                    <span className="truncate text-sm font-semibold">
                      {attachment.fileName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              type="button"
              leftIcon={<MessageSquarePlus className="h-4 w-4" />}
              isLoading={submitting}
              onClick={() => void submit()}
            >
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
