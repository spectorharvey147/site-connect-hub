import { beforeEach, describe, expect, it } from "vitest";

import { themeService } from "@/services/themeService";

describe("themeService", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        get length() { return data.size; },
        clear: () => data.clear(),
        getItem: (key: string) => data.get(key) ?? null,
        key: (index: number) => Array.from(data.keys())[index] ?? null,
        removeItem: (key: string) => data.delete(key),
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("persists dark mode preference and applies the root class", () => {
    themeService.setPreference("dark");
    expect(window.localStorage.getItem("site-connect:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    themeService.setPreference("light");
    expect(window.localStorage.getItem("site-connect:theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
