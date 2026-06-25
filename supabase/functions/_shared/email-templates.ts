const EVENT_COPY: Record<string, { heading: string; action: string }> = {
  claim_submitted: { heading: "Claim submitted", action: "Review the submitted claim in Site Connect." },
  claim_approved: { heading: "Claim approved", action: "The approved claim is ready for its next workflow step." },
  claim_rejected: { heading: "Claim rejected", action: "Open the claim to review the rejection comments." },
  claim_changes_requested: { heading: "Claim changes requested", action: "Update and resubmit the claim from Site Connect." },
  leave_submitted: { heading: "Leave request submitted", action: "Review the leave request and its supporting details." },
  leave_approved: { heading: "Leave request approved", action: "The approved dates are now reflected in the leave register." },
  leave_rejected: { heading: "Leave request rejected", action: "Open the request to review the decision comments." },
  task_assigned: { heading: "Task assigned", action: "Open Site Connect to review the task, priority and due date." },
  dpr_submitted: { heading: "DPR submitted", action: "Review the daily progress, labour, machinery and site updates." },
  material_request_submitted: { heading: "Material request submitted", action: "Review the requested items and required date." },
  vendor_bill_submitted: { heading: "Vendor bill submitted", action: "Verify the bill and its source records in Site Connect." },
  vendor_bill_approved: { heading: "Vendor bill approved", action: "The approved bill is ready for voucher processing." },
  voucher_generated: { heading: "Payment voucher generated", action: "Review the voucher before payment processing." },
  payment_processed: { heading: "Payment processed", action: "The payment and ledger balances have been updated." },
  message_mention: { heading: "You were mentioned", action: "Open the conversation to view and respond to the message." },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildEmailContent(
  event: string,
  name: string,
  title: string,
  message?: string | null,
) {
  const template = EVENT_COPY[event] ?? {
    heading: title,
    action: "Open Site Connect to review this update.",
  };
  const detail = message?.trim() || "A workflow update is available.";
  return {
    text: `${template.heading}\n\nHello ${name},\n\n${detail}\n\n${template.action}\n\nThis automated message was sent by Site Connect.`,
    html: `<div style="background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#075985;padding:20px 24px;color:#ffffff">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase">Site Connect</div>
          <h1 style="font-size:22px;margin:8px 0 0">${escapeHtml(template.heading)}</h1>
        </div>
        <div style="padding:24px">
          <p>Hello ${escapeHtml(name)},</p>
          <p style="line-height:1.6">${escapeHtml(detail)}</p>
          <div style="margin:20px 0;padding:14px 16px;background:#f0f9ff;border-left:4px solid #0284c7">
            ${escapeHtml(template.action)}
          </div>
          <p style="color:#64748b;font-size:12px;margin-top:24px">
            This automated message was sent by Site Connect. Please do not share confidential workflow information.
          </p>
        </div>
      </div>
    </div>`,
  };
}

export const EMAIL_TEMPLATE_EVENTS = Object.freeze(Object.keys(EVENT_COPY));
