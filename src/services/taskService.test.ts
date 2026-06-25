import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { taskService } from "@/services/taskService";
import type { AppUser } from "@/types/auth";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("taskService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    taskService.resetDemoData();
  });

  it("allows managers to create tasks and blocks site staff from creating", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      taskService.createTask(
        {
          title: "Unauthorized task",
          description: "Site staff cannot assign work.",
          projectId: "project-metro",
          assignedTo: siteUser.id,
          priority: "medium",
          dueDate: "2099-01-15",
          dueTime: "18:00",
          estimatedHours: 2,
          attachments: [],
        },
        siteUser,
      ),
    ).rejects.toThrow("You do not have permission to create tasks.");

    const task = await taskService.createTask(
      {
        title: "Inspect access platform",
        description: "Confirm safe access before concrete pour.",
        projectId: "project-metro",
        assignedTo: siteUser.id,
        priority: "high",
        dueDate: "2099-01-15",
        dueTime: "17:30",
        estimatedHours: 4,
        attachments: [],
      },
      manager,
    );

    expect(task.taskNumber).toBe("TSK-2026-0004");
    expect(task.createdBy).toBe(manager.id);
    expect(task.assignedTo).toBe(siteUser.id);
  });

  it("shows assigned tasks to the employee", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    const task = await taskService.createTask(
      {
        title: "Prepare cube test samples",
        description: "Prepare and label cube samples from pour batch.",
        projectId: "project-metro",
        assignedTo: siteUser.id,
        priority: "medium",
        dueDate: "2099-01-16",
        estimatedHours: 3,
        attachments: [],
      },
      manager,
    );

    const visibleTasks = await taskService.listTasks(siteUser, {
      search: "cube",
    });

    expect(visibleTasks.map((item) => item.id)).toContain(task.id);
  });

  it("validates progress and marks completed tasks as 100 percent", async () => {
    const siteUser = userByEmail("site@siteconnect.local");

    await expect(
      taskService.updateTaskStatus(
        {
          taskId: "task-demo-001",
          status: "in_progress",
          progressPercent: 140,
        },
        siteUser,
      ),
    ).rejects.toThrow("Progress must be between 0 and 100.");

    const completed = await taskService.updateTaskStatus(
      {
        taskId: "task-demo-001",
        status: "completed",
        progressPercent: 80,
        comment: "Completed after final inspection.",
      },
      siteUser,
    );

    expect(completed.progressPercent).toBe(100);
    expect(completed.completedAt).toBeTruthy();
    expect(completed.comments[0]?.comment).toBe("Completed after final inspection.");
  });
});
