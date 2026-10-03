import { TestBed } from '@angular/core/testing';
import { fmtDate } from './format';
import { I18nService, fmt } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());

  it('picks Thai by default and English after switching', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t().nav.overview).toBe('ภาพรวม');
    i18n.setLang('en');
    expect(i18n.t().nav.overview).toBe('Overview');
    expect(i18n.t().bill.features.pro[0]).toBe('10 social accounts');
  });

  it('fills {placeholders} and leaves unknown ones', () => {
    expect(fmt('{n} of {m} groups', { n: 3 })).toBe('3 of {m} groups');
  });

  it('formats Thai dates with the Buddhist year', () => {
    const d = new Date(2026, 9, 3);
    expect(fmtDate(d, 0, true)).toBe('3 ต.ค. 2569');
    expect(fmtDate(d, 1, true)).toBe('3 Oct 2026');
  });
});
