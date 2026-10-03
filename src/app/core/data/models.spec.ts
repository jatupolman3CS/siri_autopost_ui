import { SocialAccount, accountKind } from './models';
import { ACCOUNTS } from '../../testing/api-testing';

describe('accountKind', () => {
  const fb = ACCOUNTS[0];

  it('knows an account a browser posts for', () => {
    expect(accountKind({ ...fb, connected: true, name: 'Facebook · Shop PC' })).toBe('connected');
  });

  it('tells an unbound browser account from a sample account: both are not connected', () => {
    const unbound: SocialAccount = {
      ...fb,
      connected: false,
      name: 'Facebook · Shop PC',
      health: 'relogin',
    };
    expect(accountKind(unbound)).toBe('unbound');
    expect(accountKind(fb)).toBe('sample');
    expect(accountKind(ACCOUNTS[2])).toBe('sample'); // the sample TikTok account also asks to sign in
  });
});
