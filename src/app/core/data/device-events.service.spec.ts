import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, provideApiTesting, signIn } from '../../testing/api-testing';
import { DeviceEvent, DeviceEventsService } from './device-events.service';
import { WorkspaceStore } from './workspace.store';

const enc = new TextEncoder();

/** A response whose body is the given SSE text, then ends. */
function stream(text: string, status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(text));
      c.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

const event = (seq: number, type: string, payload: object = {}) =>
  `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify({ seq, deviceId: 'd1', type, payload, at: '' })}\n\n`;

describe('DeviceEventsService', () => {
  let http: HttpTestingController;
  let fetchMock: ReturnType<typeof vi.fn>;

  /** Lets the pending promises of the stream loop run, and fake time pass. */
  const run = async (ms = 0) => {
    for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(ms);
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    http = provideApiTesting();
    TestBed.inject(WorkspaceStore);
    await signIn(http);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([401, 403, 404])('stops for good on a %s instead of retrying forever', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    const events = TestBed.inject(DeviceEventsService);
    events.subscribe(() => undefined);
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The backoff would have fired within a minute.
    await run(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.connected()).toBe(false);
  });

  it('retries a server error after a pause', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValue(stream(''));
    const events = TestBed.inject(DeviceEventsService);
    events.subscribe(() => undefined);
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await run(2000);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('hands every event to the subscribers in order and remembers the last Seq', async () => {
    fetchMock.mockResolvedValue(
      stream(
        `event: ready\ndata: {"head":4}\n\n${event(5, 'device.online')}${event(6, 'post', { postId: 'p1' })}`,
      ),
    );
    const events = TestBed.inject(DeviceEventsService);
    const got: DeviceEvent[] = [];
    events.subscribe((e) => got.push(e));
    await run();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/workspaces/${WS}/events/stream`);
    expect(got.map((e) => [e.seq, e.type])).toEqual([
      [5, 'device.online'],
      [6, 'post'],
    ]);
    expect(events.lastSeq()).toBe(6);
  });

  it('asks for what it missed when the stream is opened again', async () => {
    fetchMock.mockResolvedValue(stream(event(7, 'device.online')));
    const events = TestBed.inject(DeviceEventsService);
    events.subscribe(() => undefined);
    await run();
    await run(2000); // the stream ended: it comes back
    const again = fetchMock.mock.calls.find((c) => String(c[0]).includes('after='));
    expect(again?.[0]).toBe(`/api/workspaces/${WS}/events/stream?after=7`);
    expect((again?.[1] as RequestInit).headers).toMatchObject({ 'Last-Event-ID': '7' });
  });
});
