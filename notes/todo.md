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
- Crystal buffs should auto target?
  - Target own sheep if in range
  - Otherwise closest?
- Allow targeting units too far then cast when near enough (requires shift)
- When targeting, there's a cancel key, but it's not discoverable
  - Left click drag should work even with an active order placement
- Shortcut UX improvements
  - Simplify settings further with WC3 mode, which:
    - Build menu
    - Bite -> A
    - Stop -> S
- Monolith needs new model
- Zoom when joining in-flight practice game is wrong
- Custom control groups (4+)
- Cabin model
  - Remove right room & well & scale
- Drag select should work when initiating on a unit
  - Select units on mouse up, not down
- Healthbars
- Allow multiple hotkeys for the same action; example: on sheep, S or H to stop
- Allow spirits to jump off the pen
- Transfer host
- Modifying a shortcut that is shared should only prompt changing hotkeys for
  other entities that have the same current hotkey
- Modifying a shortcut should swap instead of conflict

# Bugs

- Pathing falls over with lots of foxes
  - Attack loops killed play
  - Falls over when spam clicking movement orders
  - Per-player pathing calc limits?
- Runaway number of canvas/renderers?
- Sheep count keeps getting reset?
- Map selector broken
  - Custom maps do not work with shards
- Alt+S selects all the text
- Illusified huts are treated the same as regular huts, making multi-selection
  bad

# Code quality

- Update the order system so that actions are more generic, based around their
  intrinsic type with fields that modify that. The order handler should be
  generic, based on the fields being used.
- WebGPU
