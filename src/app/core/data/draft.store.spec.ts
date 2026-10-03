import { defaultTargets } from './draft.store';
import { ACCOUNTS } from '../../testing/api-testing';
import { SocialAccount } from './models';

describe('defaultTargets', () => {
  it('uses the design default (page groups + Instagram) when nothing is connected', () => {
    expect(defaultTargets(ACCOUNTS)).toEqual({
      targets: { 'acc-page': true, 'acc-ig': true },
      groups: ['G1', 'G2', 'G3'],
    });
  });

  it('prefers the account of a paired browser', () => {
    const paired: SocialAccount = {
      ...ACCOUNTS[0],
      id: 'acc-paired',
      name: 'Facebook · Office PC',
      groups: ['Plants', 'Condos'],
      connected: true,
    };
    expect(defaultTargets([...ACCOUNTS, paired])).toEqual({
      targets: { 'acc-paired': true },
      groups: ['Plants', 'Condos'],
    });
  });
});
