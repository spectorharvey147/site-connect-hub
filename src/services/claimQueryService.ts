import { notificationService } from "@/services/notificationService";
import { storageService } from "@/services/storageService";
import { supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";

export type ClaimQueryStatus = "open" | "responded" | "resolved" | "closed";
export interface ClaimQuery {
  id: string; claimId: string; raisedBy: string; raisedByName: string; assignedTo: string;
  subject: string; message: string; queryType: string; attachmentRequired: boolean;
  status: ClaimQueryStatus; responseMessage?: string; respondedAt?: string; createdAt: string;
  attachmentNames: string[];
}

function client() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }

export const claimQueryService = {
  async list(claimId: string): Promise<ClaimQuery[]> {
    const c = client();
    const { data, error } = await c.from("claim_queries").select("*,claim_query_attachments(claim_attachments(file_name))").eq("claim_id", claimId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const actorIds = [...new Set((data ?? []).map((row) => row.raised_by))];
    const profiles = actorIds.length ? await c.from("user_profiles").select("id,full_name").in("id", actorIds) : { data: [] };
    const names = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name]));
    return (data ?? []).map((row) => ({
      id: row.id, claimId: row.claim_id, raisedBy: row.raised_by, raisedByName: names.get(row.raised_by) ?? "Reviewer",
      assignedTo: row.assigned_to, subject: row.subject, message: row.message, queryType: row.query_type,
      attachmentRequired: row.attachment_required, status: row.status, responseMessage: row.response_message ?? undefined,
      respondedAt: row.responded_at ?? undefined, createdAt: row.created_at,
      attachmentNames: (row.claim_query_attachments ?? []).map((item: { claim_attachments: { file_name: string } | null }) => item.claim_attachments?.file_name).filter(Boolean) as string[],
    }));
  },

  async raise(claim: Claim, actor: AppUser, input: { subject: string; message: string; queryType: string; attachmentRequired: boolean }) {
    if (!["admin_hr", "manager", "hod", "accounts_officer", "super_admin"].includes(actor.role)) throw new Error("Your role cannot raise a claim query.");
    if (!input.subject.trim() || !input.message.trim()) throw new Error("Query subject and message are required.");
    const { data, error } = await client().from("claim_queries").insert({
      organization_id: claim.organizationId ?? actor.organizationId, claim_id: claim.id, raised_by: actor.id,
      assigned_to: claim.userId, query_type: input.queryType, subject: input.subject.trim(), message: input.message.trim(),
      attachment_required: input.attachmentRequired,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await notificationService.send({ userId: claim.userId, type: "claim_query_raised", title: `Query on claim ${claim.claimNumber}`,
      message: `${input.subject}: ${input.message}`, relatedId: claim.id, relatedType: "claim" }).catch(() => undefined);
    return data.id as string;
  },

  async respond(query: ClaimQuery, claim: Claim, actor: AppUser, message: string, files: File[]) {
    if (query.assignedTo !== actor.id) throw new Error("Only the assigned claim owner can respond.");
    if (!message.trim()) throw new Error("Response is required.");
    if (query.attachmentRequired && files.length === 0) throw new Error("This query requires an attachment.");
    const c = client();
    for (const stored of files.length ? await storageService.uploadFiles("claim-attachments", files, actor, `queries/${query.id}`) : []) {
      const { data: attachment, error } = await c.from("claim_attachments").insert({ claim_id: claim.id, file_url: stored.path, file_bucket: stored.bucket,
        file_path: stored.path, file_name: stored.fileName, file_type: stored.fileType, file_size: stored.fileSize, uploaded_by: actor.id }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: linkError } = await c.from("claim_query_attachments").insert({ query_id: query.id, claim_id: claim.id, claim_attachment_id: attachment.id, added_by: actor.id });
      if (linkError) throw new Error(linkError.message);
    }
    const { error } = await c.from("claim_queries").update({ status: "responded", response_message: message.trim(), responded_by: actor.id, responded_at: new Date().toISOString() }).eq("id", query.id);
    if (error) throw new Error(error.message);
    await notificationService.send({ userId: query.raisedBy, type: "claim_query_responded", title: `Claim query answered: ${query.subject}`,
      message: message.trim(), relatedId: claim.id, relatedType: "claim" }).catch(() => undefined);
  },

  async resolve(query: ClaimQuery, actor: AppUser) {
    if (query.raisedBy !== actor.id && !["admin_hr", "super_admin"].includes(actor.role)) throw new Error("Only the query raiser can resolve it.");
    const { error } = await client().from("claim_queries").update({ status: "resolved", resolved_by: actor.id, resolved_at: new Date().toISOString() }).eq("id", query.id);
    if (error) throw new Error(error.message);
  },
};
