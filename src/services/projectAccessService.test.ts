import { describe, expect, it } from "vitest";

import { COST_CODE_OPTIONS, PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { projectAccessService } from "@/services/projectAccessService";

describe("projectAccessService", () => {
  it("serves demo projects and cost codes only through selectable helpers", async () => {
    const user = toAppUser(DEMO_USERS[0]);
    const projects = await projectAccessService.getSelectableProjectsForUser(user);
    const costCodes = await projectAccessService.getSelectableCostCodesForProject(
      PROJECT_OPTIONS[0].id,
    );

    expect(projects.map((project) => project.id)).toEqual(
      PROJECT_OPTIONS.map((project) => project.id),
    );
    expect(costCodes.map((costCode) => costCode.id)).toEqual(
      COST_CODE_OPTIONS.filter(
        (costCode) => costCode.projectId === PROJECT_OPTIONS[0].id,
      ).map((costCode) => costCode.id),
    );
  });
});
