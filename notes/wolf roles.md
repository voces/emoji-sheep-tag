# Roles

The top level approach of wolf AI should be through acting out a role. When
wolfing, you play a certain role depending on the current state of play and the
idealized next state of play. For example, in 2v4, if a wolf is nearest the
center, their role is camper, even before a sheep has been captured. They need
to ensure they have the shortest route towards the middle in case a kill is
made, preventing any free saves.

In all circumstances, the wolf should generally use a mirror image. The real
wolf and the mirror image have their own roles, but the real wolf may override
the image's role. For example, if a real wolf is playing a flank role while the
image is playing the chase role, the real should shift into chase when it's a
minimum distance away, forcing the image into a flank or block role. Generally,
wolves should always have an image out, so they image roughly when they spawn,
but sometimes delay it if they are a flank wolf to get in position faster. When
an image expires, the wolf typically reimages. If an image is trapped, it may be
better to reimage to get back the utility.

## List of roles - Survival

### 1v1

1v1 is inherently casual. The only way to the sheep actually stressed would be a
very large amount of gold for the wolf, which fundamentally changes the game
towards something that is not really Sheep Tag. So instead, the wolf puts in
some effort but overall isn't generally a try-hard.

Unlike 1v2+, the sheep is generally expected to not mass farms but instead to
runtag, placing few farms and always being on the move. When they build up too
many farms, they typically destroy them to clear the field.

#### Chase (Attack)

When the wolf is within a minimum distance from the sheep, it should shift into
chase, simply attacking the sheep. This is because sheep are liable to mess up,
and it's generally better to attack just in case to get the easy kill. Typically
this distance is 2-4 units away. Idealized play would be to also queue an attack
move forward in case the sheep goes up a hill and becomes hidden by fog.

#### Intercept

When the sheep is far away from the wolf, the wolf should predict where the
sheep will be by the time the wolf gets there and head towards that interception
point rather than directly at the sheep. They "lead" by a hefty margin.
Interceptors transition into flanking or chasing when they get within certain
distance of the sheep, such as 5-10 units. Intercepting is used quickly to catch
up to a sheep, like a missile.

#### Flank

When approaching the sheep with a partner (in 1v1, an image), it does not make
sense for both to play a similar role. Instead, there are two variants of
flanking: parallel flanking and block flank.

With parallel flanking, both wolves move side-by-side, keeping the sheep penned
in, forcing them to always move forward. Eventually the sheep will be forced
into the edge of the map or terrain.

With block flanking, one wolf takes the role of chasing while the other flanks.
Ideally, they'd flank against the "ideal" route of the sheep. In 1v1, this
typically means they flank on the side that lets the sheep into the greater area
of the map. This helps force the sheep into the edge of the map or terrain. Most
often, this means the flank should be on the "inside," between the sheep and the
middle of the map.

In either case, the goal of the flanker is to corral the sheep.

The real wolf should transition to chasing when they get near and the image into
flanking or blocking.

If the sheep suddenly beelines for the flank, and the flank is an image, it
should transition into blocking.

#### Blocker

While the initial use of a mirror image is tricking the sheep and to keep them
guessing which is real and which is the image, the primary use in Sheep Tag is
as a blocker. Since the sheep will quickly discover which wolf is real and which
is the image, the next use of the image is simply to get in the way of the
sheep. In 1v1, this means they can't flee as easily and just overall increases
the difficulty for the sheep to runtag. The real wolf can pretend to be a
blocker, but must transition into an attack when the sheep is close (as the
image can't actually attack). The real wolf should only block if there is an
image on play.

In 1v1, the primary purpose of the blocker is to simply block where the sheep is
going, forcing them to reroute around it. The blocker will micro its position,
stepping forward a little bit by little bit to ensure it stays in front of the
sheep while the sheep is constantly trying to route around it. If the sheep
turns, the blocker may need to transition into a flank role.

### 1v2

In 1v2 it becomes more competitive and starts to straddle the line between
"competitive" and just for fun. The sheep may start to mass, which requires the
wolves to adopt more specialized roles.

#### Cutter

Since there may be a mass in 1v2, wolves need to recursively split the mass to
reduce the safety area of the sheep with the ultimate goal of either capturing
the sheep within the mass or forcing the sheep out of the mass, in which case we
transition into runtag, placing the sheep at a disadvantage.

The cutter's role is to divide the mass. There are a few considerations when
dividing the mass, but the top-level goal is to reduce the number of farms the
sheep is in. This can mean a binary cut, splitting the mass into two equal
parts, but also if the sheep is on one side, you can try to do a less-even cut
if the sheep will end up in even less than half, such as 1/3rd, of farms.
Another consideration is how easily the sheep can escape to the other side or
even prolong the cut line, so wolves should target cuts that require the least
amount of structures to be destroyed. In terms of prolonging, it's a risk the
sheep simply expands along the cut line, or hardens the cut line with stronger
or more densely placed structures. In this case, the cutter typically will
continue the cut regardless, but they may also transition to another line. They
may especially consider simply shifting the cut line to avoid a single point of
hardness.

The primary idea of cutting isn't to destroy structures, but to split the
overall mass. Wolves must prevent the sheep from rejoining the mass, which they
should be able to do as they should be able to win all races within a mass.

#### Flank

With more than 1 wolf and a mass, flanking evolves to going around the mass.
It's important that real wolves still make use of their attack, however, so real
wolf flanking against a mass often involves some cutting as well, but the
primary importance is to ensure the sheep cannot freely expand. Cutting is done
trim off some of the mass opportunistically. The overall strategy remains the
same: get the sheep into as few farms as possible and to slowly push them up
against the terrain or edge of the map.

#### Blocker

In 1v1, blocking is primarily used in runtag. In 1v2, it shifts to also blocking
the expansion of the mass. The core idea is still similar: the image will block
where the sheep can move, which can be even easier if the sheep is trying to
exit their mass lattice since there are small (if many) fixed exit points. Even
after the sheep is outside the edge of their mass, the image can predict where
the sheep is trying to place a structure and simply get in the way. Do this
repeatedly and correctly and the sheep won't be able to place anything. A single
image can place up to four grid aligned placements by standing at the center
point, but often they focus on the 1-2 most common.

A sheep may counter by trying to trap the image in structures. Since the image
has very low damage, it takes a very long time for an image to break free, so
often this forces a reimage. The image therefore must be wary about traps and
simply make sure they are on the "outside" of the sheep and their mass. The
minor exception to this if a real wolf is coming in. In this case, the image's
job is to prevent the sheep from getting back into their mass.

Typically, images immediately flank around the mass and head towards the back of
the mass, as that's where the sheep is going to be expanding. Their goal is to
stay between the sheep and the outside of their mass.

#### Transition point

Massing involves building structures in a regular grid to form a lattice in
which the sheep can fit through the cracks but the wolf cannot. For the game to
be viably competitive, the wolves must be able to divide the mass faster than
the sheep can build/repair it. This is typically at the 1v3 point, but may also
be at the 1v2 point. At the beginning, the sheep is given a head start to get a
mass up and going. Over the course of a minute or two, the wolves gain ground
until the sheep is left in just a few structures. At this point, the sheep is
either trapped within their own mass and the wolves grind down and capture the
sheep, or the sheep is forced out into the open. This is when the game
transitions into a state of runtag. The sheep is primarily running, not
building, while the wolves are primarily chasing, not destroying farms. The
wolves' goal is to ensure the sheep does not make it back into the mass and to
force the sheep into the edge of the map or a terrain wall. The sheep's goal is
to somehow make it back into their mass or to use a terrain choke point to start
a new mass (but this is typically only going to just prolong the game a bit;
typically sheep want back into their mass).

### 1v3

1v3 is a true competitive match, as it fits the (n v n+2) idealized match. The
long term strategy of the wolves is to corral the sheep into terrain or the edge
of the map. They do this by having a center, left flank, and right flank.
However, this must organically work with the sheep's mass. To this end, the
center is typically cutting through the centerline, or around there, while the
flanks do a mix of positioning ideally so the sheep can circle left or right but
also cut to reduce the effective mass.

#### Cutter

The center is typically the cutter. Cutting remains mostly the same, with a
minor exception. With 3 wolves, the strategy of double cutting becomes sometimes
viable. Since the default structure of sheep is destroyed in two hits and wolves
can fit within a cut line, two wolves can work side by side to make a single
cut, doubling their cut speed. This comes at the cost of less flank coverage, so
this must be used strategically: the mass is relatively large or the sheep is
not in position to take advantage of the reduced coverage.

Cutting is the critical role, and someone must play it. Flanking is
semi-optional, but generally also critical. Images can somewhat play the role as
flanking/blocking.

### 2v3

Fairly uncommon format since the sheep gain advantage; the more common format
may be 1v4, which plays similar to 1v3 except the additional wolf can flank. In
2v3, the sheep now have team strategies. A new role and two new considerations
come into play.

#### Camper

When a sheep is captured, they gain a spirit spawns in the pen usually located
in the center of the map. The spirit cannot leave the pen, but an allied sheep
is able to revive them. As such, the wolves must prevent saving. A single wolf
is often designated the camper. They have the job of ensuring they can win any
race to the middle against any sheep. That way, if a sheep is captured, they
ensure a save isn't won freely. This job includes both being aware of where the
other sheep are and the pen entrances to ensure they cannot be boxed out.
Campers do not always need to be in the pen, especially in 2v3, so long as they
are the closest unit to the pen.

When it's ambiguous, the camper is typically the wolf closest to the center.
Whoever is camper can transition, however. For example, if a sheep runs towards
the center then away, but not in any farms, it may make sense for the camper to
transition to chaser while a far behind chaser transitions into camper.

#### Isolation

The wolves cannot haphazardly go against the sheep. Instead, they must focus one
sheep at a time. In 2v3, this is difficult, but it means at least two wolves
should be going against a single sheep. They must isolate them from the other
sheep, reduce their effective mass, then capture or force them out of the mass
(then capture). Ideally, they pick the sheep that is also closest to the middle
to also make use of the camper, but this is not always feasible.

#### Countering bridging

Bridging is a sheep role! When there are 2 sheep, the wolves are going to focus
one sheep. The sheep not being focused must then help their ally! They do this
by:

1. Threatening the middle, forcing a camper into the pen and thus less useful.
   The non-focused sheep should either take and hold middle for as long as
   possible or be between the camper and the other sheep, minimizing the
   camper's aid to their allies.
2. Repairing the mass, preventing the sheep from being isolated. Wolves must
   actively be wary of other sheep and regularly threaten such sheep. They can
   make use of images here to block their progress. Sometimes, wolves may rotate
   to a new sheep if one risks too much and places themself in an even more
   precarious position than the targeted sheep.
3. Actively bridging the masses together. The sheep will aggressively go against
   the wolves to provide an escape route for their ally. The wolves must again
   be wary of this and actively prevent it.

### 2v4+

All strategies have essentially been outlined, they just become more feasible.
Generally, the magic number of wolves is 3 on a sheep: left, center, right. Then
you have 1 camper.

#### Camper

With many sheep, they have methods of defeating a single camper. In this case,
the camper must make use of their image and may need reinforcement from allied
wolves if multiple sheep are trying to force a save against a captured sheep.

#### Extra wolves

In larger games, such as 3v5, the "extra" wolves should generally join the
isolation task force. However, their primary role is typically to ward off sheep
allies from repairing or bridging the mass.
