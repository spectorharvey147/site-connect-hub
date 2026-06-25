import { CalendarDays, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { useAuth } from "@/hooks/useAuth";
import { leaveService } from "@/services/leaveService";
import type { Holiday } from "@/types/leave";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const blankHoliday: Holiday = {
  id: "",
  name: "",
  date: new Date().toISOString().slice(0, 10),
  location: "India",
  type: "company",
};

export function HolidayCalendarPage() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState(() => leaveService.listHolidays());
  const [form, setForm] = useState<Holiday>(blankHoliday);

  useEffect(() => {
    void leaveService.loadHolidays().then(setHolidays).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Unable to load holidays.");
    });
  }, []);

  function edit(holiday: Holiday) {
    setForm(holiday);
  }

  async function save() {
    if (!user) return;
    try {
      const saved = await leaveService.saveHoliday(
        { ...form, id: form.id || crypto.randomUUID() },
        user,
      );
      setHolidays(leaveService.listHolidays());
      setForm(blankHoliday);
      toast.success(`${saved.name} saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save holiday.");
    }
  }

  return (
    <>
      <PageHeader
        title="Holiday Calendar"
        description="Company and statutory holidays excluded from leave day calculation."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Leave", to: "/leave" },
          { label: "Holidays" },
        ]}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{form.id ? "Edit Holiday" : "Add Holiday"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Input label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <Input label="Date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          <Input label="Location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
          <FormField label="Type">
            <select className={selectClass} value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Holiday["type"] }))}>
              <option value="national">National</option>
              <option value="state">State</option>
              <option value="company">Company</option>
            </select>
          </FormField>
          <div className="md:col-span-4">
            <Button type="button" leftIcon={<Save className="h-4 w-4" />} onClick={() => void save()}>
              Save Holiday
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {holidays.map((holiday) => (
          <Card key={holiday.id} className="cursor-pointer hover:border-brand-blue" onClick={() => edit(holiday)}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-blue">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{holiday.name}</CardTitle>
                  <p className="mt-1 text-sm text-text-secondary">
                    {holiday.date} · {holiday.location}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}
