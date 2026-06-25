import { type HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-green-50 text-brand-success border-green-200",
  warning: "bg-orange-50 text-[#B56200] border-orange-200",
  danger: "bg-red-50 text-brand-danger border-red-200",
  info: "bg-brand-light text-brand-blue border-blue-200",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
