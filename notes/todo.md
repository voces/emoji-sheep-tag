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
- Beam: reads as a thick line rather than a cone (frustum taper 1->2 over length
  6 is too subtle; widen the end width?)
- Cancel (cancel-upgrade): multiple detectors; pick/order by context
- Wolf invisible to sheep until the sheep moved (fog/vision not updated for a
  stationary observer)

# Infra

- Shard image and primary server can get out of sync (both use shared/ code but
  are deployed independently via separate GitHub Actions / fly deploy)

# Code quality

- WebGPU
- Store .estme files in git; build to .estb during build, similar to audio
  processing
