#!/usr/bin/env node
// Build a JSON file of unique, on-topic, photo-real hero prompts for every
// article. Output: /tmp/hero-prompts.json — an array of
//   { slug, title, category, prompt, alt }
//
// Brand voice (used in every prompt):
//   - cinematic photo-realism, soft natural light, shallow DOF, 35mm look
//   - warm, calm, hopeful, never clinical, never stocky
//   - real human beings: introverted/highly sensitive children, parents,
//     teachers, classrooms, kitchens, reading corners, gardens
//   - quiet color palette (sage, dusty blue, mauve, cream, oak, warm white)
//   - 16:9 horizontal composition; subject left-of-center; copy-safe negative space right
//   - no text in the image, no logos, no watermarks
//   - diverse ages, ethnicities, family structures across the 500
//
// The script does NOT call any image API; it only writes the prompt manifest.

import { writeFileSync } from "node:fs";

const idx = await (await fetch("https://quiet-classroom.b-cdn.net/articles/index.json")).json();
console.log(`loaded ${idx.length} entries from Bunny`);

// ---------- category -> scene seeds ----------
// Each scene is a concrete, specific micro-story (not a mood word). The picker
// is keyed off slug hash so the same article always gets the same scene, but
// neighboring articles get different ones.
const SCENES = {
  "School Life": [
    "an introverted girl about 8 years old standing slightly apart from a small group of classmates in a sunlit elementary classroom, reading a paperback novel against a windowsill",
    "a quiet 10-year-old boy with a backpack walking down an empty school hallway in the morning, sunbeams angling through tall windows",
    "a thoughtful sensitive child at a wooden classroom desk, head down, sketching in a notebook while the rest of the room blurs softly in the background",
    "a teacher kneeling at eye level with a shy 7-year-old by a classroom door, both smiling gently, late-afternoon light",
    "an 11-year-old with a denim jacket sitting on the school library carpet surrounded by open picture books",
    "an introverted middle-schooler eating lunch by themselves on a low brick wall outside the cafeteria, calm not sad, golden hour",
  ],
  "After-School Recovery": [
    "a parent in a warm kitchen handing a small ceramic mug of cocoa to a tired child who has just dropped a backpack by the door",
    "a 9-year-old curled up under a soft wool blanket on a linen sofa with a hardcover book, late-afternoon honey light through gauzy curtains",
    "a mother and son sitting quietly side-by-side on a worn back-porch step, the boy still in school uniform, the mother in a soft cardigan, no one talking",
    "a child face-down on their bed, shoes still on, backpack tipped over on a rug, a sunlit window in soft focus behind",
    "a father gently brushing a daughter's hair off her forehead at the kitchen table while she rests her cheek on her arm",
    "a small child lying on the living-room floor with a cat curled against their ribs, dust motes in slanted afternoon light",
  ],
  "IEPs and 504 Plans": [
    "two parents and a school counselor seated at a round wooden conference table with a manila folder open between them, daylight from a single tall window",
    "a mother with reading glasses and a printed IEP document at a kitchen table, a cup of tea steaming beside her, evening lamplight",
    "a father holding a child's hand as they walk into a school's main office, brick exterior, autumn leaves on the path",
    "an empty conference room table set with three chairs, a folder, a pen, a paper cup of coffee, soft window light — calm before a meeting",
    "a teacher and a parent shaking hands in a school hallway, both smiling kindly, a child standing nearby holding their own folder",
    "close-up of an open binder showing tabbed dividers labeled in handwriting, a mother's hand resting on the page, warm desk lamp",
  ],
  "Sensory and Environment": [
    "a child with noise-cancelling headphones reading on a window seat with a pillow, soft afternoon light, rain on the window",
    "a small bedroom corner with a canvas reading tent strung with fairy lights, a child's silhouette visible inside",
    "a sensory-friendly classroom corner with a soft rug, low bookshelves, a beanbag, and a single child arranging smooth river stones",
    "a child running their fingers along a textured woven blanket draped over a wooden chair, focused expression",
    "a kitchen scene of a parent dimming a pendant light over a dinner table while a sensitive child shields their eyes",
    "a quiet bathroom with a child in pajamas brushing teeth, mirror reflecting a parent waiting in the doorway with a towel",
  ],
  "Parents and Family": [
    "a parent and a quiet child sitting cross-legged on a living-room rug doing a 1000-piece puzzle together, lamps on, evening",
    "a multi-generational family of three around a kitchen island making sandwiches together, the introverted child carefully cutting bread",
    "a single mother with her son on a porch swing at dusk, both reading their own books, a string of warm lights overhead",
    "a father carrying his sleeping 6-year-old up a wooden staircase, hallway light spilling from below",
    "two parents on a small couch in a softly lit living room, one with arm around the other, a child napping across both their laps",
    "a grandmother and grandchild side by side in matching wooden rocking chairs on a wraparound porch, knitting",
  ],
  "Growing Up": [
    "a 13-year-old in a denim jacket leaning against a locker, journal in hand, hallway light from a tall window",
    "a teenage girl writing in a notebook on a fire escape at golden hour, city soft-focused behind her",
    "a young teen tying running shoes on the front porch, dewy grass, early morning light",
    "a quiet adolescent boy with headphones in the corner of a busy school bus, looking out the window, reflective",
    "a 12-year-old girl in a small bedroom, walls covered with taped Polaroids and pressed flowers, sitting on the bed cross-legged with a sketchpad",
    "a parent and a teenager doing dishes side by side at a kitchen sink, talking quietly, evening warm light",
  ],
  "Social and Friendships": [
    "two children — one outgoing, one quiet — building a fort out of couch cushions and a thrifted quilt in a sunlit living room",
    "a child and a friend walking shoulder to shoulder along a tree-lined sidewalk after school, leaves on the ground, autumn light",
    "a birthday party scene from the perspective of a shy child watching from the kitchen doorway, candles being lit in the next room",
    "two best friends drawing with sidewalk chalk on a driveway, late-spring blossoms above them",
    "a quiet child sharing half a peanut-butter sandwich with one classmate on a wooden picnic bench at lunch",
    "a small group of four kids around a board game on a coffee table, the introvert in the group laughing for the first time",
  ],
  "Introversion vs. Anxiety": [
    "a 9-year-old sitting on the bottom step of a staircase holding their own knees, mother's hand visible on their shoulder, calm not frightened",
    "a child at a kitchen window pressing a palm to the glass, eyes thoughtful, gentle rain outside",
    "a therapist's office scene: a soft chair, a child curled in it with a stuffed animal, the therapist seated on the floor at eye level",
    "a parent holding a child's drawing of a stick-figure family up to the kitchen light, both their backs to the camera",
    "a child taking a single deep breath in a school bathroom, hand on the porcelain sink, eyes closed",
    "a quiet child outside on a swing alone but content, head tilted up to a wide blue sky",
  ],
  "Homework and Learning": [
    "a 10-year-old at a wooden desk under a warm desk lamp, pencil mid-letter on a math worksheet, mug of cocoa beside",
    "a parent leaning over a child's shoulder, finger pointing at a word in a chapter book, both smiling slightly",
    "an open laptop and a stack of library books on a kitchen table, a child's hands on the keyboard, soft kitchen light",
    "a child building a science-fair volcano on a kitchen island, food coloring in jars, parent in the background pouring coffee",
    "two children sitting on a living-room rug with workbooks open, the older one helping the younger, golden hour through the curtains",
    "a quiet morning study scene: a child reading aloud to a sleeping dog at their feet, oversized cable-knit cardigan",
  ],
  "Herbs and Holistic": [
    "a wooden kitchen table with sprigs of fresh chamomile, lavender, and lemon balm beside an open recipe notebook, morning light",
    "a parent's hands tying string around a small bundle of dried herbs hanging in a sunny window",
    "a steaming cup of herbal tea on a wooden side table next to an open book and a child's small slipper",
    "a glass jar of dried passionflower being scooped with a tiny brass spoon, antique apothecary look, warm tungsten light",
    "a mother stirring a small pot of bedtime tonic on a vintage gas stove, child in pajamas watching from the counter",
    "a windowsill herb garden in terracotta pots, late-spring morning light, soft focus on a child's hand reaching for a leaf",
  ],
};
const FALLBACK = SCENES["School Life"];

// ---------- style/spec appended to every prompt ----------
const STYLE_TAIL = [
  "shot on Canon EOS R5 with 35mm f/1.4 lens",
  "soft natural daylight, gentle fill, no harsh shadows",
  "shallow depth of field, photographic realism, no illustration, no painting, no cartoon",
  "warm color grade, muted sage and dusty-blue palette with cream highlights",
  "16:9 horizontal composition, subject placed slightly left, generous copy-safe negative space on the right",
  "no text in the image, no logos, no watermark, no captions",
  "calm, tender, hopeful editorial tone — NOT stocky, NOT corporate, NOT clinical",
  "diverse, real-looking people of varied ethnicity and family structure",
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function sceneFor(slug, category) {
  const pool = SCENES[category] || FALLBACK;
  return pool[hash(slug) % pool.length];
}

// Pull the modifier (everything after "--") to differentiate the 17 variants
// per base topic so neighboring articles never get the same image.
function variantSeed(slug) {
  const tail = slug.split("--")[1] || "";
  if (!tail) return "";
  const map = {
    "for-fifth-grade-parents":          "subject child is ~10 years old, 5th-grade context",
    "for-first-grade-parents":          "subject child is ~6 years old, 1st-grade context",
    "for-middle-school-parents":        "subject child is 11-13 years old, middle-school context",
    "for-high-school-parents":          "subject child is 14-17 years old, high-school context",
    "for-homeschoolers":                "setting is a warm homeschool corner of a family home, not a school",
    "for-charter-and-magnet-families":  "setting is a small specialty school with hand-painted wall art",
    "for-a-kid-who-masks-at-school":    "subject child wears a small relieved smile only the parent can see",
    "the-morning-version-before-school":"early morning light, breakfast table, lunchbox visible",
    "the-evening-version-after-school": "evening lamp light, dinner-prep kitchen, backpack on the floor",
    "the-weekend-version-recovery-days":"weekend pajamas, slow Saturday morning, no school clothes",
    "during-a-transition-year":         "moving boxes partly unpacked in the background, suggesting a new start",
    "after-a-discipline-referral":      "a parent and child sit close on a couch with a printed letter on the coffee table",
    "before-a-parent-teacher-conference":"a parent at home reviewing notes the night before a meeting",
    "what-teachers-wish-you-knew":      "perspective is a teacher's eye view across a classroom toward a single quiet child",
    "what-the-iep-team-will-not-tell-you":"close-up of two adult hands across a conference table, one offering a tissue box",
    "what-the-pediatrician-usually-misses":"a pediatrician's office: a child on the exam table, parent leaning in protectively",
  };
  return map[tail] || `specific angle: ${tail.replace(/-/g, " ")}`;
}

const out = [];
for (const e of idx) {
  const scene = sceneFor(e.slug, e.category);
  const variant = variantSeed(e.slug);
  const cleanTitle = (e.title || "").split(":")[0].trim();
  const prompt = [
    "Photograph for an editorial parenting magazine.",
    `Subject of the article: "${cleanTitle}".`,
    `Scene: ${scene}.`,
    variant ? `Specifics: ${variant}.` : "",
    ...STYLE_TAIL,
  ].filter(Boolean).join(" ");
  const alt = `${cleanTitle} — ${scene.split(",")[0]}.`.replace(/\s+/g, " ").slice(0, 180);
  out.push({ slug: e.slug, title: e.title, category: e.category, prompt, alt });
}

writeFileSync("/tmp/hero-prompts.json", JSON.stringify(out, null, 2));
console.log(`wrote ${out.length} prompts to /tmp/hero-prompts.json`);
console.log("\nfirst 3 samples:");
for (const s of out.slice(0, 3)) {
  console.log("\n---");
  console.log("slug:  ", s.slug);
  console.log("alt:   ", s.alt);
  console.log("prompt:", s.prompt.slice(0, 260) + "...");
}
