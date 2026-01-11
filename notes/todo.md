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
- Pointer lock setting
- When changing zoom, blueprints
- Modes
  - Bulldog
  - Kat'ma
- Fire sound? https://freesound.org/people/Sadisticu/sounds/570695/
- Matchmaking
  - 2v4 - 15 rounds
  - 5v5 - 2 rounds
- Settings not discoverable in game
- Birds & Bees
  - Should redirect target if occupied/avoid crowding
- Should be able to Tab between types in a selection
- Buff stack id & max stack
- Pub functionality
- Pausing?
- Editor improvements
  - Brush size
- Enable queuing actions during construction/upgrades
- Enable queuing actions for gold? This would require monitoring gold...
- Targeting range indicators
- Per-player handicap
- Day/night cycle
  - Reduce wolf/sheep/fox visibility at night
  - Starts day, night at 1:45. Nights last 1:15 and days last 2:00.
- Death animation (sheep)
- Animated Crystal

# Bugs

- Pathing falls over with lots of foxes
  - Attack loops killed play
  - Falls over when spam clicking movement orders
  - Per-player pathing calc limits?
- Runaway number of canvas/renderers?
- Sheep count keeps getting reset?

# Code quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
- WebGPU
