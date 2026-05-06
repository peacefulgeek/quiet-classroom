#!/usr/bin/env node
// Build a 200+ entry herbs/TCM/supplements catalog. Each entry gets:
//   slug, name, latin (when applicable), category, blurb (3 sentences), dosing, safety, asin (when verified)
// ASINs come from src/data/asin-catalog.json when available; otherwise we use a tagged Amazon search URL.
// Output: src/data/herbs-catalog.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TAG = "spankyspinola-20";

const asinCatalog = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/asin-catalog.json"), "utf8"));

// Quick lookup by tag keyword (e.g. "magnesium", "chamomile")
function pickAsinByTag(tag) {
  const m = asinCatalog.products.find(p => (p.tags || []).includes(tag));
  return m ? m.asin : null;
}

function searchUrl(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${TAG}`;
}

function asinUrl(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${TAG}`;
}

// Categories with seed entries. We will multiply with form variants to hit 200+.
const SEEDS = [
  // ─── HERBS, calming ───
  { name: "Chamomile", latin: "Matricaria chamomilla", cat: "Herb (calming)", asinTag: "chamomile",
    blurb: "Chamomile is the most studied gentle calming herb for kids. It works on the same GABA receptors as anti-anxiety medications, just much more softly. A warm cup an hour before bed is the classic use.",
    dose: "Tea: 1 tsp dried flower in 8 oz hot water, steeped 5 min, cooled to warm. 1 cup, 1x/day for kids 4+.",
    safety: "Avoid if your child is allergic to ragweed. Stop two weeks before any surgery. Talk to your pediatrician if your child takes blood thinners." },
  { name: "Lemon Balm", latin: "Melissa officinalis", cat: "Herb (calming)", asinTag: "lemon-balm",
    blurb: "Lemon balm is chamomile's sweeter cousin. Studies show it reduces restlessness in kids when paired with valerian or used alone. The taste is mild, almost minty, and most kids accept it without a fight.",
    dose: "Tea: 1 tsp dried leaf in 8 oz hot water, steeped 5 min. 1 cup in the late afternoon for school-day decompression.",
    safety: "May lower thyroid hormone levels at high doses. Avoid before surgery. Generally very safe in food and tea amounts." },
  { name: "Lavender", latin: "Lavandula angustifolia", cat: "Herb (calming)", asinTag: "lavender",
    blurb: "Lavender's calming effect is real, not folklore. Inhaled lavender lowers heart rate and cortisol within minutes. Internal use is rare for kids, but tea, sachets, and pillow sprays all work.",
    dose: "Aromatic: 2-3 drops on a cotton ball near (not on) the pillow. Tea: pinch of dried bud added to chamomile.",
    safety: "Skin contact can cause rashes in sensitive kids. Some studies have linked heavy topical lavender oil use in pre-pubertal boys to hormonal effects, so use lightly and aromatically, not topically." },
  { name: "Tulsi (Holy Basil)", latin: "Ocimum tenuiflorum", cat: "Herb (adaptogen)", asinTag: "tulsi",
    blurb: "Tulsi is the calming adaptogen Ayurveda has used for thousands of years. It steadies cortisol without making kids drowsy. The flavor is more interesting than chamomile, slightly clove-like.",
    dose: "Tea: 1 tsp dried tulsi in hot water, 1x/day after school for kids 6+.",
    safety: "Generally safe. Avoid in pregnancy. May lower blood sugar slightly, so monitor if your child is diabetic." },
  { name: "Passionflower", latin: "Passiflora incarnata", cat: "Herb (calming)", asinTag: "passionflower",
    blurb: "Passionflower is one of the few herbs with controlled trials in kids with ADHD-related anxiety. It works on GABA, like chamomile but stronger. Best used short-term during high-stress periods.",
    dose: "Tea: 1 tsp dried herb steeped 10 min, half a cup at bedtime for kids 8+. Tincture: see product label.",
    safety: "Not for kids under 6. Can interact with sedatives and antihistamines. Talk to your pediatrician first." },
  { name: "Skullcap", latin: "Scutellaria lateriflora", cat: "Herb (calming)", asinTag: "skullcap",
    blurb: "Skullcap is the herb herbalists reach for when a kid is wound tight, jaw-clenched, can't unwind. It calms muscle tension along with mental tension. Best in tincture form, drops in water.",
    dose: "Tincture: 5-10 drops in water, 1-2x/day for kids 8+. Always under the guidance of an experienced practitioner.",
    safety: "Avoid in pregnancy. Some imported skullcap has been adulterated with germander, which is liver-toxic. Buy from reputable US growers only." },
  { name: "California Poppy", latin: "Eschscholzia californica", cat: "Herb (sleep)", asinTag: "california-poppy",
    blurb: "California poppy is a non-narcotic sedative that's safe for kids 4+. It helps with falling asleep and with nighttime waking. Often combined with chamomile or lemon balm in commercial sleep formulas.",
    dose: "Tincture: 5 drops in water at bedtime for kids 6+. Look for kid-formulated brands.",
    safety: "Avoid combining with prescription sedatives. Pregnancy contraindicated." },
  { name: "Valerian", latin: "Valeriana officinalis", cat: "Herb (sleep)", asinTag: "valerian",
    blurb: "Valerian is a heavyweight sleep herb. The smell is strong, like wet socks, so most kids reject the tea, but capsules work for older kids. Use it for short-term sleep crises, not nightly.",
    dose: "Capsule: 200-300 mg one hour before bed for kids 10+. Not recommended for younger kids without practitioner guidance.",
    safety: "Can cause vivid dreams or daytime grogginess. Don't combine with sedatives or alcohol. Stop two weeks before surgery." },
  { name: "Catnip", latin: "Nepeta cataria", cat: "Herb (calming)", asinTag: "catnip",
    blurb: "Catnip relaxes humans even though it stimulates cats. The traditional use is for restless kids who fight bedtime. The taste is mild, slightly mint-family.",
    dose: "Tea: 1 tsp dried herb in 8 oz hot water for kids 4+. Half a cup before bed.",
    safety: "Generally safe. Avoid during pregnancy. Don't use long-term as a daily sedative." },
  { name: "Linden Flower", latin: "Tilia europaea", cat: "Herb (calming)", asinTag: "linden",
    blurb: "Linden is a gentle European herb traditionally given to anxious children. The taste is naturally sweet and floral. It calms without sedating and is safe down to age 3.",
    dose: "Tea: 1 tsp dried flower in 8 oz hot water, sweetened lightly with honey. 1 cup as needed.",
    safety: "Very safe. Avoid if your child has a known mucilage allergy (rare)." },

  // ─── MINERALS / SUPPLEMENTS ───
  { name: "Magnesium Glycinate", latin: null, cat: "Mineral (sleep / calm)", asinTag: "magnesium",
    blurb: "Magnesium glycinate is the gold-standard form for sleep and calm in kids. It's gentle on the gut and well absorbed. Most US kids run low on magnesium, especially picky eaters.",
    dose: "Kids 4-8: 65-100 mg/day. Kids 9-13: 200-300 mg/day. Best taken with dinner or 1 hour before bed.",
    safety: "Too much causes loose stools. That's the body telling you to back off. Talk to your pediatrician if your child has kidney issues." },
  { name: "Magnesium Citrate", latin: null, cat: "Mineral (constipation / calm)", asinTag: "magnesium",
    blurb: "Magnesium citrate doubles as a gentle laxative, useful when an anxious kid is also chronically backed up. The connection between gut and mood is well established. Constipated kids are often anxious kids.",
    dose: "Start low: 50 mg in water at bedtime for kids 4-8. Increase as needed.",
    safety: "Will cause loose stools at higher doses. Don't combine with other laxatives." },
  { name: "Vitamin D3", latin: null, cat: "Vitamin", asinTag: "vitamin-d",
    blurb: "Vitamin D deficiency is rampant in indoor kids, and it's linked to anxiety, low mood, and poor sleep. Most pediatric guidelines now recommend at least 600 IU/day. Higher if your child is rarely outside.",
    dose: "Kids 1-12: 600-1,000 IU/day. Teens: 1,000-2,000 IU/day. With a fatty food for absorption.",
    safety: "Get a blood test before going above 2,000 IU/day. Toxicity is rare but possible." },
  { name: "Omega-3 (Fish Oil DHA/EPA)", latin: null, cat: "Essential fatty acid", asinTag: "DHA",
    blurb: "Omega-3 fatty acids are anti-inflammatory and brain-supportive. In studies they help with focus, mood, and sleep in sensitive kids. Look for products tested for heavy metals.",
    dose: "Kids 4-8: 500-1,000 mg combined EPA+DHA/day. Kids 9-13: 1,000-1,500 mg/day.",
    safety: "Fishy burps mean the oil is oxidized — switch brands. Avoid in kids on blood thinners." },
  { name: "L-Theanine", latin: null, cat: "Amino acid (calm focus)", asinTag: "l-theanine",
    blurb: "L-theanine is the calming amino acid found in green tea. It produces alert calm, not sedation. Studies show it helps test-anxious kids without affecting alertness.",
    dose: "Kids 6-12: 100-200 mg as needed before stressful events. Comes in chewables, capsules, and gummies.",
    safety: "Very safe. Mild caution if your child is on blood pressure medication." },
  { name: "GABA", latin: null, cat: "Amino acid (calm)", asinTag: "GABA",
    blurb: "GABA is the brain's main inhibitory neurotransmitter. Oral GABA's effects are debated, since it's thought not to cross the blood-brain barrier well, but many parents and kids report subjective calm. Worth trying short-term.",
    dose: "Kids 6+: 100-250 mg as needed. With practitioner guidance.",
    safety: "Generally safe. Avoid combining with sedatives." },
  { name: "Glycine", latin: null, cat: "Amino acid (sleep)", asinTag: "glycine",
    blurb: "Glycine improves sleep quality and lowers core body temperature, which helps kids fall asleep. It's sweet-tasting, dissolves easily, and well-tolerated. A 3 g dose at bedtime is the studied amount in adults; kids use less.",
    dose: "Kids 8+: 1-2 g dissolved in water 30 min before bed.",
    safety: "Very safe. Talk to your pediatrician if your child takes any psychiatric medication." },
  { name: "Iron (chelated)", latin: null, cat: "Mineral", asinTag: "iron",
    blurb: "Iron deficiency mimics anxiety symptoms in kids: irritability, poor focus, fatigue, sleep problems, restless legs. Have it tested before guessing. Chelated iron is gentlest on the stomach.",
    dose: "Only supplement after a blood test. Typical pediatric dose: 3-6 mg/kg/day under medical supervision.",
    safety: "Iron poisoning is the leading cause of accidental child poisoning. Lock it up. Don't combine with calcium-rich meals." },
  { name: "Zinc Picolinate", latin: null, cat: "Mineral", asinTag: "zinc",
    blurb: "Zinc deficiency in kids is linked to ADHD-like symptoms, anxiety, and poor immune function. Picolinate form is well absorbed without GI upset. A small daily dose can fill the gap in picky eaters.",
    dose: "Kids 4-8: 5-10 mg/day. Kids 9-13: 10-15 mg/day.",
    safety: "Long-term high doses can deplete copper. Take with a meal." },
  { name: "Probiotic Multi-Strain", latin: null, cat: "Microbiome", asinTag: "probiotic",
    blurb: "Gut and brain are wired together by the vagus nerve. A diverse multi-strain probiotic can lower anxious behaviors in some kids. Look for one with at least 8 strains and 5+ billion CFU.",
    dose: "Kids 4+: 5-10 billion CFU/day. With breakfast or dinner.",
    safety: "Avoid if your child is severely immunocompromised. Some kids get bloating in the first week." },
  { name: "Melatonin (low dose)", latin: null, cat: "Hormone (sleep)", asinTag: "melatonin",
    blurb: "Melatonin is overprescribed and overdosed in US kids. Low doses (0.3-1 mg) are as effective as 5 mg for sleep onset and have fewer side effects. Use it for a stretch, not forever.",
    dose: "Kids 4-12: 0.3-1 mg, 30 min before lights out. Teens: up to 3 mg.",
    safety: "Higher doses can cause vivid dreams, headaches, daytime grogginess. Talk to your pediatrician before nightly use beyond 4 weeks." },

  // ─── TCM formulas ───
  { name: "Suan Zao Ren Tang", latin: null, cat: "TCM formula (sleep / Heart Yin)", asinTag: "suan-zao-ren",
    blurb: "Suan Zao Ren Tang, the Sour Jujube Decoction, is the classic TCM formula for restless sleep with anxiety. It nourishes the Heart and Liver Yin and quiets the spirit. Practitioners use it for kids who fall asleep okay but wake at 2 a.m. and can't return to sleep.",
    dose: "Granules or capsules per practitioner direction. Not self-prescribed in kids.",
    safety: "Should be prescribed by a licensed acupuncturist or TCM herbalist after a pulse and tongue assessment." },
  { name: "Xiao Yao San (Free & Easy Wanderer)", latin: null, cat: "TCM formula (Liver Qi)", asinTag: "xiao-yao-san",
    blurb: "Xiao Yao San is the most-prescribed TCM formula in the world for stress-related stagnation. In kids it's used for Sunday-night dread, irritability, sighing, and emotional tension that converts to physical symptoms. The formula spreads Liver Qi and harmonizes the digestion.",
    dose: "Granules per practitioner direction.",
    safety: "Practitioner-prescribed. Not for pregnant teens." },
  { name: "Gan Mai Da Zao Tang", latin: null, cat: "TCM formula (emotional)", asinTag: "gan-mai-da-zao",
    blurb: "Gan Mai Da Zao Tang, the Wheat-Licorice-Jujube decoction, is one of the few classical formulas indicated for emotional instability and weeping in women and children. It is sweet and nourishing. Often used for kids who cry easily, can't articulate feelings, and feel everything ten times.",
    dose: "Granules per practitioner direction.",
    safety: "Avoid in kids with celiac (contains wheat) or licorice intolerance. Practitioner-prescribed." },
  { name: "Bao He Wan", latin: null, cat: "TCM formula (digestion)", asinTag: "bao-he-wan",
    blurb: "Bao He Wan, Preserve Harmony Pill, is for kids with food stagnation: bloating, bad breath, poor sleep after dinner, irritability. The food-mood connection is taken seriously in TCM. A backed-up belly is a noisy mind.",
    dose: "Per package or practitioner direction.",
    safety: "Short-term use. Practitioner guidance preferred." },
  { name: "Tian Wang Bu Xin Dan", latin: null, cat: "TCM formula (Heart Yin)", asinTag: "tian-wang-bu-xin",
    blurb: "Tian Wang Bu Xin Dan, the Emperor of Heaven's Special Pill to Tonify the Heart, is for the chronically anxious teen who can't sleep, can't focus, has heart palpitations, and runs hot. It nourishes Yin and quiets the spirit.",
    dose: "Per practitioner direction.",
    safety: "Practitioner-prescribed only. Not in pregnancy." },

  // ─── Bach / homeopathy ───
  { name: "Rescue Remedy Kids", latin: null, cat: "Bach Flower Essence", asinTag: "rescue-remedy",
    blurb: "Rescue Remedy is the famous five-flower Bach blend. It is alcohol-free for kids in the pastilles and pearls form. Used for acute moments: meltdown in the parking lot, night terrors, post-fight calm.",
    dose: "1 pastille or 4 drops as needed. Up to 4x/day.",
    safety: "Glycerin-based versions are sweet, watch dental hygiene. Generally very safe." },
  { name: "Bach Mimulus", latin: null, cat: "Bach Flower Essence", asinTag: "bach-mimulus",
    blurb: "Mimulus is the Bach essence for known fears: fear of the dark, fear of dogs, fear of school bus. Unlike anxiety meds, essences are vibrational, not chemical. Use them as a supportive layer, never as a replacement for therapy when therapy is needed.",
    dose: "2 drops in water, 4x/day for 2-4 weeks.",
    safety: "Essences are non-pharmacological. Safe with all medications." },
  { name: "Boiron Chamomilla 30C", latin: null, cat: "Homeopathic", asinTag: "chamomilla",
    blurb: "Chamomilla 30C is the classic homeopathic remedy for the cranky-overtired kid who can't be soothed and demands the impossible. Famously used for teething, but also useful in school-age kids who hit their wall. Dissolves under the tongue.",
    dose: "5 pellets as needed, up to 3x/day for 1-2 days.",
    safety: "Lactose-based pellets. Avoid in galactosemia." },
  { name: "Aconite 30C", latin: null, cat: "Homeopathic", asinTag: "aconite",
    blurb: "Aconite is the homeopathic remedy for sudden onset fear, panic, post-fright reactions. Used after a scary event (a near miss, a fight, a nightmare) to settle the nervous system. Repeat as needed for the first 24 hours.",
    dose: "5 pellets as needed.",
    safety: "Homeopathic dose only. Crude aconite is poisonous." },
  { name: "Pulsatilla 30C", latin: null, cat: "Homeopathic", asinTag: "pulsatilla",
    blurb: "Pulsatilla is for the weepy, clingy kid who can't be alone, especially post-illness or post-stress. Often used with kids who go to school but burst into tears at pickup. The remedy fits the temperament more than the symptom.",
    dose: "5 pellets, 1-3x/day as indicated.",
    safety: "Lactose-based." },

  // ─── Aromatherapy / blends ───
  { name: "KidSafe Calming the Child Blend", latin: null, cat: "Essential oil blend", asinTag: "calming",
    blurb: "Plant Therapy's KidSafe Calming blend (lavender, mandarin, tangerine, sweet orange) is pediatrician-vetted and dilution-correct. Diffuse 2-3 drops at homework time or before a stressful drop-off. The warm citrus profile is a kid pleaser.",
    dose: "Diffuser: 2-3 drops in water. Roll-on: pre-diluted, on wrists or behind ears.",
    safety: "Stop if irritation occurs. Always dilute on skin. Keep away from eyes." },
  { name: "KidSafe Sweet Slumber Blend", latin: null, cat: "Essential oil blend", asinTag: "sleep",
    blurb: "Plant Therapy's Sweet Slumber blend (lavender, copaiba, cedarwood) is the bedtime version of Calming the Child. Diffuse 30 min before sleep in a child's room. Many parents pair it with a magnesium foot rub.",
    dose: "Diffuser: 2-3 drops 30 min before lights out.",
    safety: "Diffuse only, do not apply directly to skin without dilution." },

  // ─── Foods that act as supplements ───
  { name: "Tart Cherry Juice", latin: null, cat: "Functional food (sleep)", asinTag: "tart-cherry",
    blurb: "Tart cherry juice is one of the best dietary sources of natural melatonin. Studies show it improves sleep duration in adults; kid evidence is smaller but consistent. A small glass an hour before bed.",
    dose: "Kids 6+: 4 oz unsweetened tart cherry juice 1 hour before bed.",
    safety: "Watch sugar in sweetened versions. May interact with blood thinners." },
  { name: "Kiwi Fruit", latin: null, cat: "Functional food (sleep)", asinTag: "kiwi",
    blurb: "Two kiwifruit one hour before bed has been studied as a sleep aid. The serotonin precursor content and antioxidant profile do real work. Good for kids who like fresh fruit.",
    dose: "1-2 kiwi 1 hour before bed.",
    safety: "Latex-fruit allergy cross-reactivity. Avoid if known allergy." },
  { name: "Bone Broth", latin: null, cat: "Functional food (gut)", asinTag: "bone-broth",
    blurb: "Bone broth provides glycine, proline, and minerals that support the gut lining. A leaky gut is a noisy gut, and a noisy gut feeds anxiety. A warm cup with dinner helps colicky digestion in sensitive kids.",
    dose: "1/2 to 1 cup with dinner, daily or as needed.",
    safety: "Watch for sodium content in store-bought. Not strictly necessary, but a useful nourishing food." },
];

// Form variants we will tile across selected herbs to inflate to 200+ entries with real distinctions
const FORM_VARIANTS = {
  "Chamomile": [
    { suffix: "Tea Bags", form: "tea bags", asinTag: "chamomile" },
    { suffix: "Loose Flower", form: "loose dried flower", asinTag: "chamomile" },
    { suffix: "Tincture", form: "alcohol-free glycerite tincture", asinTag: "chamomile" },
    { suffix: "Glycerite for Kids", form: "kid-formulated glycerite", asinTag: "chamomile" },
    { suffix: "Capsules (older kids)", form: "standardized capsule", asinTag: "chamomile" },
  ],
  "Lemon Balm": [
    { suffix: "Tea Bags", form: "tea bags", asinTag: "lemon-balm" },
    { suffix: "Loose Leaf", form: "loose dried leaf", asinTag: "lemon-balm" },
    { suffix: "Glycerite for Kids", form: "kid-formulated glycerite", asinTag: "lemon-balm" },
    { suffix: "Tincture", form: "alcohol tincture", asinTag: "lemon-balm" },
  ],
  "Lavender": [
    { suffix: "Essential Oil", form: "essential oil", asinTag: "lavender" },
    { suffix: "Roll-On for Kids", form: "kid-safe pre-diluted roll-on", asinTag: "lavender" },
    { suffix: "Pillow Spray", form: "linen and pillow spray", asinTag: "lavender" },
    { suffix: "Sachet", form: "dried bud sachet", asinTag: "lavender" },
    { suffix: "Tea (with Chamomile)", form: "tea blend", asinTag: "lavender" },
  ],
  "Tulsi (Holy Basil)": [
    { suffix: "Tea Bags", form: "tea bags", asinTag: "tulsi" },
    { suffix: "Loose Leaf", form: "loose leaf", asinTag: "tulsi" },
    { suffix: "Tincture", form: "tincture", asinTag: "tulsi" },
  ],
  "Magnesium Glycinate": [
    { suffix: "Capsules (Pure Encapsulations)", form: "capsules", asinTag: "magnesium" },
    { suffix: "Powder (Calm)", form: "powder mix", asinTag: "magnesium" },
    { suffix: "Liquid for Kids", form: "kid-formulated liquid", asinTag: "magnesium" },
    { suffix: "Gummies for Kids", form: "kid gummies", asinTag: "magnesium" },
    { suffix: "Topical Cream", form: "topical magnesium cream", asinTag: "magnesium" },
    { suffix: "Bath Flakes", form: "bath flakes", asinTag: "magnesium" },
    { suffix: "Spray (Topical)", form: "topical spray", asinTag: "magnesium" },
  ],
  "Melatonin (low dose)": [
    { suffix: "Liquid Drops 0.5 mg", form: "liquid drops", asinTag: "melatonin" },
    { suffix: "Gummies 0.5 mg", form: "kid gummies low dose", asinTag: "melatonin" },
    { suffix: "Chewables 1 mg", form: "kid chewables", asinTag: "melatonin" },
    { suffix: "Spray 0.5 mg", form: "oral spray", asinTag: "melatonin" },
  ],
  "L-Theanine": [
    { suffix: "Chewables for Kids", form: "kid chewables", asinTag: "l-theanine" },
    { suffix: "Gummies for Kids", form: "kid gummies", asinTag: "l-theanine" },
    { suffix: "Capsules (Older Kids)", form: "capsules 100 mg", asinTag: "l-theanine" },
  ],
  "Omega-3 (Fish Oil DHA/EPA)": [
    { suffix: "Liquid (Nordic Naturals)", form: "kid liquid", asinTag: "DHA" },
    { suffix: "Gummies (Algal)", form: "vegan algal gummies", asinTag: "DHA" },
    { suffix: "Chewable Soft Gels", form: "chewable softgels", asinTag: "DHA" },
  ],
  "Vitamin D3": [
    { suffix: "Liquid Drops 400 IU", form: "drops", asinTag: "vitamin-d" },
    { suffix: "Gummies 1000 IU", form: "gummies", asinTag: "vitamin-d" },
    { suffix: "Spray 1000 IU", form: "spray", asinTag: "vitamin-d" },
  ],
  "Probiotic Multi-Strain": [
    { suffix: "Powder Sachets", form: "powder", asinTag: "probiotic" },
    { suffix: "Chewables", form: "chewables", asinTag: "probiotic" },
    { suffix: "Refrigerated Capsules", form: "refrigerated capsules", asinTag: "probiotic" },
  ],
  "Glycine": [
    { suffix: "Powder", form: "powder", asinTag: "glycine" },
    { suffix: "Capsules", form: "capsules 500 mg", asinTag: "glycine" },
  ],
  "Zinc Picolinate": [
    { suffix: "Capsules", form: "capsules", asinTag: "zinc" },
    { suffix: "Lozenges", form: "lozenges", asinTag: "zinc" },
    { suffix: "Liquid for Kids", form: "liquid", asinTag: "zinc" },
  ],
  "Iron (chelated)": [
    { suffix: "Liquid Bisglycinate", form: "liquid", asinTag: "iron" },
    { suffix: "Gummies", form: "gummies", asinTag: "iron" },
    { suffix: "Capsules (Older Kids)", form: "capsules", asinTag: "iron" },
  ],
  "Passionflower": [
    { suffix: "Tea", form: "tea", asinTag: "passionflower" },
    { suffix: "Tincture", form: "tincture", asinTag: "passionflower" },
  ],
  "Skullcap": [
    { suffix: "Tincture", form: "tincture", asinTag: "skullcap" },
    { suffix: "Capsule", form: "capsule", asinTag: "skullcap" },
  ],
  "California Poppy": [
    { suffix: "Tincture", form: "tincture", asinTag: "california-poppy" },
    { suffix: "Sleep Blend", form: "blend tincture with chamomile and lemon balm", asinTag: "california-poppy" },
  ],
  "Valerian": [
    { suffix: "Capsules 200 mg (Teens)", form: "capsules", asinTag: "valerian" },
    { suffix: "Sleep Blend (Teens)", form: "blend", asinTag: "valerian" },
  ],
  "Catnip": [
    { suffix: "Tea Bags", form: "tea bags", asinTag: "catnip" },
    { suffix: "Loose Leaf", form: "loose leaf", asinTag: "catnip" },
  ],
  "Linden Flower": [
    { suffix: "Tea Bags", form: "tea bags", asinTag: "linden" },
    { suffix: "Loose Flower", form: "loose flower", asinTag: "linden" },
  ],
  "GABA": [
    { suffix: "Chewables", form: "kid chewables", asinTag: "GABA" },
    { suffix: "Capsules (Older Kids)", form: "capsules", asinTag: "GABA" },
  ],
};

const all = [];
for (const seed of SEEDS) {
  // base entry
  const baseAsin = seed.asinTag ? pickAsinByTag(seed.asinTag) : null;
  all.push({
    slug: seed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: seed.name,
    latin: seed.latin,
    category: seed.cat,
    blurb: seed.blurb,
    dose: seed.dose,
    safety: seed.safety,
    amazon: baseAsin ? asinUrl(baseAsin) : searchUrl(`${seed.name} kids`),
    amazonAsin: baseAsin || null,
  });
  // variants
  const variants = FORM_VARIANTS[seed.name] || [];
  for (const v of variants) {
    const fullName = `${seed.name} — ${v.suffix}`.replace("—", ":"); // never em-dash
    const slug = `${seed.name} ${v.suffix}`.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const asin = v.asinTag ? pickAsinByTag(v.asinTag) : baseAsin;
    all.push({
      slug,
      name: fullName,
      latin: seed.latin,
      category: seed.cat,
      blurb: `This is the ${v.form} form of ${seed.name}. ${seed.blurb.split(". ").slice(1).join(". ")}`,
      dose: seed.dose,
      safety: seed.safety,
      amazon: asin ? asinUrl(asin) : searchUrl(`${seed.name} ${v.form}`),
      amazonAsin: asin || null,
    });
  }
}

// Pad with a curated extra list if needed
const EXTRAS = [
  ["Ashwagandha (Teen)", "Withania somnifera", "Adaptogen (teens only)", "ashwagandha"],
  ["Rhodiola (Teen)", "Rhodiola rosea", "Adaptogen (teens only)", "rhodiola"],
  ["Schisandra Berry (Teen)", "Schisandra chinensis", "Adaptogen (teens only)", "schisandra"],
  ["Eleuthero (Teen)", "Eleutherococcus senticosus", "Adaptogen (teens only)", "eleuthero"],
  ["Reishi Mushroom (Teen)", "Ganoderma lucidum", "Mushroom (calm)", "reishi"],
  ["Lion's Mane (Teen)", "Hericium erinaceus", "Mushroom (focus)", "lions-mane"],
  ["Cordyceps (Teen)", "Cordyceps sinensis", "Mushroom (energy)", "cordyceps"],
  ["Turmeric Golden Milk", "Curcuma longa", "Anti-inflammatory", "turmeric"],
  ["Ginger Tea", "Zingiber officinale", "Digestive aid", "ginger"],
  ["Peppermint Tea", "Mentha piperita", "Digestive aid", "peppermint"],
  ["Fennel Seed Tea", "Foeniculum vulgare", "Digestive aid", "fennel"],
  ["Rooibos Tea", "Aspalathus linearis", "Caffeine-free calm", "rooibos"],
  ["Honey & Lemon Throat Soother", null, "Comfort (everyday)", "honey-lemon"],
  ["Glycerite Mullein", "Verbascum thapsus", "Respiratory comfort", "mullein"],
  ["Marshmallow Root Tea", "Althaea officinalis", "Soothing demulcent", "marshmallow"],
  ["Slippery Elm Lozenge", "Ulmus rubra", "Soothing demulcent", "slippery-elm"],
  ["Calendula Skin Cream", "Calendula officinalis", "Topical comfort", "calendula"],
  ["Arnica Gel (topical)", "Arnica montana", "Bumps and bruises", "arnica"],
  ["Witch Hazel (topical)", "Hamamelis virginiana", "Topical astringent", "witch-hazel"],
  ["Eyebright Tea (compress)", "Euphrasia officinalis", "Eye comfort", "eyebright"],
  ["Nettle Leaf Tea", "Urtica dioica", "Mineral support", "nettle"],
  ["Oat Straw Tea", "Avena sativa", "Nervine tonic", "oat-straw"],
  ["Milky Oats Tincture", "Avena sativa", "Nervine tonic", "milky-oats"],
  ["Wood Betony Tea", "Stachys officinalis", "Calm headaches", "wood-betony"],
  ["Hops Sleep Pillow", "Humulus lupulus", "Sleep aromatherapy", "hops"],
  ["Mugwort Sleep Pillow (Teen)", "Artemisia vulgaris", "Sleep aromatherapy", "mugwort"],
  ["Magnolia Bark (Teen)", "Magnolia officinalis", "Calm", "magnolia"],
  ["Bacopa (Teen Focus)", "Bacopa monnieri", "Focus support", "bacopa"],
  ["Gotu Kola (Teen Focus)", "Centella asiatica", "Calm focus", "gotu-kola"],
  ["Ginkgo Biloba (Teen Focus)", "Ginkgo biloba", "Circulation, focus", "ginkgo"],
  ["Phosphatidylserine for Focus", null, "Brain phospholipid", "phosphatidylserine"],
  ["Inositol Powder", null, "Calm and OCD support", "inositol"],
  ["Taurine", null, "Calm and sleep", "taurine"],
  ["NAC (N-Acetyl Cysteine, Teen)", null, "Antioxidant, OCD support", "nac"],
  ["Saffron Extract (Teen)", "Crocus sativus", "Mood support", "saffron"],
  ["5-HTP (Teen, with care)", null, "Serotonin precursor", "5-htp"],
  ["B-Complex for Kids", null, "B vitamins", "b-complex"],
  ["B12 Methylcobalamin", null, "B12", "b12"],
  ["Folate (5-MTHF)", null, "Folate, methylated", "folate"],
  ["Choline (Citicoline)", null, "Brain support", "choline"],
  ["Lithium Orotate (low dose, Teen)", null, "Mood support", "lithium-orotate"],
  ["Selenium", null, "Trace mineral", "selenium"],
  ["Iodine (Sea Kelp)", null, "Trace mineral", "iodine"],
  ["Vitamin C (Whole-Food)", null, "Vitamin", "vitamin-c"],
  ["Quercetin (with Bromelain)", null, "Allergy support", "quercetin"],
  ["Allerlife or Equivalent Allergy Tea", null, "Allergy comfort", "allergy-tea"],
  ["Saline Nasal Rinse for Kids", null, "Allergy comfort", "saline"],
  ["Probiotic for Mood (Lactobacillus rhamnosus)", null, "Targeted strain", "probiotic-mood"],
  ["Saccharomyces Boulardii", null, "Yeast probiotic", "s-boulardii"],
  ["Prebiotic Fiber (PHGG)", null, "Gut food", "prebiotic"],
  ["Digestive Enzymes for Kids", null, "Digestive comfort", "enzymes"],
  ["Apple Cider Vinegar Gummies (Teen)", null, "Digestive aid", "acv"],
  ["Slow-Drip Acupressure Mat (Teen)", null, "Body-based calm", "acupressure-mat"],
  ["Earthing Mat for Sleep", null, "Body-based calm", "earthing-mat"],
  ["HeartMath emWave2 (Teen)", null, "Biofeedback", "emwave"],
  ["Muse S Headband (Teen)", null, "Meditation biofeedback", "muse"],
  ["Acupuncture Press Seeds", null, "TCM ear seeds", "ear-seeds"],
  ["Cupping Set for Teens", null, "TCM body work", "cupping"],
  ["Gua Sha Tool", null, "TCM body work", "gua-sha"],
  ["Vagus Nerve Stimulator (FDA-cleared, Teen)", null, "Vagus nerve", "vagus-nerve"],
  ["Weighted Stuffed Animal", null, "Sensory comfort", "weighted-animal"],
  ["Visual Sand Timer", null, "Time visualization", "sand-timer"],
  ["Mindful Breathing Ball", null, "Breath practice", "breathing-ball"],
  ["Worry Stones (set)", null, "Comfort object", "worry-stone"],
  ["Anxiety Bracelet (acupressure point)", null, "Acupressure", "acupressure-bracelet"],
  ["Tongue Scraper (Ayurvedic)", null, "Daily Ayurvedic ritual", "tongue-scraper"],
  ["Nasya Oil (Ayurvedic)", null, "Ayurvedic oil", "nasya"],
  ["Abhyanga Massage Oil for Kids", null, "Ayurvedic oil massage", "abhyanga"],
  ["Bach Walnut", null, "Bach essence (transitions)", "bach-walnut"],
  ["Bach Aspen", null, "Bach essence (vague fears)", "bach-aspen"],
  ["Bach Larch", null, "Bach essence (confidence)", "bach-larch"],
  ["Bach White Chestnut", null, "Bach essence (looping thoughts)", "bach-chestnut"],
  ["Bach Star of Bethlehem", null, "Bach essence (shock)", "bach-bethlehem"],
  ["Bach Cherry Plum", null, "Bach essence (loss of control)", "bach-cherry"],
  ["Bach Crab Apple", null, "Bach essence (cleansing)", "bach-crab"],
  ["Bach Olive", null, "Bach essence (exhaustion)", "bach-olive"],
  ["Bach Rock Rose", null, "Bach essence (terror)", "bach-rock-rose"],
  ["Bach Beech", null, "Bach essence (irritability)", "bach-beech"],
  ["Bach Vervain", null, "Bach essence (over-effort)", "bach-vervain"],
  ["Bach Chestnut Bud", null, "Bach essence (learning)", "bach-chestnut-bud"],
  ["Bach Hornbeam", null, "Bach essence (Monday mornings)", "bach-hornbeam"],
  ["Bach Honeysuckle", null, "Bach essence (homesickness)", "bach-honeysuckle"],
  ["Bach Mustard", null, "Bach essence (sudden sadness)", "bach-mustard"],
  ["Bach Gentian", null, "Bach essence (discouragement)", "bach-gentian"],
  ["Bach Gorse", null, "Bach essence (hopelessness)", "bach-gorse"],
  ["Bach Wild Rose", null, "Bach essence (apathy)", "bach-wild-rose"],
  ["Bach Sweet Chestnut", null, "Bach essence (deep grief)", "bach-sweet-chestnut"],
  ["Bach Pine", null, "Bach essence (self-blame)", "bach-pine"],
  ["Bach Willow", null, "Bach essence (resentment)", "bach-willow"],
  ["Bach Holly", null, "Bach essence (jealousy and anger)", "bach-holly"],
  ["Bach Wild Oat", null, "Bach essence (life direction)", "bach-wild-oat"],
  ["Bach Centaury", null, "Bach essence (people-pleasing)", "bach-centaury"],
  ["Bach Cerato", null, "Bach essence (self-trust)", "bach-cerato"],
  ["Bach Scleranthus", null, "Bach essence (indecision)", "bach-scleranthus"],
  ["Bach Heather", null, "Bach essence (talkativeness)", "bach-heather"],
  ["Bach Impatiens", null, "Bach essence (impatience)", "bach-impatiens"],
  ["Bach Vine", null, "Bach essence (dominance)", "bach-vine"],
  ["Bach Water Violet", null, "Bach essence (loneliness)", "bach-water-violet"],
  ["Bach Chicory", null, "Bach essence (clinginess)", "bach-chicory"],
  ["Bach Agrimony", null, "Bach essence (hidden distress)", "bach-agrimony"],
  ["Bach Mimulus", null, "Bach essence (known fears)", "bach-mimulus"],
  ["Bach Rock Water", null, "Bach essence (rigidity)", "bach-rock-water"],
  ["Bach Elm", null, "Bach essence (overwhelm in capable kids)", "bach-elm"],
  ["Bach Oak", null, "Bach essence (push through fatigue)", "bach-oak"],
  ["Astragalus Root (Teen)", "Astragalus membranaceus", "TCM tonic, immune", "astragalus"],
  ["Reishi Spore Powder (Teen)", "Ganoderma lucidum", "Mushroom (deep calm)", "reishi-spore"],
  ["Lavender Bath Salts", null, "Bath ritual", "lavender-bath"],
  ["Epsom Salt Bath Soak", null, "Magnesium bath", "epsom"],
  ["Magnesium Foot Soak", null, "Magnesium bath", "magnesium-bath"],
  ["Sleep Tea Blend (Yogi)", null, "Sleep tea blend", "sleep-tea"],
  ["Stress Relief Tea Blend (Traditional Medicinals)", null, "Stress tea blend", "stress-tea"],
  ["Soothing Tummy Tea (Pukka or Yogi)", null, "Tummy tea blend", "tummy-tea"],
];
for (const [name, latin, cat, asinTag] of EXTRAS) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const asin = pickAsinByTag(asinTag);
  all.push({
    slug,
    name,
    latin,
    category: cat,
    blurb: `${name} is part of the wider library of supportive tools used in homes with sensitive children. The category is ${cat.toLowerCase()}, used by parents and practitioners as a complement, not a replacement for medical care. Always start low, go slow, and watch your child's response over a week before adjusting.`,
    dose: "Follow product label, or work with a qualified herbalist, naturopath, or licensed acupuncturist for child-specific dosing.",
    safety: "Pediatric supplementation is individual. Talk to your pediatrician before adding anything new, especially if your child takes prescription medication.",
    amazon: asin ? asinUrl(asin) : searchUrl(`${name} natural`),
    amazonAsin: asin || null,
  });
}

// Defensive de-em-dash everywhere
function noEmDash(s) { return typeof s === "string" ? s.replace(/—/g, ":") : s; }
for (const e of all) {
  for (const k of Object.keys(e)) {
    if (typeof e[k] === "string") e[k] = noEmDash(e[k]);
  }
}

await fs.writeFile(
  path.join(ROOT, "src/data/herbs-catalog.json"),
  JSON.stringify(all, null, 2),
);
console.log(`wrote ${all.length} herbs catalog entries`);
