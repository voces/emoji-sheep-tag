# Ideas

- Login system
- Farms
  - Strong?
  - Invis?
  - Money?
- Items
  - Auras?
    - Like team items, but don't like them being required...
  - Beam
  - Suppression Field?
  - Nuke?
  - Hay Trap
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
  - Vamp
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
- Share Gold functionality

# Bugs

- Fire + Illusion?
- Pathing falls over with lots of foxes
  - Falls over when spam clicking movement orders
  - Per-player pathing calc limits?
- A structure could get built just as the sheep dies, common in switch
- When move targetting a unit, the order clears when the target is reached; it
  should keep following

# Perf

- Improvement on mass delete/add
- InstancedGroup
  - Automatic split into "static" and "dynamic"
  - Use `updateRange`
  - Per-mirror instances

# Quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
