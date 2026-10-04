import {
  downloadCsv,
  downloadJson,
  downloadText,
  EXPORT_FILES,
  JSON_MIME,
  TEXT_MIME,
} from './download';

describe('downloadText', () => {
  let created: Blob[];
  let revoked: string[];
  let clicks: { download: string; href: string; attached: boolean; hidden: string }[];

  beforeEach(() => {
    vi.useFakeTimers();
    created = [];
    revoked = [];
    clicks = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return `blob:test/${created.length}`;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({
        download: this.download,
        href: this.href,
        attached: document.body.contains(this),
        hidden: this.style.display,
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('clicks a temporary link with the file name and the blob address', async () => {
    expect(downloadText('a.txt', 'สวัสดี')).toBe(true);
    expect(clicks).toEqual([
      { download: 'a.txt', href: 'blob:test/1', attached: true, hidden: 'none' },
    ]);
    expect(created).toHaveLength(1);
    expect(await created[0].text()).toBe('สวัสดี');
    expect(created[0].type).toBe(TEXT_MIME);
  });

  it('removes the link from the page after the click', () => {
    downloadText('a.txt', 'x');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('revokes the address after a short delay, not before', () => {
    downloadText('a.txt', 'x');
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1999);
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('uses the given type', () => {
    downloadText('a.csv', 'x', 'text/csv;charset=utf-8');
    expect(created[0].type).toBe('text/csv;charset=utf-8');
  });

  it('keeps the text exactly, including a BOM and line breaks', async () => {
    downloadText('a.csv', '\ufeffa,b\r\n1,2');
    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('\ufeffa,b\r\n1,2');
  });

  it('downloadCsv sends a CSV', () => {
    expect(downloadCsv(EXPORT_FILES.links, 'a')).toBe(true);
    expect(clicks[0].download).toBe('autopost-links.csv');
    expect(created[0].type).toBe('text/csv;charset=utf-8');
  });

  it('downloadJson writes indented JSON', async () => {
    expect(downloadJson(EXPORT_FILES.backup, { version: 2, name: 'ชุด' })).toBe(true);
    expect(clicks[0].download).toBe('autopost-backup.json');
    expect(created[0].type).toBe(JSON_MIME);
    expect(await created[0].text()).toBe('{\n  "version": 2,\n  "name": "ชุด"\n}');
  });

  it('names the exports like the prototype', () => {
    expect(EXPORT_FILES).toEqual({
      links: 'autopost-links.csv',
      posts: 'autopost-posts.csv',
      backup: 'autopost-backup.json',
    });
  });

  it('does nothing and returns false without a document', () => {
    vi.stubGlobal('document', undefined);
    expect(downloadText('a.txt', 'x')).toBe(false);
    expect(created).toHaveLength(0);
    expect(clicks).toHaveLength(0);
  });

  it('does nothing and returns false when blob addresses are not available', () => {
    vi.stubGlobal('URL', {});
    expect(downloadText('a.txt', 'x')).toBe(false);
    expect(clicks).toHaveLength(0);
  });

  it('returns false when the browser refuses', () => {
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('denied');
    });
    expect(downloadText('a.txt', 'x')).toBe(false);
    expect(clicks).toHaveLength(0);
  });
});
