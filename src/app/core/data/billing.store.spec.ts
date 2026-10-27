import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiBillingProfile } from '../http/api.service';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { BillingStore, cardBrand, parseExpiry } from './billing.store';
import { WorkspaceStore } from './workspace.store';

const EMPTY: ApiBillingProfile = {
  notifyFailed: true,
  notifyExpiring: true,
  notifyRenewal: false,
  card: null,
  paymentsConnected: false,
};

describe('cardBrand and parseExpiry', () => {
  it('tells the brand from the leading digits', () => {
    expect(cardBrand('4242 4242 4242 4242')).toBe('visa');
    expect(cardBrand('5100 0000 0000 0008')).toBe('mastercard');
    expect(cardBrand('2221000000000009')).toBe('mastercard');
    expect(cardBrand('3782 822463 10005')).toBe('amex');
    expect(cardBrand('3530 1113 3330 0000')).toBe('jcb');
    expect(cardBrand('6200 0000 0000 0005')).toBe('unionpay');
    expect(cardBrand('9999')).toBe('card');
  });

  it('reads MM/YY and refuses anything else', () => {
    expect(parseExpiry('12/28')).toEqual({ month: 12, year: 2028 });
    expect(parseExpiry(' 01/30 ')).toEqual({ month: 1, year: 2030 });
    expect(parseExpiry('13/28')).toBeNull();
    expect(parseExpiry('1/28')).toBeNull();
    expect(parseExpiry('12/2028')).toBeNull();
  });
});

describe('BillingStore', () => {
  let http: HttpTestingController;
  let store: BillingStore;

  beforeEach(async () => {
    http = provideApiTesting();
    store = TestBed.inject(BillingStore);
    TestBed.inject(WorkspaceStore); // signIn() answers its workspace list
    await signIn(http);
    http.expectOne('/api/billing/profile').flush(EMPTY);
    await settle();
  });

  afterEach(() => http.verify());

  it('loads the profile of the signed-in customer: no card, nothing connected', () => {
    expect(store.loaded()).toBe(true);
    expect(store.card()).toBeNull();
    expect(store.paymentsConnected()).toBe(false);
  });

  it('sends only the brand, last four digits and expiry of a card', async () => {
    const done = store.saveCard('4242 4242 4242 4242', '12/30');
    const req = http.expectOne('/api/billing/profile/payment-method');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 });
    expect(JSON.stringify(req.request.body)).not.toContain('4242424242424242');
    req.flush({
      ...EMPTY,
      card: {
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2030,
        expired: false,
        expiresSoon: false,
      },
    });
    await done;
    expect(store.card()?.last4).toBe('4242');
  });

  it('passes the refusal of an expired card to the form', async () => {
    const done = store.saveCard('4242 4242 4242 4242', '01/20');
    http
      .expectOne('/api/billing/profile/payment-method')
      .flush({ title: 'บัตรนี้หมดอายุแล้ว' }, { status: 422, statusText: 'Unprocessable' });
    await expect(done).rejects.toBeTruthy();
    expect(store.card()).toBeNull();
  });

  it('shows a notification choice at once and puts it back when the server refuses', async () => {
    const done = store.saveNotifications({ notifyRenewal: true });
    expect(store.profile()?.notifyRenewal).toBe(true); // optimistic
    const req = http.expectOne('/api/billing/profile/notifications');
    expect(req.request.body).toEqual({
      notifyFailed: true,
      notifyExpiring: true,
      notifyRenewal: true,
    });
    req.flush(null, { status: 500, statusText: 'Server Error' });
    await expect(done).rejects.toBeTruthy();
    expect(store.profile()?.notifyRenewal).toBe(false);
  });

  it('removes the card', async () => {
    const done = store.removeCard();
    const req = http.expectOne('/api/billing/profile/payment-method');
    expect(req.request.method).toBe('DELETE');
    req.flush(EMPTY);
    await done;
    expect(store.card()).toBeNull();
  });
});
