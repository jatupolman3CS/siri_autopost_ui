import { SocialAccount, accountKind } from './models';
import { PLATFORMS } from './platforms';
import { ACCOUNTS } from '../../testing/api-testing';

describe('accountKind', () => {
  const fb = ACCOUNTS[0];

  it('knows an account a browser posts for', () => {
    expect(accountKind({ ...fb, connected: true })).toBe('connected');
  });

  it('calls an account that no browser posts for unbound: every account came from a paired browser', () => {
    const unbound: SocialAccount = { ...fb, connected: false, health: 'relogin' };
    expect(accountKind(unbound)).toBe('unbound');
    expect(accountKind(fb)).toBe('unbound');
  });
});

// Facebook groups and pages and LINE OA customer chats are posted to; the other platforms are a later phase.
describe('platforms', () => {
  it('knows Facebook and LINE OA and nothing else', () => {
    expect(Object.keys(PLATFORMS)).toEqual(['fb', 'line']);
    expect(PLATFORMS.fb).toEqual({ name: 'Facebook', icon: 'ph-facebook-logo' });
    expect(PLATFORMS.line).toEqual({ name: 'LINE OA', icon: 'ph-chat-circle-text' });
  });
});
