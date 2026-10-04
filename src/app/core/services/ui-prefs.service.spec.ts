import { TestBed } from '@angular/core/testing';
import { SIMPLE_KEY, UiPrefsService } from './ui-prefs.service';

describe('UiPrefsService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts in simple mode', () => {
    expect(TestBed.inject(UiPrefsService).simple()).toBe(true);
  });

  it('remembers the choice in this browser (ap-simple)', () => {
    const prefs = TestBed.inject(UiPrefsService);
    prefs.toggleSimple();
    expect(prefs.simple()).toBe(false);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('0');
    prefs.set(true);
    expect(localStorage.getItem(SIMPLE_KEY)).toBe('1');
    expect(SIMPLE_KEY).toBe('ap-simple');
  });

  it('reads the stored choice when it starts', () => {
    localStorage.setItem(SIMPLE_KEY, '0');
    expect(TestBed.inject(UiPrefsService).simple()).toBe(false);
  });

  it('treats anything but "0" as simple mode', () => {
    localStorage.setItem(SIMPLE_KEY, 'junk');
    expect(TestBed.inject(UiPrefsService).simple()).toBe(true);
  });

  it('still switches for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const prefs = TestBed.inject(UiPrefsService);
    expect(prefs.simple()).toBe(true);
    prefs.toggleSimple();
    expect(prefs.simple()).toBe(false);
  });
});
