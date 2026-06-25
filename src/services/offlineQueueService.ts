import { attendanceService } from "@/services/attendanceService";
import type { AppUser } from "@/types/auth";
import type { GeoLocationPoint } from "@/types/attendance";

export interface OfflineQueueItem<T = unknown> {
  id: string;
  type: "attendance-check-in" | "attendance-check-out" | "dpr-draft" | "claim-draft";
  payload: T;
  createdAt: string;
}

const DATABASE_NAME = "site-connect-offline";
const STORE_NAME = "queue";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineQueueService = {
  async enqueue<T>(
    item: Omit<OfflineQueueItem<T>, "id" | "createdAt">,
  ) {
    const db = await database();
    const value: OfflineQueueItem<T> = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .add(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  },

  async list() {
    const db = await database();
    const values = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as OfflineQueueItem[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return values;
  },

  async remove(id: string) {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  },

  async sync(actor: AppUser) {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    const items = await this.list();
    let synced = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const payload = item.payload as {
          projectId?: string;
          location?: GeoLocationPoint;
        };
        if (item.type === "attendance-check-in") {
          await attendanceService.checkIn(actor, payload.location, payload.projectId);
        } else if (item.type === "attendance-check-out") {
          await attendanceService.checkOut(actor, payload.location);
        } else {
          continue;
        }
        await this.remove(item.id);
        synced += 1;
      } catch {
        failed += 1;
      }
    }
    return { synced, failed };
  },
};
