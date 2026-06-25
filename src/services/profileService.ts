import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { storageService } from "@/services/storageService";
import type { AppUser } from "@/types/auth";

const DEMO_PROFILE_KEY = "site-connect:demo-profile:";

export interface ProfileUpdateInput {
  firstName: string;
  lastName: string;
  phone: string;
  profilePhoto?: File;
  signature?: File;
  removeProfilePhoto?: boolean;
  removeSignature?: boolean;
}

function fullName(input: ProfileUpdateInput) {
  return `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

function readDemoProfile(user: AppUser) {
  const stored = window.localStorage.getItem(`${DEMO_PROFILE_KEY}${user.id}`);
  if (!stored) return user;
  try {
    return { ...user, ...(JSON.parse(stored) as Partial<AppUser>) };
  } catch {
    return user;
  }
}

export const profileService = {
  getDemoProfile(user: AppUser) {
    return isSupabaseConfigured ? user : readDemoProfile(user);
  },

  async updateProfile(user: AppUser, input: ProfileUpdateInput): Promise<AppUser> {
    const name = fullName(input);
    if (!name) throw new Error("First name and last name cannot both be empty.");

    if (!isSupabaseConfigured || !supabase) {
      const current = readDemoProfile(user);
      const next: AppUser = {
        ...current,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        fullName: name,
        phone: input.phone.trim() || undefined,
        avatarUrl: input.removeProfilePhoto
          ? undefined
          : input.profilePhoto
            ? await fileToDataUrl(input.profilePhoto)
            : current.avatarUrl,
        signatureUrl: input.removeSignature
          ? undefined
          : input.signature
            ? await fileToDataUrl(input.signature)
            : current.signatureUrl,
      };
      window.localStorage.setItem(
        `${DEMO_PROFILE_KEY}${user.id}`,
        JSON.stringify(next),
      );
      await recordAuditLog({
        userId: user.id,
        action: "profile.updated",
        entityType: "user_profile",
        entityId: user.id,
        newValues: {
          fullName: next.fullName,
          phone: next.phone,
          profilePhotoChanged: Boolean(input.profilePhoto || input.removeProfilePhoto),
          signatureChanged: Boolean(input.signature || input.removeSignature),
        },
      });
      return next;
    }

    let profilePhotoPath = input.removeProfilePhoto
      ? null
      : user.profilePhotoPath ?? null;
    let signaturePath = input.removeSignature ? null : user.signaturePath ?? null;
    let avatarUrl = input.removeProfilePhoto ? null : user.avatarUrl ?? null;
    let signatureUrl = input.removeSignature ? null : user.signatureUrl ?? null;

    if (input.profilePhoto) {
      const [uploaded] = await storageService.uploadFiles(
        "profile-photos",
        [input.profilePhoto],
        user,
        "avatar",
      );
      profilePhotoPath = uploaded.path;
      avatarUrl = uploaded.signedUrl ?? null;
    }
    if (input.signature) {
      const [uploaded] = await storageService.uploadFiles(
        "profile-photos",
        [input.signature],
        user,
        "signature",
      );
      signaturePath = uploaded.path;
      signatureUrl = uploaded.signedUrl ?? null;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({
        first_name: input.firstName.trim() || null,
        last_name: input.lastName.trim() || null,
        full_name: name,
        phone: input.phone.trim() || null,
        avatar_url: avatarUrl,
        profile_photo_url: avatarUrl,
        profile_photo_path: profilePhotoPath,
        signature_url: signatureUrl,
        signature_path: signaturePath,
        updated_by: user.id,
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    const oldPaths = [
      input.profilePhoto ? user.profilePhotoPath : undefined,
      input.signature ? user.signaturePath : undefined,
      input.removeProfilePhoto ? user.profilePhotoPath : undefined,
      input.removeSignature ? user.signaturePath : undefined,
    ].filter((path): path is string => Boolean(path));
    await Promise.allSettled(
      oldPaths.map((path) => storageService.deleteFile("profile-photos", path)),
    );

    const next: AppUser = {
      ...user,
      firstName: input.firstName.trim() || undefined,
      lastName: input.lastName.trim() || undefined,
      fullName: name,
      phone: input.phone.trim() || undefined,
      avatarUrl: avatarUrl ?? undefined,
      profilePhotoPath: profilePhotoPath ?? undefined,
      signatureUrl: signatureUrl ?? undefined,
      signaturePath: signaturePath ?? undefined,
    };
    await recordAuditLog({
      userId: user.id,
      action: "profile.updated",
      entityType: "user_profile",
      entityId: user.id,
      newValues: {
        fullName: next.fullName,
        phone: next.phone,
        profilePhotoChanged: Boolean(input.profilePhoto || input.removeProfilePhoto),
        signatureChanged: Boolean(input.signature || input.removeSignature),
      },
    });
    return next;
  },
};
