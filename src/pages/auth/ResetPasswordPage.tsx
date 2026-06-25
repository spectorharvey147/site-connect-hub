import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/authService";
import { cn } from "@/utils/cn";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function getStrength(password: string) {
  if (password.length < 8) {
    return { label: "Weak", className: "bg-brand-danger", width: "w-1/3" };
  }

  const strong =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (strong) {
    return { label: "Strong", className: "bg-brand-success", width: "w-full" };
  }

  return { label: "Medium", className: "bg-brand-warning", width: "w-2/3" };
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const strength = useMemo(() => getStrength(password), [password]);

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await authService.resetPassword({ token, password: values.password });
      toast.success("Password reset complete.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset password.");
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Create a new password for your Site Connect account."
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
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
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", strength.className, strength.width)}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-text-secondary">
            Strength: {strength.label}
          </p>
        </div>
        <Input
          label="Confirm password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          leftIcon={<LockKeyhole className="h-4 w-4" />}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>
      <Link
        to="/login"
        className="mt-6 inline-flex text-sm font-semibold text-brand-blue"
      >
        Back to login
      </Link>
    </AuthLayout>
  );
}
