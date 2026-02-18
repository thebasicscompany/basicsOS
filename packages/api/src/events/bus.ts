import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { BasicsOSEvent, BasicsOSEventType } from "@basicsos/shared";

type ListenerFor<T extends BasicsOSEventType, E extends BasicsOSEvent = BasicsOSEvent> =
  E extends { type: T } ? (event: E) => void | Promise<void> : never;

type AnyListener = (event: BasicsOSEvent) => void | Promise<void>;

/**
 * Basics OS Event Bus — typed pub/sub using a composed EventEmitter.
 * Composition over inheritance avoids EventEmitter method signature conflicts.
 */
class BasicsOSEventBus {
  private readonly emitter = new EventEmitter();
  private readonly anyListeners: AnyListener[] = [];

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<T extends BasicsOSEvent>(event: T): boolean {
    // Notify onAny subscribers (e.g. audit logger) before dispatching
    for (const listener of this.anyListeners) {
      void Promise.resolve(listener(event)).catch((err) => {
        console.error("[EventBus] onAny listener error:", err);
      });
    }
    return this.emitter.emit(event.type, event);
  }

  on<T extends BasicsOSEventType>(
    eventType: T,
    listener: ListenerFor<T>,
  ): this {
    this.emitter.on(eventType, listener as (...args: unknown[]) => void);
    return this;
  }

  off<T extends BasicsOSEventType>(
    eventType: T,
    listener: ListenerFor<T>,
  ): this {
    this.emitter.off(eventType, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Subscribe to ALL event types. Used by audit logger and cross-cutting
   * concerns. The listener receives any BasicsOSEvent.
   */
  onAny(listener: AnyListener): this {
    this.anyListeners.push(listener);
    return this;
  }

  removeAllListeners(eventType?: BasicsOSEventType): this {
    this.emitter.removeAllListeners(eventType);
    return this;
  }
}

export const EventBus = new BasicsOSEventBus();

export const createEvent = <T extends BasicsOSEvent>(
  event: Omit<T, "id" | "createdAt">,
): T =>
  ({
    ...event,
    id: randomUUID(),
    createdAt: new Date(),
  }) as T;
