import { Download, ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { storageService } from "@/services/storageService";
import type { StorageBucket } from "@/services/storageService";
import type { ClaimAttachment } from "@/types/claims";

export function ClaimAttachmentsList({
  attachments,
  emptyLabel = "No attachments.",
}: {
  attachments: ClaimAttachment[];
  emptyLabel?: string;
}) {
  if (attachments.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyLabel}</p>;
  }

  async function preview(attachment: ClaimAttachment) {
    let url = attachment.url;
    if (attachment.bucket && attachment.path) {
      try {
        url = await storageService.createSignedUrl(
          attachment.bucket as StorageBucket,
          attachment.path,
        );
      } catch {
        url = attachment.url;
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-white p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-brand-blue" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {attachment.fileName}
              </p>
              <p className="text-xs text-text-secondary">
                {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Preview / download"
            onClick={() => void preview(attachment)}
          >
            {attachment.fileType.startsWith("image/") ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
