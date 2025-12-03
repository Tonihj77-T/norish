import { EventEmitter } from "events";

/**
 * Generic typed event emitter for tRPC subscriptions.
 * @example
 * ```ts
 * type MyEvents = {
 *   created: { id: string };
 *   updated: { id: string; name: string };
 * };
 *
 * const emitter = createTypedEmitter<MyEvents>();
 *
 * // Emit to specific household
 * emitter.emitToHousehold(householdId, "created", { id: "123" });
 *
 * // Emit to specific user
 * emitter.emitToUser(userId, "updated", { id: "123", name: "Test" });
 *
 * // Emit to everyone)
 * emitter.broadcast("created", { id: "123" });
 *
 * // Emit globally (for server-side listeners like CalDAV sync)
 * emitter.emitGlobal("created", { id: "123", userId: "user-1" });
 *
 * // Listen
 * const eventName = emitter.householdEvent(householdId, "created");
 * for await (const [data] of on(emitter, eventName, { signal })) { ... }
 * ```
 */
export class TypedEmitter<TEvents extends Record<string, unknown>> extends EventEmitter {
  emitToHousehold<K extends keyof TEvents & string>(
    householdKey: string,
    event: K,
    data: TEvents[K]
  ): boolean {
    return this.emit(`household:${householdKey}:${event}`, data);
  }

  householdEvent<K extends keyof TEvents & string>(householdKey: string, event: K): string {
    return `household:${householdKey}:${event}`;
  }

  emitToUser<K extends keyof TEvents & string>(
    userId: string,
    event: K,
    data: TEvents[K]
  ): boolean {
    return this.emit(`user:${userId}:${event}`, data);
  }

  userEvent<K extends keyof TEvents & string>(userId: string, event: K): string {
    return `user:${userId}:${event}`;
  }

  broadcast<K extends keyof TEvents & string>(event: K, data: TEvents[K]): boolean {
    return this.emit(`broadcast:${event}`, data);
  }

  broadcastEvent<K extends keyof TEvents & string>(event: K): string {
    return `broadcast:${event}`;
  }

  emitGlobal<K extends keyof TEvents & string>(event: K, data: TEvents[K]): boolean {
    return this.emit(`global:${event}`, data);
  }

  globalEvent<K extends keyof TEvents & string>(event: K): string {
    return `global:${event}`;
  }
}

export function createTypedEmitter<
  TEvents extends Record<string, unknown>,
>(): TypedEmitter<TEvents> {
  const emitter = new TypedEmitter<TEvents>();

  // Increase max listeners to accommodate policy-aware subscriptions
  // Each subscription creates 3 listeners (household, broadcast, user)
  // With multiple event types and users, we need a higher limit
  emitter.setMaxListeners(100);

  return emitter;
}
