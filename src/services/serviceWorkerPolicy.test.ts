import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker=readFileSync("public/service-worker.js","utf8");
describe("service worker privacy policy",()=>{
  it("only caches approved static requests",()=>{expect(worker).toContain("isApprovedStaticRequest");expect(worker).toContain('request.headers.has("authorization")');expect(worker).toContain('url.pathname.startsWith("/api/")');expect(worker).not.toMatch(/if \(event\.request\.method !== "GET"\) return;\s*event\.respondWith\(\s*fetch/);});
  it("does not cache private or no-store responses and versions caches",()=>{expect(worker).toMatch(/no-store\|private/);expect(worker).toContain("CACHE_PREFIX");expect(worker).toContain("caches.delete");});
});
