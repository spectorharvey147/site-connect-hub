import { Building2, Save } from "lucide-react";
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
  };
}

export function OrganizationSettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrganizationInput | null>(null);
  const [saving, setSaving] = useState(false);

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
