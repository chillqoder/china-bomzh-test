Build a complete, playable 3D fishing game using Next.js, TypeScript, and Three.js. The game should be inspired by the atmosphere and gameplay loop of Russian Fishing, while using original visuals and interface design.

The entire player-facing interface must be in Russian.

Create the actual working project, not a mockup or a design document. Implement the fishing mechanics, 3D environment, fish simulation, catch results, inventory, and progression.

GAME CONCEPT

The player fishes from the shore of a peaceful lake in the Russian countryside.

Use a first-person perspective. The player can look around, choose where to cast, adjust casting distance, wait for a bite, set the hook, and fight the fish.

The core loop is:

Choose bait → aim → cast → wait for a bite → set the hook → reel in the fish → inspect the catch → keep or release it → improve equipment.

Prioritize a satisfying, complete fishing experience over a large but unfinished world.

TECHNOLOGY

- Use Next.js with the App Router and TypeScript.
- Use Three.js for the interactive 3D world.
- React Three Fiber and Drei may be used if helpful.
- Run the interactive scene inside client components and handle browser-only APIs correctly.
- Use React and CSS for the interface overlay.
- Generate the environment, equipment, and fish procedurally. Do not require external models, paid assets, API keys, or a backend.
- Keep game simulation separate from UI rendering.
- Use delta time for movement, fish behavior, and fishing mechanics.
- Save progression, equipment, settings, and retained catches in localStorage.
- Provide all necessary project files and clear commands to install and run the game.

VISUAL DIRECTION

Create a cohesive stylized low-poly environment with atmospheric lighting.

The lake should include:
- Blue-green water with subtle animated ripples and reflections or a lightweight visual approximation.
- A shoreline with sand, earth, grass, reeds, and angular rocks.
- Birch trees and pine trees around the lake.
- A distant tree line and light atmospheric fog.
- A small wooden pier nearby.
- A bucket, tackle box, and folding stool near the fishing position.
- Warm early-morning sunlight.

Give the lake several meaningful fishing zones:
- Shallow water near reeds.
- An open-water area.
- A deeper section farther from shore.

These zones must influence the species and size of fish that can bite.

Show a fishing rod in the foreground with a handle, reel, line guides, and a flexible tip. Draw a continuous fishing line connecting the rod to the float or hooked fish.

The float must remain visible after casting. Provide a compact magnified float view when distance makes the main float difficult to read. It must reflect the actual float state.

CAMERA AND CONTROLS

Keep the player at one well-designed fishing location for the first version.

Desktop controls:
- Mouse drag: look around.
- Hold the left mouse button during aiming: charge the cast.
- Release the left mouse button: cast.
- Left mouse click during a bite: set the hook.
- Hold the left mouse button during a fight: reel in.
- Release the button during a fight: stop reeling and reduce pressure.
- Mouse wheel or visible buttons: adjust reel drag.
- Escape: pause and release camera interaction.
- A visible button: retrieve the rig when no fish is hooked.

Prevent one input from triggering multiple actions across state transitions. UI interaction must not accidentally cast or set the hook.

Include visible instructions that change according to the current fishing state. Add touch-friendly on-screen controls for the main fishing actions.

FISHING STATE MACHINE

Implement explicit states:

1. Ready
2. Charging cast
3. Casting
4. Waiting for a bite
5. Fish investigating bait
6. Strike window
7. Fighting fish
8. Catch result
9. Retrieving an empty rig

Add transitions for missed bites, escaped fish, broken line, and cancelled casts.

Only enable actions that are valid for the current state.

CASTING

The player chooses direction and casting power.

Show:
- Aiming marker on the water.
- Casting power meter.
- Estimated distance in meters.

Animate the rig following a curved trajectory and landing with a small splash and expanding ripples.

Make casting distance affect the fishing zone and bite probability. Reject casts onto land with a clear Russian message.

FISH SPECIES

Implement at least these six species:

- Карась — Crucian carp
- Плотва — Roach
- Окунь — Perch
- Лещ — Bream
- Карп — Common carp
- Щука — Northern pike

Create a distinct procedural low-poly model for each species. Differentiate body shape, proportions, fins, tail, and coloration:
- Crucian carp: compact, deep body with a bronze-gold tint.
- Roach: slim silver body with reddish fins.
- Perch: olive body, dark vertical stripes, and a noticeable dorsal fin.
- Bream: tall, flattened body with muted silver-bronze coloring.
- Carp: broad, heavy golden-brown body with small barbels.
- Pike: elongated green body, pointed head, and rear-positioned dorsal fin.

Define species data including:
- Russian and English names.
- Minimum and maximum weight.
- Typical weight distribution.
- Length derived from species and weight.
- Preferred bait.
- Preferred depth and fishing zone.
- Activity by time of day.
- Fighting strength and stamina.
- Base selling value per kilogram.
- Trophy threshold.

Generate weights using a distribution in which small and medium fish are common and large specimens are rare.

Choose the fish species and weight when it commits to the bait. Preserve that exact fish throughout the bite, fight, and result. Never reroll the fish when it is landed.

BAIT

Provide at least four bait types:
- Червь
- Опарыш
- Кукуруза
- Живец

Each bait should have different species preferences. For example:
- Worms attract crucian carp, perch, and bream.
- Maggots attract roach and bream.
- Corn favors crucian carp and carp.
- Live bait strongly favors pike and can attract larger perch.

Show a short description and suitable species for each bait.

Start the player with enough bait to enjoy several fishing attempts. Consume bait according to clearly defined rules and show the remaining quantity.

BITE LOGIC

Use a lightweight, understandable fishing simulation.

Calculate bite likelihood from:
- Bait compatibility.
- Fishing zone and depth.
- Time of day.
- Species activity.
- A modest random factor.

Use elapsed simulation time so bite rates do not depend on frame rate.

Keep waiting engaging. Under suitable conditions, bites should generally occur within roughly 8–25 seconds. Poor choices should increase waiting time without making the game feel stalled.

Animate a sequence:
1. Small float movements.
2. A few stronger dips.
3. A clear committed bite.

During the committed bite, provide a limited strike window. An early strike should scare away the fish. A late strike should allow the fish to steal the bait or escape.

Include subtle visual and optional generated audio feedback. Do not rely only on text notifications.

FIGHTING AND REELING

Implement a real interactive fight, not an automatic timer.

Track:
- Distance from the fish to the shore.
- Fish stamina.
- Line tension.
- Reel drag setting.
- Rod and line limits.
- The fish’s movement direction and bursts of speed.

Holding the reel control pulls the fish toward shore but increases tension. Releasing it reduces pressure and lets the fish recover or gain distance.

The fish should alternate between:
- Swimming across the casting direction.
- Short runs away from shore.
- Periods of lower resistance.

Fish weight and species must affect the fight. A small roach should be easy to land. A large carp or pike should require careful control.

Drag must have a meaningful tradeoff:
- Low drag reduces tension but allows the fish to take line more easily.
- High drag improves pulling force but increases the chance of breaking the line.

Show a clear tension meter with safe, warning, and critical ranges. Use sensible numeric scales and thresholds.

Allow brief critical spikes, but break the line if excessive tension persists. A continuously slack line should increase escape risk after a short grace period.

Animate the rod bending according to tension. Move the line endpoint with the actual hooked fish. Include occasional surface splashes during strong fish movements.

Land the fish only when it reaches the landing area and its stamina is sufficiently depleted.

CATCH RESULTS

After landing a fish, show a polished result panel with:
- A rotating 3D preview of the actual species.
- Species name in Russian.
- Weight in kilograms, displayed with two decimal places.
- Length in centimeters.
- Bait used.
- Catch time.
- Estimated selling value.
- “Новый рекорд!” when it exceeds the player’s previous species record.
- A trophy badge when it exceeds the species trophy threshold.

Provide two functional actions:
- “Оставить”
- “Отпустить”

Keeping the fish adds it to the keepnet. Releasing it grants experience without adding its sale value to the player’s balance.

Format values for Russian readers, for example: “2,35 кг” and “42 см”.

INVENTORY AND PROGRESSION

Include a keepnet panel displaying:
- Each retained fish and its weight.
- Total fish count.
- Total weight.
- Maximum keepnet capacity.
- Total estimated sale value.

Allow the player to sell retained fish through a clearly visible action. Credit money only once and remove sold fish from the keepnet.

Add a small working tackle shop with:
- Bait purchases.
- A stronger fishing line.
- A better rod.
- A larger keepnet.

Equipment upgrades must change actual gameplay statistics.

Show current balance, experience, and level. Award experience based on fish species, weight, and difficulty.

Store species records and catch history locally. Reloading the page should preserve progression and return the player to a safe ready state.

INTERFACE

Use a restrained fishing-game interface with readable Russian labels.

Suggested layout:
- Top left: player level, experience, and money.
- Top right: in-game time and weather.
- Bottom left: selected bait, remaining bait, rod, and line rating.
- Bottom center: context-sensitive action and instructions.
- Bottom right: casting distance, drag setting, and line tension when relevant.

Include buttons for:
- “Наживка”
- “Садок”
- “Магазин”
- “Рекорды”
- “Настройки”

Display only information relevant to the current state. Do not clutter the center of the scene.

Use an accelerated day cycle with lighting changes and species activity modifiers. Pause gameplay while menus or the pause screen are open.

Add settings for sound, mouse sensitivity, and graphics quality.

IMPLEMENTATION PRIORITIES

Build the game in this order:

1. A working lake scene, camera, rod, and float.
2. The complete casting and retrieval loop.
3. Bait selection and species-dependent bites.
4. Hook setting and the interactive fish fight.
5. Accurate catch results with species, weight, and length.
6. Keepnet, selling, equipment upgrades, and persistence.
7. Visual polish, sound, and responsive controls.

Do not substitute decorative buttons for working features. Keep the first version compact enough to implement completely.

VALIDATION

Verify that:
- The Next.js project builds successfully.
- The 3D scene loads without hydration errors.
- The player can cast, receive a bite, hook a fish, fight it, and land it.
- Fish species and weight remain consistent throughout the attempt.
- Bait and fishing zones affect which fish can bite.
- Drag and reeling influence tension and fish movement.
- Missed bites, escapes, and broken lines return to a playable state.
- Catch results display the correct species, weight, and length.
- Keeping, releasing, and selling fish work correctly.
- Purchases deduct money and apply their effects.
- Progress survives a page reload.
- Resizing the window preserves rendering and interface usability.
- Three.js resources and event listeners are cleaned up correctly.

Deliver the complete runnable Next.js project with all necessary files. Include concise setup instructions and a short explanation of the controls. Do not deliver pseudocode, unfinished mechanics, or a static visual mockup.