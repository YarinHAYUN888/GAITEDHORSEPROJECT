import { supabase } from "@/integrations/supabase/client";

interface OfflineMutation {
  id: string;
  table: string;
  action: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  timestamp: number;
}

const QUEUE_KEY = "susitsa-offline-queue";

function getQueue(): OfflineMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineMutation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineMutation(
  table: string,
  action: OfflineMutation["action"],
  payload: Record<string, unknown>
) {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    table,
    action,
    payload,
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining: OfflineMutation[] = [];

  for (const mutation of queue) {
    try {
      const tableName = mutation.table as any;
      let error: any = null;

      if (mutation.action === "insert") {
        ({ error } = await supabase.from(tableName).insert(mutation.payload as any));
      } else if (mutation.action === "update") {
        const { id, ...rest } = mutation.payload;
        ({ error } = await supabase.from(tableName).update(rest as any).eq("id", id as string));
      } else if (mutation.action === "delete") {
        ({ error } = await supabase.from(tableName).delete().eq("id", mutation.payload.id as string));
      }

      if (error) {
        console.warn("[OfflineSync] Failed mutation:", error);
        remaining.push(mutation);
        failed++;
      } else {
        succeeded++;
      }
    } catch {
      remaining.push(mutation);
      failed++;
    }
  }

  saveQueue(remaining);
  return { succeeded, failed };
}

export function getQueueSize(): number {
  return getQueue().length;
}

// Auto-flush when back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().then(({ succeeded }) => {
      if (succeeded > 0) {
        console.log(`[OfflineSync] Synced ${succeeded} queued mutations`);
      }
    });
  });
}
