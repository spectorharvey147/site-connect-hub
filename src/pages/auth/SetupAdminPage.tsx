import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { ErrorState } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import type { InitialAdminInput } from "@/types/auth";

const setupSteps = [
  "Organization",
  "Super Admin",
  "Settings",
  "Workflow",
  "Finish",
];

const setupAdminSchema = z
  .object({
    organizationName: z.string().trim().min(2, "Organization name is required."),
    organizationCode: z.string().trim().min(2, "Organization code is required."),
    legalName: z.string().trim().optional(),
    gstNumber: z.string().trim().optional(),
    panNumber: z.string().trim().optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    pincode: z.string().trim().optional(),
    firstName: z.string().trim().min(2, "First name is required."),
    lastName: z.string().trim().min(2, "Last name is required."),
    email: z.string().trim().email("Enter a valid email."),
    phone: z.string().trim().min(8, "Phone is required."),
    employeeCode: z.string().trim().min(2, "Employee code is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm the password."),
    supportEmail: z.string().trim().email("Enter a valid support email."),
    supportPhone: z.string().trim().min(8, "Support phone is required."),
    currency: z.string().trim().min(2, "Currency is required."),
    timezone: z.string().trim().min(2, "Timezone is required."),
    defaultWorkflow: z.enum(["standard", "manager_hod", "amount_based"]),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SetupAdminFormValues = z.infer<typeof setupAdminSchema>;

export function SetupAdminPage() {
  const navigate = useNavigate();
  const { createInitialAdmin } = useAuth();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupAdminFormValues>({
    resolver: zodResolver(setupAdminSchema),
    defaultValues: {
      organizationName: "IPI Site Connect",
      organizationCode: "IPI",
      legalName: "IPI Site Connect Private Limited",
      gstNumber: "",
      panNumber: "",
      address: "",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      employeeCode: "SC-SUP-NEW",
      password: "",
      confirmPassword: "",
      supportEmail: "support@siteconnect.local",
      supportPhone: "+91 98765 00000",
      currency: "INR",
      timezone: "Asia/Kolkata",
      defaultWorkflow: "amount_based",
    },
  });

  useEffect(() => {
    void authService.checkIfAdminExists().then(setAdminExists);
  }, []);

  async function onSubmit(values: SetupAdminFormValues) {
    const payload: InitialAdminInput = {
      organizationName: values.organizationName,
      organizationCode: values.organizationCode,
      legalName: values.legalName,
      gstNumber: values.gstNumber,
      panNumber: values.panNumber,
      address: values.address,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      employeeCode: values.employeeCode,
      password: values.password,
      supportEmail: values.supportEmail,
      supportPhone: values.supportPhone,
      currency: values.currency,
      timezone: values.timezone,
      defaultWorkflow: values.defaultWorkflow,
    };

    try {
      await createInitialAdmin(payload);
      toast.success("Organization and first Super Admin created.");
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create initial admin.",
      );
    }
  }

  if (adminExists) {
    return (
      <AuthLayout
        title="Admin setup"
        subtitle="This workspace already has an administrator."
      >
        <ErrorState message="Initial setup is locked because an admin account exists." />
        <Link
          to="/login"
          className="mt-6 inline-flex text-sm font-semibold text-brand-blue"
        >
          Back to login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="First setup wizard"
      subtitle="Create the organization master, first Super Admin and default workflow."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {setupSteps.map((label, index) => (
          <Badge key={label} tone={index === step ? "info" : index < step ? "success" : "neutral"}>
            {index + 1}. {label}
          </Badge>
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {step === 0 ? (
          <Card className="space-y-4 p-4">
            <h3 className="text-base font-bold text-text-primary">
              Organization details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Company / Organization Name"
                leftIcon={<Building2 className="h-4 w-4" />}
                error={errors.organizationName?.message}
                {...register("organizationName")}
              />
              <Input
                label="Organization Code"
                error={errors.organizationCode?.message}
                {...register("organizationCode")}
              />
              <Input label="Legal Name" {...register("legalName")} />
              <Input label="GST Number" {...register("gstNumber")} />
              <Input label="PAN Number" {...register("panNumber")} />
              <Input label="City" {...register("city")} />
              <Input label="State" {...register("state")} />
              <Input label="Pincode" {...register("pincode")} />
              <Input
                label="Address"
                className="sm:col-span-2"
                {...register("address")}
              />
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="space-y-4 p-4">
            <h3 className="text-base font-bold text-text-primary">
              First Super Admin
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                leftIcon={<UserRound className="h-4 w-4" />}
                error={errors.firstName?.message}
                {...register("firstName")}
              />
              <Input
                label="Last name"
                leftIcon={<UserRound className="h-4 w-4" />}
                error={errors.lastName?.message}
                {...register("lastName")}
              />
              <Input
                label="Email"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Phone"
                leftIcon={<Phone className="h-4 w-4" />}
                error={errors.phone?.message}
                {...register("phone")}
              />
              <Input
                label="Employee Code"
                error={errors.employeeCode?.message}
                {...register("employeeCode")}
              />
              <Input
                label="Password"
                type="password"
                error={errors.password?.message}
                {...register("password")}
              />
              <Input
                label="Confirm password"
                type="password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="space-y-4 p-4">
            <h3 className="text-base font-bold text-text-primary">
              Company settings
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Support email"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.supportEmail?.message}
                {...register("supportEmail")}
              />
              <Input
                label="Support phone"
                leftIcon={<Phone className="h-4 w-4" />}
                error={errors.supportPhone?.message}
                {...register("supportPhone")}
              />
              <Input
                label="Currency"
                error={errors.currency?.message}
                {...register("currency")}
              />
              <Input
                label="Timezone"
                error={errors.timezone?.message}
                {...register("timezone")}
              />
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="space-y-4 p-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-text-primary">
              <Settings className="h-4 w-4 text-brand-blue" />
              Default workflow choice
            </h3>
            <div className="space-y-3 text-sm text-text-secondary">
              {[
                {
                  value: "amount_based",
                  title: "Amount based matrix",
                  body: "Claims route through Admin, Manager, HOD, Super Admin and Accounts based on thresholds.",
                },
                {
                  value: "manager_hod",
                  title: "Manager and HOD",
                  body: "Most approvals route through Reporting Manager and Department HOD.",
                },
                {
                  value: "standard",
                  title: "Standard",
                  body: "Use the simplest default workflow and refine rules later.",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex gap-3 rounded-lg border border-surface-border bg-white p-3"
                >
                  <input
                    type="radio"
                    value={option.value}
                    className="mt-1 h-4 w-4 accent-brand-blue"
                    {...register("defaultWorkflow")}
                  />
                  <span>
                    <span className="block font-bold text-text-primary">
                      {option.title}
                    </span>
                    <span>{option.body}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card className="space-y-4 p-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-text-primary">
              <CheckCircle2 className="h-4 w-4 text-brand-success" />
              Finish setup
            </h3>
            <p className="text-sm leading-6 text-text-secondary">
              Setup will create the organization master, first Super Admin,
              default department/settings and default role permissions. You can
              then create departments, HODs, managers, users, projects and
              approval workflows from Settings and User Management.
            </p>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
          >
            Previous
          </Button>
          {step < setupSteps.length - 1 ? (
            <Button
              type="button"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() =>
                setStep((current) =>
                  Math.min(current + 1, setupSteps.length - 1),
                )
              }
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              size="lg"
              isLoading={isSubmitting}
              rightIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Create Organization
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
