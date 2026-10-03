import { Injectable, signal } from '@angular/core';
import { DeviceEvent, DeviceEventHandler } from '../core/data/device-events.service';

/** Stands in for DeviceEventsService: the test emits events instead of a server streaming them. */
@Injectable()
export class FakeDeviceEvents {
  readonly connected = signal(true);
  readonly lastSeq = signal(0);
  readonly reconnects = signal(0);
  private readonly handlers = new Set<DeviceEventHandler>();
  private readonly resumes = new Set<() => void>();
  private seq = 0;

  subscribe(handler: DeviceEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onResume(fn: () => void): () => void {
    this.resumes.add(fn);
    return () => this.resumes.delete(fn);
  }

  emit(type: string, payload: Record<string, unknown> = {}, deviceId = 'dev-1'): void {
    const e: DeviceEvent = {
      seq: ++this.seq,
      deviceId,
      type,
      payload,
      at: new Date().toISOString(),
    };
    for (const h of this.handlers) h(e);
  }

  /** The stream came back after a drop. */
  resume(): void {
    for (const fn of this.resumes) fn();
  }
}
