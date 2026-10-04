import { TestBed } from '@angular/core/testing';
import { NewTabService } from './new-tab.service';

describe('NewTabService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the address in a new tab that gets no reference back to this page', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    TestBed.inject(NewTabService).open('https://app.example/report/tok?print=1');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      'https://app.example/report/tok?print=1',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('keeps nothing of the new window', () => {
    vi.spyOn(window, 'open').mockReturnValue({ opener: window } as unknown as Window);
    // The service answers nothing, so there is no handle to leave the opener reachable.
    expect(TestBed.inject(NewTabService).open('https://app.example/x')).toBeUndefined();
  });
});
