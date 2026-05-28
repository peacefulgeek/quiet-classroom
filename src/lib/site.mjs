// Site-wide configuration. The single source of truth for brand + apex.

export const SITE = {
  name: "A Quiet Classroom",
  shortName: "Quiet Classroom",
  apex: "aquietclassroom.com",
  baseUrl: "https://aquietclassroom.com",
  tagline:
    "For parents of introverted, anxious, and highly sensitive kids. Written by The Oracle Lover.",
  pitch:
    "The resource for parents of kids who struggle at school not because something is wrong with them, but because school is designed for extroverts and their nervous system was built differently.",
  author: {
    name: "The Oracle Lover",
    title: "The Oracle Lover, Intuitive Educator and Oracle Guide",
    credential: "Researcher-parent and intuitive educator. Years of IEP meetings, temperament-literature reading, and one-on-one consults with parents of introverted, anxious, and highly sensitive children.",
    bio:
      "The Oracle Lover is a researcher-parent who has done the IEP meetings and read the temperament literature. She writes plainly for parents of sensitive children. No catastrophizing, no toxic positivity. She validates the exhaustion and gives you tools you can use Monday morning.",
    url: "https://theoraclelover.com",
    avatar: "https://quiet-classroom.b-cdn.net/brand/oracle-lover-avatar.webp",
    sameAs: [
      "https://theoraclelover.com",
      "https://theoraclelover.com/about",
    ],
  },
  amazonTag: process.env.AMAZON_TAG || "peacefulgeek-20",
  // Color palette per per-site spec
  palette: {
    bg: "#FAF8F5",
    text: "#1A2330",
    accent: "#7080B4",
    bioCard: "#EEF0F8",
  },
  // Bunny-hosted WOFF2 fonts (burned in, no Google Fonts)
  fonts: {
    masthead: "https://quiet-classroom.b-cdn.net/fonts/PlayfairDisplay-Bold.woff2",
    headline: "https://quiet-classroom.b-cdn.net/fonts/PlayfairDisplay-SemiBold.woff2",
    body: "https://quiet-classroom.b-cdn.net/fonts/SourceSerifPro-Regular.woff2",
    bodyItalic: "https://quiet-classroom.b-cdn.net/fonts/SourceSerifPro-Italic.woff2",
    ui: "https://quiet-classroom.b-cdn.net/fonts/DMSans-Regular.woff2",
    uiMedium: "https://quiet-classroom.b-cdn.net/fonts/DMSans-Medium.woff2",
  },
  // Default OG fallback (per-article will override)
  defaultOgImage: "https://quiet-classroom.b-cdn.net/brand/og-default-1200x630.webp",
  publishCadencePerDay: 5,
  disclaimer:
    "DISCLAIMER: Content on aquietclassroom.com is for educational purposes only and does not constitute medical, psychological, or educational advice. Always consult qualified professionals for your child's specific needs.",
  affiliateDisclosure:
    "As an Amazon Associate, I earn from qualifying purchases.",
};

export const PILLARS = [
  { slug: "introversion-vs-anxiety", title: "Introversion vs. Anxiety" },
  { slug: "school-life", title: "School Life" },
  { slug: "iep-and-504", title: "IEPs and 504 Plans" },
  { slug: "after-school", title: "After-School Recovery" },
  { slug: "sensory", title: "Sensory and Environment" },
  { slug: "homework-and-learning", title: "Homework and Learning" },
  { slug: "social-and-friendships", title: "Social and Friendships" },
  { slug: "parents-and-family", title: "Parents and Family" },
  { slug: "growing-up", title: "Growing Up" },
  { slug: "herbs-and-holistic", title: "Herbs and Holistic" },
];
