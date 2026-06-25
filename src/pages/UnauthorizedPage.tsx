import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Access Restricted"
        description="This page is not available for your current role."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Access Restricted" },
        ]}
      />
      <EmptyState
        title="Role permission required"
        description="Your account does not have access to this module or action."
        action={
          <Button
            type="button"
            leftIcon={<ShieldAlert className="h-4 w-4" />}
            onClick={() => navigate("/home")}
          >
            Return Home
          </Button>
        }
      />
    </>
  );
}
