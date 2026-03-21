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
- Settings not discoverable in game
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
- Allow to leave lobby
- Allow to return to main menu

# Bugs

- Sheep count keeps getting reset?
- Two units with autocast next to each other both cast at the same time
- Switch broken - won without timer expiring

# Code quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
- WebGPU
- Store .estme files in git; build to .estb during build, similar to audio
  processing
