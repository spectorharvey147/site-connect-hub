import { FileUp, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ClaimAttachmentsList } from "@/components/claims/ClaimAttachmentsList";
import { useAuth } from "@/hooks/useAuth";
import {
  storageService,
  type StorageBucket,
  type StoredFile,
} from "@/services/storageService";

interface FileUploadProps {
  bucket: StorageBucket;
  folder?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  value: StoredFile[];
  onChange: (files: StoredFile[]) => void;
}

export function FileUpload({
  bucket,
  folder,
  accept,
  multiple = true,
  maxSizeMb = 10,
  value,
  onChange,
}: FileUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]) {
    if (!user || files.length === 0) {
      return;
    }
    const oversized = files.find((file) => file.size > maxSizeMb * 1024 * 1024);
    if (oversized) {
      toast.error(`${oversized.name} exceeds the ${maxSizeMb} MB limit.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await storageService.uploadFiles(
        bucket,
        multiple ? files : files.slice(0, 1),
        user,
        folder,
      );
      onChange(multiple ? [...value, ...uploaded] : uploaded);
      toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void upload(Array.from(event.dataTransfer.files));
  }

  async function remove(file: StoredFile) {
    try {
      await storageService.deleteFile(file.bucket, file.path);
      onChange(value.filter((item) => item.path !== file.path));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete file.");
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center ${
          dragging ? "border-brand-blue bg-brand-light" : "border-surface-border bg-slate-50"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <FileUp className="h-7 w-7 text-brand-blue" />
        <p className="mt-2 text-sm font-semibold text-text-primary">
          Drop files here or choose from this device
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Maximum {maxSizeMb} MB per file
        </p>
        <Button
          type="button"
          className="mt-3"
          variant="secondary"
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Choose Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />
      </div>
      {value.length ? (
        <div className="space-y-3">
          <ClaimAttachmentsList attachments={value.map((file) => ({ id: file.path, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize, url: file.signedUrl ?? "", bucket: file.bucket, path: file.path, uploadedAt: new Date().toISOString() }))} />
          <div className="flex flex-wrap gap-2">
            {value.map((file) => <Button key={file.path} type="button" size="sm" variant="secondary" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void remove(file)}>Remove {file.fileName}</Button>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
