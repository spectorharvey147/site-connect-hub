import { supabase } from "@/services/supabaseClient";

export async function uploadAttendanceSelfie(organizationId: string, userId: string, file: Blob, mutationId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!organizationId) throw new Error("Organization is required for attendance evidence.");
  const path = `${organizationId}/${userId}/${new Date().toISOString().slice(0,10)}/${mutationId}.jpg`;
  const { error } = await supabase.storage.from("attendance-selfies").upload(path,file,{contentType:file.type||"image/jpeg",upsert:true});
  if(error) throw new Error(error.message);
  return path;
}
