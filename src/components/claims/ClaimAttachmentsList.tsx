import { useState } from "react";
import { Download, Eye, FileText, X } from "lucide-react";

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
  const [selected, setSelected] = useState<ClaimAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (attachments.length === 0) {
    return <p className="text-sm text-text-secondary">{emptyLabel}</p>;
  }

  async function preview(attachment: ClaimAttachment) {
    setSelected(attachment);
    setPreviewUrl(attachment.url);
    setLoading(true);
    if (attachment.bucket && attachment.path) {
      try {
        setPreviewUrl(
          await storageService.createSignedUrl(
            attachment.bucket as StorageBucket,
            attachment.path,
          ),
        );
      } catch {
        setPreviewUrl(attachment.url || "");
      }
    }
    setLoading(false);
  }

  function closePreview() {
    setSelected(null);
    setPreviewUrl("");
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => void preview(attachment)}
            className="group flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border border-surface-border bg-white p-3 text-center transition hover:border-brand-blue hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-brand-blue"
            title={`Preview ${attachment.fileName}`}
          >
            <FileText className="mb-2 h-9 w-9 shrink-0 text-brand-blue" />
            <span className="line-clamp-2 w-full break-words text-xs font-semibold text-text-primary">
              {attachment.fileName}
            </span>
            <span className="mt-1 text-[11px] text-text-secondary">
              {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
            </span>
            <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-brand-blue opacity-80 group-hover:opacity-100">
              <Eye className="h-3 w-3" /> Preview
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${selected.fileName}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closePreview();
          }}
        >
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-primary">{selected.fileName}</p>
                <p className="text-xs text-text-secondary">Preview on this screen</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {previewUrl ? (
                  <a href={previewUrl} download={selected.fileName}>
                    <Button type="button" variant="ghost" size="icon" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                ) : null}
                <Button type="button" variant="ghost" size="icon" title="Close preview" onClick={closePreview}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-2 sm:p-4">
              {loading ? (
                <p className="text-sm text-text-secondary">Loading preview...</p>
              ) : (selected.fileType || "").startsWith("image/") ? (
                <img src={previewUrl} alt={selected.fileName} className="max-h-full max-w-full object-contain" />
              ) : selected.fileType === "application/pdf" || selected.fileName.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewUrl} title={selected.fileName} className="h-full w-full rounded bg-white" />
              ) : (
                <div className="max-w-md text-center">
                  <FileText className="mx-auto h-14 w-14 text-brand-blue" />
                  <p className="mt-3 text-sm font-semibold text-text-primary">Preview is not available for this file type.</p>
                  <p className="mt-1 text-xs text-text-secondary">Use the download button above to open the document.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
