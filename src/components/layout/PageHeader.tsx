import { ArrowLeft, Home } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/Button";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
}: {
  title: string;
  description?: string;
  breadcrumbs: BreadcrumbItem[];
  action?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Home className="h-4 w-4" />}
            onClick={() => navigate("/home")}
          >
            Home
          </Button>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-text-primary md:text-[32px] md:leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
