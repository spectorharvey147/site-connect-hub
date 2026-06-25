import { supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";

export type StorageBucket =
  | "organization-logos"
  | "profile-photos"
  | "claim-attachments"
  | "leave-documents"
  | "dpr-photos"
  | "task-attachments"
  | "message-attachments"
  | "vendor-bills"
  | "material-documents"
  | "fuel-receipts"
  | "vendor-contracts"
  | "payment-proofs";

export interface StoredFile {
  bucket: StorageBucket;
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  signedUrl?: string;
}

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const storageService = {
  async uploadFiles(
    bucket: StorageBucket,
    files: File[],
    user: AppUser,
    folder = "general",
  ): Promise<StoredFile[]> {
    const client = supabase;
    if (!client || !user.organizationId) {
      throw new Error("Supabase storage is not configured.");
    }
    return Promise.all(
      files.map(async (file) => {
        const path = [
          user.organizationId,
          user.id,
          folder,
          `${crypto.randomUUID()}-${safeFileName(file.name)}`,
        ].join("/");
        const { error } = await client.storage.from(bucket).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) {
          throw new Error(error.message);
        }
        const signedUrl = await this.createSignedUrl(bucket, path);
        return {
          bucket,
          path,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          signedUrl,
        };
      }),
    );
  },

  async createSignedUrl(bucket: StorageBucket, path: string, expiresIn = 3600) {
    if (!supabase) {
      throw new Error("Supabase storage is not configured.");
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) {
      throw new Error(error.message);
    }
    return data.signedUrl;
  },

  async deleteFile(bucket: StorageBucket, path: string) {
    if (!supabase) {
      throw new Error("Supabase storage is not configured.");
    }
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(error.message);
    }
  },
};
