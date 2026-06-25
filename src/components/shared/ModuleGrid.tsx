import { ModuleTile } from "@/components/shared/ModuleTile";
import type { ModuleDefinition } from "@/types/modules";

export function ModuleGrid({
  modules,
  pendingCounts,
}: {
  modules: ModuleDefinition[];
  pendingCounts: Record<string, number>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {modules.map((module) => (
        <ModuleTile
          key={module.key}
          module={module}
          pendingCount={
            module.pendingCountKey ? pendingCounts[module.pendingCountKey] : 0
          }
        />
      ))}
    </div>
  );
}
