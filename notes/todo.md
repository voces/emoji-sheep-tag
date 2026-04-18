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
  - Bulldog
  - Kat'ma
- Matchmaking
  - 2v4 - 15 rounds
  - 5v5 - 2 rounds
- Birds & Bees
  - Should redirect target if occupied/avoid crowding
- Buff stack id & max stack
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
- Settings not discoverable in game

# Bugs

- Sheep count keeps getting reset?
- Switch broken - won without timer expiring
- Tree regrowth is hacked onto a health decay, which renders a healthbar

# Infra

- Shard image and primary server can get out of sync (both use shared/ code but
  are deployed independently via separate GitHub Actions / fly deploy)

# Code quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
- WebGPU
- Store .estme files in git; build to .estb during build, similar to audio
  processing
