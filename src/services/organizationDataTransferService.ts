import { supabase } from "@/services/supabaseClient";
import { getEdgeFunctionErrorMessage } from "@/services/edgeFunctionError";
import type { AppUser } from "@/types/auth";

export interface OrganizationImportPackage {
  version: 1;
  organization: { organizationCode: string; organizationName: string; legalName?: string; supportEmail?: string; currency?: string; timezone?: string };
  departments: Array<{ code: string; name: string; description?: string }>;
  projects: Array<{ code: string; name: string; departmentCode: string; location: string; startDate: string; endDate?: string }>;
  users: Array<{ employeeCode: string; firstName: string; lastName: string; email: string; phone?: string; role: string; departmentCode: string; designationCode?: string; reportingManagerEmployeeCode?: string; hodEmployeeCode?: string; primaryProjectCode?: string; projectCodes: string[]; employmentType: string; joiningDate: string }>;
}

function download(name: string, data: unknown) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  link.download = name; link.click(); URL.revokeObjectURL(link.href);
}
function client() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }

export const organizationDataTransferService = {
  sample(): OrganizationImportPackage {
    return { version: 1,
      organization: { organizationCode: "NBI", organizationName: "Northbridge Infrastructure Private Limited", legalName: "Northbridge Infrastructure Private Limited", supportEmail: "support@northbridge.example", currency: "INR", timezone: "Asia/Kolkata" },
      departments: [{ code: "PROJ", name: "Projects", description: "Project delivery" }, { code: "FIN", name: "Finance & Accounts" }, { code: "HR", name: "Human Resources" }],
      projects: [{ code: "NBI-METRO-01", name: "Metro Viaduct Package 01", departmentCode: "PROJ", location: "Chennai, Tamil Nadu", startDate: "2026-04-01", endDate: "2028-03-31" }],
      users: [
        { employeeCode: "NBI-0001", firstName: "Asha", lastName: "Raman", email: "asha.raman@northbridge.example", role: "super_admin", departmentCode: "FIN", designationCode: "FINHEAD", projectCodes: [], employmentType: "permanent", joiningDate: "2026-04-01" },
        { employeeCode: "NBI-0010", firstName: "Rahul", lastName: "Nair", email: "rahul.nair@northbridge.example", role: "manager", departmentCode: "PROJ", designationCode: "PM", reportingManagerEmployeeCode: "NBI-0001", primaryProjectCode: "NBI-METRO-01", projectCodes: ["NBI-METRO-01"], employmentType: "permanent", joiningDate: "2026-04-01" },
        { employeeCode: "NBI-0101", firstName: "Meena", lastName: "Kumar", email: "meena.kumar@northbridge.example", role: "site_staff", departmentCode: "PROJ", designationCode: "SITEENG", reportingManagerEmployeeCode: "NBI-0010", primaryProjectCode: "NBI-METRO-01", projectCodes: ["NBI-METRO-01"], employmentType: "contract", joiningDate: "2026-04-15" },
      ],
    };
  },
  downloadSample() {
    const link = document.createElement("a");
    link.href = "/templates/site-connect-complete-template.json";
    link.download = "site-connect-complete-template.json";
    link.click();
  },
  async exportCurrent(actor: AppUser) {
    if (!["admin_hr","super_admin"].includes(actor.role)) throw new Error("Admin access is required.");
    const c=client(); const [org,depts,projects,users,assignments]=await Promise.all([
      c.from("organizations").select("*").eq("id",actor.organizationId).single(), c.from("departments").select("*").eq("organization_id",actor.organizationId).order("department_code"),
      c.from("projects").select("*").eq("organization_id",actor.organizationId).order("code"), c.from("user_profiles").select("*").eq("organization_id",actor.organizationId).order("employee_code"),
      c.from("user_project_assignments").select("*").eq("organization_id",actor.organizationId),
    ]); for(const result of[org,depts,projects,users,assignments]) if(result.error) throw new Error(result.error.message);
    download(`site-connect-organization-export-${new Date().toISOString().slice(0,10)}.json`,{version:1,exportedAt:new Date().toISOString(),organization:org.data,departments:depts.data,projects:projects.data,users:users.data,projectAssignments:assignments.data});
  },
  async importPackage(pkg: OrganizationImportPackage, actor: AppUser) {
    if (!["admin_hr","super_admin"].includes(actor.role)) throw new Error("Admin access is required.");
    const complete=pkg as unknown as Record<string,unknown>;
    const source:OrganizationImportPackage=complete.templateVersion===2?{version:1,
      organization:((complete["01_organization"] as OrganizationImportPackage["organization"][])??[])[0],
      departments:(complete["03_departments"] as OrganizationImportPackage["departments"])??[],
      projects:((complete["07_projects"] as Array<Record<string,unknown>>)??[]).map(p=>({code:String(p.code??""),name:String(p.name??""),departmentCode:String(p.primaryDepartmentCode??p.departmentCode??""),location:String(p.location??""),startDate:String(p.startDate??""),endDate:p.endDate?String(p.endDate):undefined})),
      users:(complete["09_users"] as OrganizationImportPackage["users"])??[]}:pkg;
    if(source.version!==1||!source.organization?.organizationCode) throw new Error("Unsupported or incomplete import template.");
    const c=client(); const orgId=actor.organizationId; if(!orgId) throw new Error("Current organization is missing.");
    const departmentIds=new Map<string,string>();
    for(const d of source.departments){const {data,error}=await c.from("departments").upsert({organization_id:orgId,department_code:d.code.trim().toUpperCase(),department_name:d.name.trim(),name:d.name.trim(),description:d.description??null,status:"active"},{onConflict:"organization_id,department_code"}).select("id").single();if(error)throw new Error(`Department ${d.code}: ${error.message}`);departmentIds.set(d.code,data.id);}
    const projectIds=new Map<string,string>();
    for(const p of source.projects){const {data,error}=await c.from("projects").upsert({organization_id:orgId,code:p.code.trim().toUpperCase(),name:p.name.trim(),primary_department_id:departmentIds.get(p.departmentCode)??null,location:p.location,start_date:p.startDate,end_date:p.endDate??null,status:"active",created_by:actor.id,updated_by:actor.id},{onConflict:"organization_id,code"}).select("id").single();if(error)throw new Error(`Project ${p.code}: ${error.message}`);projectIds.set(p.code,data.id);}
    const existing=await c.from("user_profiles").select("id,email,employee_code").eq("organization_id",orgId);if(existing.error)throw new Error(existing.error.message);const usersByCode=new Map((existing.data??[]).map(u=>[u.employee_code,u.id]));const existingEmails=new Set((existing.data??[]).map(u=>u.email));let created=0,skipped=0;
    for(const u of source.users){if(existingEmails.has(u.email.toLowerCase())){skipped++;continue}const {data:designation}=await c.from("designations").select("id").eq("organization_id",orgId).eq("designation_code",u.designationCode??"").maybeSingle();const {data,error}=await c.functions.invoke("provision-user",{body:{...u,departmentId:departmentIds.get(u.departmentCode),designationId:designation?.id??null,reportingManagerId:u.reportingManagerEmployeeCode?usersByCode.get(u.reportingManagerEmployeeCode):null,hodUserId:u.hodEmployeeCode?usersByCode.get(u.hodEmployeeCode):null,primaryProjectId:u.primaryProjectCode?projectIds.get(u.primaryProjectCode):null,projectIds:u.projectCodes.map(code=>projectIds.get(code)).filter(Boolean)}});if(error)throw new Error(`User ${u.email}: ${await getEdgeFunctionErrorMessage(error,"User provisioning failed.")}`);if(data?.error)throw new Error(`User ${u.email}: ${data.error}`);usersByCode.set(u.employeeCode,String(data.id));existingEmails.add(u.email.toLowerCase());created++;}
    return {departments:departmentIds.size,projects:projectIds.size,usersCreated:created,usersSkipped:skipped};
  },
};
