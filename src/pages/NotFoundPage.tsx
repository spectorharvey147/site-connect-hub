import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page p-4">
      <div className="w-full max-w-xl">
        <EmptyState
          title="Page not found"
          description="The requested Site Connect page does not exist."
          action={
            <Button type="button">
              <Link className="text-white" to="/home">
                Return Home
              </Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
