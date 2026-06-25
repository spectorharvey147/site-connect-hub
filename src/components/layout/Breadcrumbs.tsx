import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-xs">
      <ol className="flex min-w-0 items-center gap-1 text-text-secondary">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : null}
              {item.to && !isLast ? (
                <Link to={item.to} className="truncate hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-semibold text-text-primary">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
