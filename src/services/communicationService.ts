import { authService } from "@/services/authService";
import { supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { CommunicationDelivery, CommunicationGateway, CommunicationLog, CommunicationMapping, CommunicationRule, CommunicationTemplate } from "@/types/communication";

type Row = Record<string, unknown>;
function client() { if (!supabase) throw new Error("Supabase is required for Communication Center."); return supabase; }
async function authorize(actor: AppUser) {
  if (actor.role !== "super_admin") throw new Error("Communication Center is restricted to Super Admin.");
  await authService.requireValidSupabaseSession();
}

export const communicationService = {
  async load(actor: AppUser) {
    await authorize(actor); const db=client();
    const [gateways,mappings,rules,templates,deliveries,logs,groups,projects]=await Promise.all([
      db.from("communication_gateways").select("*").order("display_name"),
      db.from("communication_project_mappings").select("*,projects(name,code),communication_groups(participant_count,last_synced_at)").order("created_at"),
      db.from("communication_event_rules").select("*").order("event_type"),
      db.from("communication_templates").select("*").order("template_name"),
      db.from("communication_outbox").select("*").order("created_at",{ascending:false}).limit(200),
      db.from("communication_gateway_logs").select("*").order("created_at",{ascending:false}).limit(200),
      db.from("communication_groups").select("*").eq("is_available",true).order("group_name"),
      db.from("projects").select("id,name,code").eq("status","active").is("deleted_at",null).order("name"),
    ]);
    const failed=[gateways,mappings,rules,templates,deliveries,logs,groups,projects].find((result)=>result.error); if(failed?.error) throw new Error(failed.error.message);
    const gatewayRows=(gateways.data??[]) as Row[]; const mappingRows=(mappings.data??[]) as Row[]; const ruleRows=(rules.data??[]) as Row[]; const templateRows=(templates.data??[]) as Row[]; const deliveryRows=(deliveries.data??[]) as Row[]; const logRows=(logs.data??[]) as Row[];
    return {
      gateways:gatewayRows.map((row):CommunicationGateway=>({id:String(row.id),displayName:String(row.display_name),status:String(row.status),linkedNumber:row.linked_number?String(row.linked_number):undefined,lastSeenAt:row.last_seen_at?String(row.last_seen_at):undefined,paused:Boolean(row.paused_at)})),
      mappings:mappingRows.map((row):CommunicationMapping=>{const project=(row.projects??{}) as Row; const group=(row.communication_groups??{}) as Row; return {id:String(row.id),projectId:String(row.project_id),projectName:String(project.name??"Project"),projectCode:String(project.code??""),gatewayId:String(row.gateway_id),destinationGroupId:String(row.destination_group_id),destinationGroupName:String(row.destination_group_name),participantCount:Number(group.participant_count??0),dprEnabled:Boolean(row.dpr_enabled),active:Boolean(row.active),lastSyncedAt:group.last_synced_at?String(group.last_synced_at):undefined};}),
      rules:ruleRows.map((row):CommunicationRule=>({id:String(row.id),eventType:String(row.event_type),enabled:Boolean(row.enabled),approvalRequired:Boolean(row.approval_required),deliveryMode:String(row.delivery_mode),maxAttempts:Number(row.max_attempts),priority:Number(row.priority)})),
      templates:templateRows.map((row):CommunicationTemplate=>({id:String(row.id),templateName:String(row.template_name),eventType:String(row.event_type),content:String(row.content),isActive:Boolean(row.is_active)})),
      deliveries:deliveryRows.map((row):CommunicationDelivery=>({id:String(row.id),createdAt:String(row.created_at),eventType:String(row.event_type),projectId:String(row.project_id),destination:row.destination?String(row.destination):undefined,messageType:String(row.message_type),status:row.status as CommunicationDelivery["status"],attemptCount:Number(row.attempt_count),providerMessageId:row.provider_message_id?String(row.provider_message_id):undefined,lastError:row.last_error?String(row.last_error):undefined})),
      logs:logRows.map((row):CommunicationLog=>({id:String(row.id),createdAt:String(row.created_at),gatewayId:row.gateway_id?String(row.gateway_id):undefined,level:String(row.level),eventType:String(row.event_type),message:String(row.message)})),
      groups:((groups.data??[]) as Row[]).map((row)=>({gatewayId:String(row.gateway_id),id:String(row.group_id),name:String(row.group_name),participantCount:Number(row.participant_count),lastSyncedAt:String(row.last_synced_at)})),
      projects:((projects.data??[]) as Row[]).map((row)=>({id:String(row.id),name:String(row.name),code:String(row.code)})),
    };
  },
  async setRule(actor:AppUser,id:string,changes:{enabled?:boolean;approval_required?:boolean}) { await authorize(actor); const{error}=await client().from("communication_event_rules").update(changes).eq("id",id); if(error)throw new Error(error.message); },
  async setMapping(actor:AppUser,id:string,changes:{active?:boolean;dpr_enabled?:boolean}) { await authorize(actor); const{error}=await client().from("communication_project_mappings").update(changes).eq("id",id); if(error)throw new Error(error.message); },
  async mapProject(actor:AppUser,input:{projectId:string;gatewayId:string;groupId:string;groupName:string}) { await authorize(actor); const{error}=await client().from("communication_project_mappings").upsert({organization_id:actor.organizationId,project_id:input.projectId,gateway_id:input.gatewayId,destination_group_id:input.groupId,destination_group_name:input.groupName,attendance_enabled:false,dpr_enabled:true,active:true,created_by:actor.id},{onConflict:"project_id"}); if(error)throw new Error(error.message); },
  async deliveryAction(actor:AppUser,id:string,action:"approve"|"retry"|"cancel") { await authorize(actor); const{error}=await client().rpc("communication_manual_action",{p_outbox_id:id,p_action:action}); if(error)throw new Error(error.message); },
  async queueTest(actor:AppUser,projectId:string,message:string) { await authorize(actor); const{error}=await client().rpc("queue_communication_test",{p_project_id:projectId,p_message:message}); if(error)throw new Error(error.message); },
};
