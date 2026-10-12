Create a polished, stylized low-poly 3D model of a fisherman holding a fishing rod using Three.js. Deliver the entire project as a single `index.html` file containing all HTML, CSS, and JavaScript. Use a CDN for Three.js and OrbitControls. Generate all geometry procedurally: no external models, textures, images, or additional local files.

VISUAL STYLE

Use an intentional low-poly art style with visible flat-shaded surfaces, clean silhouettes, and a harmonious color palette. The result should look like a carefully designed game character, with recognizable anatomy, clothing, and equipment. Avoid making the character look like a stack of unrelated primitives.

Use slightly exaggerated proportions: a relatively large head, a sturdy torso, expressive facial features, and substantial boots. Keep the character friendly, charming, and visually readable from every angle.

FISHERMAN

Create a full-body adult fisherman standing in a relaxed, believable fishing pose.

Head and face:
- An angular head with a warm skin tone, a defined jaw, cheeks, and a small protruding nose.
- Two clearly visible eyes, eyebrows, and a subtle, content expression.
- A short gray-brown beard built from several angular shapes following the cheeks and chin.
- Small ears positioned correctly on both sides.
- A muted olive fishing hat with a shaped crown and a broad brim. Add a darker hatband and one small fishing lure attached to it.

Clothing:
- A warm ochre long-sleeved shirt with sleeves rolled up near the elbows.
- An open olive fishing vest with visible thickness, separate front panels, pockets, seams, and a few small equipment details.
- Dark brown trousers with distinct hips, thighs, knees, and lower legs.
- Tall rubber fishing boots with thick soles, defined toes, and a slightly wider opening around each leg.
- A simple belt with a visible buckle.

Pose and anatomy:
- Position both feet securely on the ground, approximately shoulder-width apart, with one foot slightly forward.
- Give the knees a slight bend and lean the torso subtly toward the water.
- Turn the head toward the fishing line.
- Build arms with clear upper arms, elbows, forearms, and hands.
- Place one hand around the rod handle and the other near the reel.
- Make the hands visibly grip the equipment. The rod must not float beside the hands.
- Ensure the shoulders, elbows, wrists, hips, and knees connect naturally without obvious gaps or intersecting body parts.

FISHING ROD

Make the fishing rod a prominent, carefully constructed part of the model:
- A long, slim, tapered rod angled upward and outward toward the water.
- A dark handle with a contrasting grip and a small end cap.
- A recognizable spinning reel attached below the rod, including its housing, spool, and crank handle.
- Several small line guides distributed along the rod.
- A thin, continuous fishing line extending through the guides and down from the tip toward the water.
- A small red-and-white float resting on the water.
- A gentle bend near the rod tip, suggesting light tension.

Keep the rod proportional to the fisherman and the line readable against the background.

SMALL DISPLAY SCENE

Place the fisherman on a compact low-poly riverbank diorama:
- A small irregular patch of earth with a clearly visible edge and thickness.
- A grassy bank beneath the fisherman.
- A section of calm blue-green water in front of him.
- A few angular rocks, short grass clusters, and reeds around the shoreline.
- A small bucket beside his boots with a visible rim and handle.

Keep these environmental details secondary. The fisherman and fishing rod must remain the main focus.

LIGHTING AND PRESENTATION

Use soft, warm daylight with ambient fill and directional lighting. Enable shadows so the boots, character, bucket, and rocks feel grounded.

Use a subtle neutral background that complements the earthy clothing and blue-green water. Choose an initial three-quarter camera view that clearly shows the face, both hands, the reel, the entire rod, and the float. Keep the complete diorama inside the frame.

CONTROLS AND ANIMATION

Add OrbitControls so the viewer can rotate around the model, zoom in, and inspect it from all sides. Set a sensible orbit target and zoom limits.

Include subtle idle animation:
- Gentle breathing in the torso.
- A very slight coordinated movement of the arms and rod, keeping both hands attached to their gripping positions.
- Soft movement in the float and small expanding ripples around it.

Keep the animation restrained and natural. The fisherman should remain firmly planted on the bank.

TECHNICAL REQUIREMENTS

- Everything must be contained in one `index.html`.
- Use a consistent Three.js version for all imports.
- Use procedural geometry and solid-color materials.
- Use flat shading where appropriate.
- Organize the character into logical groups with useful pivots for animation.
- Make the canvas responsive to window resizing.
- Support high-DPI screens with a reasonable pixel-ratio limit.
- Render smoothly in a modern browser.
- Avoid unnecessary interface elements; allow the 3D scene to occupy the screen.

IMPLEMENTATION ORDER

1. Establish the character proportions and fishing pose.
2. Build the head, face, hat, clothing, hands, and boots.
3. Construct the rod and reel, aligning them precisely with the hands.
4. Add the fishing line, float, and riverbank.
5. Set up lighting, shadows, camera, and controls.
6. Add restrained animation and check the model from multiple angles.

Before finishing, check that the fisherman has a coherent silhouette, both hands grip the equipment correctly, the fishing line connects to the rod tip, both boots touch the ground, and the entire fishing rod is visible in the initial camera view.

Return only the complete code for `index.html`, without explanations, placeholders, or omitted sections.