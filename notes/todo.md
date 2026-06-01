# Ideas

- Login system
- Farms
  - Strong?
  - Money?
- Items
  - Auras?
    - Like team items, but don't like them being required...
  - Suppression Field?
  - Nuke?
  - Goblins?
  - Disease Cloud?
  - Neck
  - Sobi Mask
  - Crystal Ball
- When changing zoom, blueprints
- Modes
  - Kat'ma
- Matchmaking
  - 2v4 - 15 rounds
  - 5v5 - 2 rounds
- Birds & Bees
  - Should redirect target if occupied/avoid crowding
- Buff stack id & max stack
  - Frost: define a max stack count
  - Speed potion: is stacking intended? If so, add a max stack count
  - Strength potion: should multiple drinks queue one-after-another or
    true-stack?
  - (Effects system makes capping easy: `replaceByName` on the applyBuff effect,
    or a stack-id/max mechanism on the buff)
- Pub functionality
- Pausing?
- Editor improvements
  - Brush size
- Enable queuing actions during construction/upgrades
- Enable queuing actions for gold? This would require monitoring gold...
- Targeting range indicators
- Per-player handicap
- Death animation (sheep)
- Monolith needs new model
- Mobile: observe+chat friendly

# Bugs

- Sheep count keeps getting reset?
- Switch broken - won without timer expiring
- Mirror image: recasting mid-cast re-consumes mana and interrupts the cast. Add
  a brief (~0.5s) cooldown OR block recasting while already in progress.
  (Pre-existing: `isAlreadyCasting` doesn't match target-less self-casts since
  it checks `"target" in order`.)
- Bomber: AoE cursor circle color depends on the previous cursor color
- Beam: reads as a thick line rather than a cone (frustum taper 1->2 over length
  6 is too subtle; widen the end width?)
- Hay trap: spawns grass in flight; the hayCube / in-flight grass likely needs
  `isEffect` so it doesn't block pathing
- Cancel (cancel-upgrade): multiple detectors; pick/order by context
- Autocast UI: marching-ants border only renders the top and left edges
- Wolf invisible to sheep until the sheep moved (fog/vision not updated for a
  stationary observer)
- Editor: Move up/down/left/right actions reference missing icons
  (`up`/`down`/`left`/`right` in server/systems/editor.ts) -- the
  `client/assets/{up,down,left,right}.svg` were deleted in 4af2b5b ("pref + more
  revo-like terrain", 2026-04-26). Restore via
  `git checkout 4af2b5b^ -- client/assets/{up,down,left,right}.svg` (sources are
  listed in client/assets/sources.md, svgrepo arrow icons).
- Leaving a lobby as the last player throws "Setting gold on team-sheep outside
  batch". `leave()` (lobbyApi.ts:266+) redistributes the leaver's gold to allies
  via `sendPlayerGold` -> `grant/deductTeamGold`, which mutate the team ECS
  entity outside an `app.batch` (the leave runs in a socket handler, not a
  tick). Wrap the gold redistribution (and `removePlayerFromEcs`) in the round's
  ECS batch, or skip it when there are no surviving allies / the round is
  ending.

# Infra

- Shard image and primary server can get out of sync (both use shared/ code but
  are deployed independently via separate GitHub Actions / fly deploy)

# Code quality

- WebGPU
- Store .estme files in git; build to .estb during build, similar to audio
  processing
