import { Camera, FileSignature, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ROLE_SHORT_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image size must be 5 MB or less.";
  return "";
}

export function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const signatureInput = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [signature, setSignature] = useState<File>();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [removeSignature, setRemoveSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? user.fullName.split(" ")[0] ?? "");
    setLastName(user.lastName ?? user.fullName.split(" ").slice(1).join(" "));
    setPhone(user.phone ?? "");
  }, [user]);

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : removePhoto ? undefined : user?.avatarUrl),
    [photo, removePhoto, user?.avatarUrl],
  );
  const signaturePreview = useMemo(
    () =>
      signature
        ? URL.createObjectURL(signature)
        : removeSignature
          ? undefined
          : user?.signatureUrl,
    [removeSignature, signature, user?.signatureUrl],
  );

  useEffect(
    () => () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      if (signaturePreview?.startsWith("blob:")) URL.revokeObjectURL(signaturePreview);
    },
    [photoPreview, signaturePreview],
  );

  if (!user) return null;

  function chooseImage(file: File | undefined, kind: "photo" | "signature") {
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      toast.error(error);
      return;
    }
    if (kind === "photo") {
      setPhoto(file);
      setRemovePhoto(false);
    } else {
      setSignature(file);
      setRemoveSignature(false);
    }
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await profileService.updateProfile(user, {
        firstName,
        lastName,
        phone,
        profilePhoto: photo,
        signature,
        removeProfilePhoto: removePhoto,
        removeSignature,
      });
      updateCurrentUser?.(updated);
      setPhoto(undefined);
      setSignature(undefined);
      setRemovePhoto(false);
      setRemoveSignature(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Manage your contact details, profile picture and approval signature."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "My Profile" }]}
      />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <UserAvatar
              name={user.fullName}
              src={photoPreview}
              className="h-32 w-32 text-3xl ring-4 ring-brand-light"
            />
            <h2 className="mt-4 text-xl font-bold text-text-primary">{user.fullName}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {ROLE_SHORT_LABELS[user.role]} · {user.employeeId}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Camera className="h-4 w-4" />}
                onClick={() => photoInput.current?.click()}
              >
                Upload Photo
              </Button>
              {(photoPreview || photo) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remove profile picture"
                  onClick={() => {
                    setPhoto(undefined);
                    setRemovePhoto(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => chooseImage(event.target.files?.[0], "photo")}
            />
            <p className="mt-3 text-xs leading-5 text-text-secondary">
              JPG, PNG or WebP. Maximum 5 MB. A square image works best.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                <Input label="Email" value={user.email} disabled hint="Contact an administrator to change your login email." />
                <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input label="Employee ID" value={user.employeeId} disabled />
                <Input label="Department" value={user.department ?? "Unassigned"} disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Signature</CardTitle></CardHeader>
            <CardContent>
              <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-slate-50 p-5 text-center">
                {signaturePreview ? (
                  <img
                    src={signaturePreview}
                    alt="Uploaded signature"
                    className="max-h-24 max-w-full object-contain"
                  />
                ) : (
                  <FileSignature className="h-10 w-10 text-brand-blue" />
                )}
                <p className="mt-3 text-sm font-semibold text-text-primary">
                  {signaturePreview ? "Signature ready" : "Upload your signature image"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Used on authorized vouchers and documents where applicable.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<Upload className="h-4 w-4" />}
                    onClick={() => signatureInput.current?.click()}
                  >
                    {signaturePreview ? "Replace Signature" : "Choose Signature"}
                  </Button>
                  {signaturePreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => {
                        setSignature(undefined);
                        setRemoveSignature(true);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={signatureInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => chooseImage(event.target.files?.[0], "signature")}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            size="lg"
            leftIcon={<Save className="h-4 w-4" />}
            isLoading={saving}
            onClick={() => void save()}
          >
            Save Profile
          </Button>
        </div>
      </div>
    </>
  );
}
