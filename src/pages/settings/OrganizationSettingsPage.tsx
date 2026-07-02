import { Building2, ImageUp, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { organizationService } from "@/services/organizationService";
import type { Organization, OrganizationInput } from "@/types/organization";

function toInput(organization: Organization): OrganizationInput {
  return {
    organizationCode: organization.organizationCode,
    organizationName: organization.organizationName,
    legalName: organization.legalName,
    gstNumber: organization.gstNumber,
    panNumber: organization.panNumber,
    address: organization.address,
    city: organization.city,
    state: organization.state,
    country: organization.country,
    pincode: organization.pincode,
    supportEmail: organization.supportEmail,
    supportPhone: organization.supportPhone,
    currency: organization.currency,
    timezone: organization.timezone,
    logoUrl: organization.logoUrl,
    voucherLogoPosition: organization.voucherLogoPosition ?? "left",
    voucherLogoSize: organization.voucherLogoSize ?? 18,
  };
}

export function OrganizationSettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrganizationInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    void organizationService.getCurrentOrganization().then((result) => {
      setOrganization(result);
      setForm(toInput(result));
    });
  }, []);

  if (!user || !organization || !form) {
    return null;
  }

  function update<Key extends keyof OrganizationInput>(
    key: Key,
    value: OrganizationInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!organization || !form || !user) {
      return;
    }
    setSaving(true);
    try {
      const updated = await organizationService.updateOrganization(
        organization.id,
        form,
        user,
      );
      setOrganization(updated);
      setForm(toInput(updated));
      toast.success("Organization settings saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save organization.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Organization Settings"
        description="Maintain the company master, legal details, support contacts, currency and timezone."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Organization" },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-blue" />
            Organization Master
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Organization Name"
              value={form.organizationName}
              onChange={(event) => update("organizationName", event.target.value)}
            />
            <Input
              label="Organization Code"
              value={form.organizationCode}
              onChange={(event) => update("organizationCode", event.target.value)}
            />
            <Input
              label="Legal Name"
              value={form.legalName ?? ""}
              onChange={(event) => update("legalName", event.target.value)}
            />
            <Input
              label="GST Number"
              value={form.gstNumber ?? ""}
              onChange={(event) => update("gstNumber", event.target.value)}
            />
            <Input
              label="PAN Number"
              value={form.panNumber ?? ""}
              onChange={(event) => update("panNumber", event.target.value)}
            />
            <Input
              label="Support Email"
              value={form.supportEmail ?? ""}
              onChange={(event) => update("supportEmail", event.target.value)}
            />
            <Input
              label="Support Phone"
              value={form.supportPhone ?? ""}
              onChange={(event) => update("supportPhone", event.target.value)}
            />
            <Input
              label="Currency"
              value={form.currency}
              onChange={(event) => update("currency", event.target.value)}
            />
            <Input
              label="Timezone"
              value={form.timezone}
              onChange={(event) => update("timezone", event.target.value)}
            />
            <Input
              label="City"
              value={form.city ?? ""}
              onChange={(event) => update("city", event.target.value)}
            />
            <Input
              label="State"
              value={form.state ?? ""}
              onChange={(event) => update("state", event.target.value)}
            />
            <Input
              label="Pincode"
              value={form.pincode ?? ""}
              onChange={(event) => update("pincode", event.target.value)}
            />
            <Input
              label="Address"
              value={form.address ?? ""}
              className="md:col-span-2"
              onChange={(event) => update("address", event.target.value)}
            />
            <div className="space-y-3 rounded-md border border-surface-border p-4 md:col-span-2">
              <p className="text-sm font-semibold">Payment Voucher Logo</p>
              {form.logoUrl ? <img src={form.logoUrl} alt="Company logo preview" className="h-20 w-32 rounded border bg-white object-contain p-2" /> : <p className="text-sm text-text-secondary">No company logo uploaded.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white">
                  <ImageUp className="h-4 w-4" /> {uploadingLogo ? "Uploading..." : "Upload / Replace Logo"}
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingLogo} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploadingLogo(true);
                    void organizationService.uploadOrganizationLogo(organization.id, file, user)
                      .then((url) => { update("logoUrl", url); toast.success("Logo uploaded. Save organization settings to apply it."); })
                      .catch((error) => toast.error(error instanceof Error ? error.message : "Logo upload failed."))
                      .finally(() => setUploadingLogo(false));
                  }} />
                </label>
                {form.logoUrl ? <Button type="button" variant="outline" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => update("logoUrl", "")}>Remove Logo</Button> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Placement<select className="mt-1 h-11 w-full rounded-md border border-surface-border bg-white px-3" value={form.voucherLogoPosition ?? "left"} onChange={(event) => update("voucherLogoPosition", event.target.value as "left" | "right" | "hidden")}><option value="left">Top left</option><option value="right">Top right</option><option value="hidden">Hide on vouchers</option></select></label>
                <Input label="Logo size (mm)" type="number" min={12} max={28} value={form.voucherLogoSize ?? 18} onChange={(event) => update("voucherLogoSize", Number(event.target.value))} />
              </div>
            </div>
          </div>
          <Button
            type="button"
            leftIcon={<Save className="h-4 w-4" />}
            isLoading={saving}
            onClick={() => void save()}
          >
            Save Organization
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
