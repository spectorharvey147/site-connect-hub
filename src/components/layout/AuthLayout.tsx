import { ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-surface-border bg-white shadow-elevated lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden bg-brand-dark p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-blue text-lg font-bold">
              SC
            </div>
            <h1 className="mt-8 text-3xl font-bold tracking-normal">
              Site Connect
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/76">
              Construction site workflows, approvals, attendance and finance in
              one controlled workspace.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-brand-warning" />
              Role-based access enabled
            </div>
            <p className="mt-2 text-xs leading-5 text-white/70">
              Menus, actions and data visibility follow the signed-in user role.
            </p>
          </div>
        </section>
        <section className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-blue text-lg font-bold text-white">
              SC
            </div>
          </div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-normal text-text-primary">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {subtitle}
            </p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
