import { TestBed } from '@angular/core/testing';
import { AdminStore } from './admin.store';

describe('AdminStore', () => {
  let admin: AdminStore;

  beforeEach(() => (admin = TestBed.inject(AdminStore)));

  it('suspends a customer and pauses their jobs', () => {
    admin.apply('c2', 'suspend');
    expect(admin.customer('c2')?.status).toBe('suspended');
    expect(admin.customer('c2')?.paused).toBe(true);
  });

  it('records a refund for the given transaction', () => {
    const before = admin.transactions().length;
    admin.apply('c4', 'refund', 't1');
    const refund = admin.transactions()[0];
    expect(admin.transactions().length).toBe(before + 1);
    expect(refund).toMatchObject({ cust: 'c4', type: 'refund', amount: 790 });
  });

  it('a successful charge retry clears "past due"', () => {
    admin.retryCharge('t2');
    expect(admin.transactions().find((x) => x.id === 't2')?.type).toBe('charge');
    expect(admin.customer('c3')?.status).toBe('active');
  });

  it('uses the override limit, where 0 means unlimited', () => {
    admin.setPlanField('pro', 'posts', 0);
    expect(admin.plans().pro.posts).toBeNull();
    admin.setPlanField('pro', 'price', 990);
    expect(admin.plans().pro.price).toBe(990);
  });
});
