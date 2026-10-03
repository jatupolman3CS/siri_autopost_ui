import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiRole } from '../http/api.service';
import { provideApiTesting, signIn } from '../../testing/api-testing';
import { assistStorage } from '../auth/token';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let http: HttpTestingController;

  async function as(role: ApiRole, assist = false): Promise<PermissionsService> {
    http = provideApiTesting();
    if (assist)
      assistStorage.set({
        adminToken: 'admin-t',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    const perm = TestBed.inject(PermissionsService);
    await signIn(http, { workspace: { role } });
    return perm;
  }

  afterEach(() => http.verify());

  it.each([
    ['viewer', false, false],
    ['editor', true, false],
    ['admin', true, true],
    ['owner', true, true],
  ] as const)('%s: edit %s, admin %s', async (role, edit, admin) => {
    const perm = await as(role);
    expect(perm.canEdit()).toBe(edit);
    expect(perm.canAdmin()).toBe(admin);
    expect(perm.readOnly()).toBe(!edit);
    expect(perm.canCreateWorkspace()).toBe(true);
    expect(perm.editHint() === '').toBe(edit);
    expect(perm.adminHint() === '').toBe(admin);
  });

  it('reads and changes nothing in assist mode, whatever the customer role is', async () => {
    const perm = await as('owner', true);
    expect(perm.assist()).toBe(true);
    expect(perm.canEdit()).toBe(false);
    expect(perm.canAdmin()).toBe(false);
    expect(perm.canCreateWorkspace()).toBe(false);
    expect(perm.editHint()).toBe(perm.adminHint()); // the same reason: assist is read-only
    expect(perm.editHint()).not.toBe('');
  });

  it('is read-only until the workspace is known', () => {
    http = provideApiTesting();
    const perm = TestBed.inject(PermissionsService);
    expect(perm.canEdit()).toBe(false);
    expect(perm.canAdmin()).toBe(false);
  });
});
