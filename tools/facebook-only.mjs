// Keeps the design's sample data to what the product supports for now: Facebook groups and pages. The
// design handoff also has Instagram, X, TikTok, LINE OA and Threads accounts and targets; those belong to a
// later phase, so a re-import (tools/import-design-data.mjs) must not bring them back.
export function facebookOnly(seed) {
  // The accounts of the sample are Facebook pages with groups; a personal profile is no posting target.
  const accounts = seed.accounts.filter((a) => a.platform === 'fb' && a.hasGroups);
  const ids = new Set(accounts.map((a) => a.id));
  // `memberGroups` fed "import groups from an account", which is gone; a link set has no other accounts.
  const { memberGroups: _memberGroups, ...rest } = seed;
  return {
    ...rest,
    platforms: { fb: seed.platforms.fb },
    targetSets: seed.targetSets.map(({ accounts: _accounts, ...set }) => set),
    accounts,
    targets: seed.targets.filter((t) => t.p === 'fb' && ids.has(t.a)),
    failed: seed.failed.filter((f) => f.platform === 'fb' && ids.has(f.accountId)),
    limits: { fb: seed.limits.fb },
    usedToday: { fb: seed.usedToday.fb },
  };
}
