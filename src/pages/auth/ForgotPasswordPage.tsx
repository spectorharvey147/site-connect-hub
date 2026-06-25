import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/authService";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await authService.requestPasswordReset(values.email);
      setSent(true);
      toast.success("Password reset request submitted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to request reset link.",
      );
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your registered email and we will send a reset link."
    >
      {sent ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-brand-success">
          Check your email for the reset link.
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Email"
            autoComplete="email"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register("email")}
          />
          <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
            Send Reset Link
          </Button>
        </form>
      )}
      <Link
        to="/login"
        className="mt-6 inline-flex text-sm font-semibold text-brand-blue"
      >
        Back to login
      </Link>
    </AuthLayout>
  );
}
