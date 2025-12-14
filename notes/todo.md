# Ideas

- Login system
- Farms
  - Strong?
  - Invis?
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
- Pointer lock setting
- Server-side visibility for attack cancel on cliffs?
- Can hear through fog
- When changing zoom, blueprints
- Modes
  - Bulldog
  - Kat'ma
- Fire sound? https://freesound.org/people/Sadisticu/sounds/570695/
- Matchmaking
  - 2v4 - 15 rounds
  - 5v5 - 2 rounds
- Settings not discoverable in game
- In game scoreboard
- Birds & Bees
  - Should redirect target if occupied/avoid crowding
  - Birds
    - Should spawn a fixed set from trees
    - Should rest on branches
  - Bees
    - Should rest on one of the three flowers
- Should be able to Tab between types in a selection
- Buff stack id & max stack
- Redirect?
- Pub functionality
- Pausing?
- Editor improvements
  - Brush size
- Spacebar for last ping

# Bugs

- Fire + Illusion?
- Pathing falls over with lots of foxes
  - Falls over when spam clicking movement orders
  - Per-player pathing calc limits?
- Turning is not correctly interpolated when building
- Runaway number of canvas/renderers?
- Katama issue: Chat etc does not work after going to Settings > Shortcut?

# Code quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
- WebGPU
