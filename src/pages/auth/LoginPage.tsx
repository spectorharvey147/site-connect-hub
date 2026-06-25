import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DEMO_PASSWORD, DEMO_USERS } from "@/constants/demoData";
import { authService } from "@/services/authService";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  identifier: z.string().trim().min(2, "Enter your email or employee ID."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const rememberedIdentifier = useMemo(
    () => authService.getRememberedIdentifier(),
    [],
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: rememberedIdentifier,
      password: "",
      rememberMe: Boolean(rememberedIdentifier),
    },
  });

  const redirectState = location.state as
    | { from?: { pathname?: string } }
    | undefined;
  const redirectTo = redirectState?.from?.pathname ?? "/home";

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      await login(values);
      toast.success("Signed in successfully.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in.";
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your company email or employee ID to access Site Connect."
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Email / Employee ID"
          autoComplete="username"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          leftIcon={<LockKeyhole className="h-4 w-4" />}
          rightIcon={
            <button
              type="button"
              className="rounded text-text-secondary hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-surface-border text-brand-blue focus:ring-brand-blue"
              {...register("rememberMe")}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold">
            Forgot password?
          </Link>
        </div>
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-brand-danger">
            {formError}
          </div>
        ) : null}
        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          Sign In
        </Button>
      </form>

      {!isSupabaseConfigured ? (
        <Card className="mt-6 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-text-primary">Demo mode</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Select a role to populate local demo credentials.
              </p>
            </div>
            <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-blue">
              Local
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_USERS.slice(0, 5).map((user) => (
              <button
                key={user.id}
                type="button"
                className="rounded-md border border-surface-border px-3 py-2 text-left text-xs transition hover:border-brand-blue hover:bg-brand-light"
                onClick={() => {
                  setValue("identifier", user.email, { shouldValidate: true });
                  setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
              >
                <span className="block font-semibold text-text-primary">
                  {user.fullName}
                </span>
                <span className="block truncate text-text-secondary">
                  {user.email}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </AuthLayout>
  );
}
