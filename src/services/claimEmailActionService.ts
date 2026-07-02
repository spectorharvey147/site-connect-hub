import { notificationService } from "@/services/notificationService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";

function client() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is required.");
  return supabase;
}

export const claimEmailActionService = {
  async create(claimId: string, approverId: string, role: string, scope: string, hours = 48) {
    const { data, error } = await client().rpc("create_claim_email_action_token", {
      p_claim_id: claimId, p_approver: approverId, p_role: role,
      p_scope: scope, p_expires_hours: hours,
    });
    if (error) throw new Error(error.message);
    return `${window.location.origin}/claim-action?token=${data}`;
  },

  async createAndSend(input: {
    claimId: string; claimNumber: string; employee: string; project: string;
    amount: number; approverId: string; role: string; scope: string;
    event?: string; label?: string; hours?: number;
  }) {
    const link = await this.create(input.claimId, input.approverId, input.role, input.scope, input.hours);
    await notificationService.send({
      userId: input.approverId,
      type: input.event ?? "claim_action_required",
      title: `Claim ${input.claimNumber} ${input.label ?? "requires action"}`,
      message: `${input.employee} · ${input.project} · INR ${input.amount}. Secure review link (expires in ${input.hours ?? 48} hours): ${link}`,
      relatedId: input.claimId,
      relatedType: "claim",
    });
    return link;
  },

  async inspect(token: string) {
    const { data, error } = await client().rpc("get_claim_email_action", { p_token: token });
    if (error) throw new Error(error.message);
    return data as { claimId: string; claimNumber: string; title: string; amount: number; scope: string; expiresAt: string };
  },

  async use(token: string, action: "approve" | "reject" | "request_changes" | "verify", remarks: string) {
    const { data, error } = await client().rpc("use_claim_email_action", {
      p_token: token, p_action: action, p_remarks: remarks || null,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },
};
