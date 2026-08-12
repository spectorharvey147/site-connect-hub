import { MessageSquarePlus, Paperclip, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { claimQueryService, type ClaimQuery } from "@/services/claimQueryService";
import type { AppUser } from "@/types/auth";
import type { Claim } from "@/types/claims";

export function ClaimQueriesPanel({ claim, user, onAttachmentAdded }: { claim: Claim; user: AppUser; onAttachmentAdded: () => void }) {
  const [queries, setQueries] = useState<ClaimQuery[]>([]); const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [required, setRequired] = useState(false); const [responses, setResponses] = useState<Record<string,string>>({}); const [files, setFiles] = useState<Record<string,File[]>>({});
  const canRaise = ["admin_hr","manager","hod","accounts_officer","super_admin"].includes(user.role);
  const load = useCallback(() => claimQueryService.list(claim.id).then(setQueries).catch((e) => toast.error(e.message)), [claim.id]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-4">
    {canRaise ? <div className="space-y-3 rounded-lg border border-surface-border p-4"><Input label="Query subject" value={subject} onChange={(e)=>setSubject(e.target.value)} /><Textarea label="What must the employee clarify or attach?" value={message} onChange={(e)=>setMessage(e.target.value)} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={required} onChange={(e)=>setRequired(e.target.checked)} /> Attachment required</label>
      <Button type="button" leftIcon={<MessageSquarePlus className="h-4 w-4" />} onClick={()=>void claimQueryService.raise(claim,user,{subject,message,queryType:required?"missing_attachment":"clarification",attachmentRequired:required}).then(()=>{setSubject("");setMessage("");setRequired(false);load();toast.success("Query sent to claim owner.");}).catch(e=>toast.error(e.message))}>Raise Query</Button></div> : null}
    {!queries.length ? <p className="text-sm text-text-secondary">No queries raised for this claim.</p> : queries.map((q)=><div key={q.id} className="rounded-lg border border-surface-border p-4 text-sm"><div className="flex justify-between gap-3"><div><p className="font-bold">{q.subject}</p><p className="text-xs text-text-secondary">{q.raisedByName} · {new Date(q.createdAt).toLocaleString()}</p></div><Badge tone={q.status==="resolved"?"success":q.status==="responded"?"info":"warning"}>{q.status}</Badge></div><p className="mt-3">{q.message}</p>
      {q.attachmentRequired?<p className="mt-2 font-semibold text-orange-700"><Paperclip className="mr-1 inline h-4 w-4"/>Attachment required</p>:null}{q.responseMessage?<div className="mt-3 rounded bg-slate-50 p-3"><b>Response:</b> {q.responseMessage}{q.attachmentNames.length?<p className="mt-1 text-xs">Added: {q.attachmentNames.join(", ")}</p>:null}</div>:null}
      {q.assignedTo===user.id&&q.status==="open"?<div className="mt-3 space-y-2"><Textarea label="Your response" value={responses[q.id]??""} onChange={(e)=>setResponses({...responses,[q.id]:e.target.value})}/><input type="file" multiple onChange={(e)=>setFiles({...files,[q.id]:Array.from(e.target.files??[])})}/><Button type="button" leftIcon={<Send className="h-4 w-4"/>} onClick={()=>void claimQueryService.respond(q,claim,user,responses[q.id]??"",files[q.id]??[]).then(()=>{load();onAttachmentAdded();toast.success("Response and attachments added to claim.");}).catch(e=>toast.error(e.message))}>Send Response</Button></div>:null}
      {q.status==="responded"&&(q.raisedBy===user.id||["admin_hr","super_admin"].includes(user.role))?<Button className="mt-3" type="button" variant="secondary" onClick={()=>void claimQueryService.resolve(q,user).then(()=>{load();toast.success("Query resolved.");}).catch(e=>toast.error(e.message))}>Mark Resolved</Button>:null}
    </div>)}
  </div>;
}
