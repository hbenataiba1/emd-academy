export const courseCategories = [
  'All',
  'EU MDR',
  'IVDR',
  'ISO 13485',
  'Risk',
  'Software',
  'Market Access',
] as const;

export type CourseCategory = Exclude<(typeof courseCategories)[number], 'All'>;

export type AcademyCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: CourseCategory;
  instructor: string;
  instructorRole: string;
  level: string;
  duration: string;
  lessons: number;
  rating: number;
  students: number;
  price: number;
  priceLabel: string;
  badge: string;
  image: string;
  accent: string;
  stripePriceEnv: string;
  stripePriceId?: string;
  outcomes: string[];
};

export type SupabaseCourseRow = Partial<{
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  instructor: string;
  instructor_role: string;
  level: string;
  duration: string;
  lesson_count: number;
  lessons: number;
  rating: number;
  learner_count: number;
  students: number;
  price_cents: number;
  price: number;
  price_label: string;
  badge: string;
  thumbnail_url: string;
  image: string;
  accent: string;
  outcomes: string[] | string;
  stripe_price_id: string;
  stripe_price_env: string;
}>;

const contentCategories = courseCategories.filter(
  (category): category is CourseCategory => category !== 'All',
);

const defaultImages = [
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
];

export const featuredCourses: AcademyCourse[] = [
  {
    id: 'eu-mdr-technical-file',
    slug: 'eu-mdr-technical-file-masterclass',
    title: 'EU MDR Technical File Masterclass',
    subtitle:
      'Build a complete MDR-ready technical documentation set with templates, evidence maps, and reviewer logic.',
    category: 'EU MDR',
    instructor: 'Easy Medical Device experts',
    instructorRole: 'Regulatory affairs specialists',
    level: 'Intermediate',
    duration: '6.5 hours',
    lessons: 42,
    rating: 4.8,
    students: 1820,
    price: 249,
    priceLabel: '$249',
    badge: 'Bestseller',
    image: defaultImages[0],
    accent: '#7c3aed',
    stripePriceEnv: 'STRIPE_PRICE_EU_MDR_TECHNICAL_FILE',
    outcomes: [
      'Technical file structure for EU MDR audits',
      'GSPR evidence mapping and gap review',
      'Notified body response preparation',
    ],
  },
  {
    id: 'iso-13485-qms',
    slug: 'iso-13485-qms-implementation',
    title: 'ISO 13485 QMS Implementation Sprint',
    subtitle:
      'Create a lean, audit-ready quality system without burying your team in unnecessary procedures.',
    category: 'ISO 13485',
    instructor: 'Quality systems faculty',
    instructorRole: 'Lead auditors and QMS builders',
    level: 'Beginner to advanced',
    duration: '5 hours',
    lessons: 31,
    rating: 4.7,
    students: 1390,
    price: 219,
    priceLabel: '$219',
    badge: 'Team favorite',
    image: defaultImages[1],
    accent: '#08a99f',
    stripePriceEnv: 'STRIPE_PRICE_ISO_13485_QMS',
    outcomes: [
      'Process map and SOP architecture',
      'CAPA, supplier, and training controls',
      'Audit evidence your team can maintain',
    ],
  },
  {
    id: 'ivdr-pathway',
    slug: 'ivdr-pathway-for-diagnostic-teams',
    title: 'IVDR Pathway for Diagnostic Teams',
    subtitle:
      'Navigate classification, performance evaluation, clinical evidence, and notified body expectations.',
    category: 'IVDR',
    instructor: 'Diagnostics regulatory team',
    instructorRole: 'IVD and performance evaluation experts',
    level: 'Intermediate',
    duration: '4.5 hours',
    lessons: 28,
    rating: 4.9,
    students: 860,
    price: 229,
    priceLabel: '$229',
    badge: 'New',
    image: defaultImages[2],
    accent: '#4f46e5',
    stripePriceEnv: 'STRIPE_PRICE_IVDR_PATHWAY',
    outcomes: [
      'Classification and conformity routes',
      'Performance evaluation plan and report',
      'Post-market performance follow-up basics',
    ],
  },
  {
    id: 'samd-compliance',
    slug: 'software-as-a-medical-device-compliance',
    title: 'Software as a Medical Device Compliance',
    subtitle:
      'Connect IEC 62304, cybersecurity, usability, and AI claims into a coherent regulatory story.',
    category: 'Software',
    instructor: 'Digital health specialists',
    instructorRole: 'SaMD, AI, and cybersecurity advisors',
    level: 'Advanced',
    duration: '7 hours',
    lessons: 46,
    rating: 4.8,
    students: 1240,
    price: 279,
    priceLabel: '$279',
    badge: 'Hot topic',
    image: defaultImages[3],
    accent: '#2563eb',
    stripePriceEnv: 'STRIPE_PRICE_SAMD_COMPLIANCE',
    outcomes: [
      'Software safety classification',
      'Cybersecurity and usability evidence',
      'AI and change management controls',
    ],
  },
  {
    id: 'risk-management-design-controls',
    slug: 'risk-management-design-controls',
    title: 'Risk Management for Design Controls',
    subtitle:
      'Use ISO 14971 risk files to make design reviews, verification, validation, and PMS decisions clearer.',
    category: 'Risk',
    instructor: 'Risk and design control faculty',
    instructorRole: 'ISO 14971 practitioners',
    level: 'Intermediate',
    duration: '3.5 hours',
    lessons: 24,
    rating: 4.6,
    students: 970,
    price: 189,
    priceLabel: '$189',
    badge: 'Practical',
    image: defaultImages[1],
    accent: '#e08c1b',
    stripePriceEnv: 'STRIPE_PRICE_RISK_DESIGN_CONTROLS',
    outcomes: [
      'Hazard analysis and benefit-risk decisions',
      'Risk control traceability',
      'Design review evidence packs',
    ],
  },
  {
    id: 'market-access-strategy',
    slug: 'market-access-regulatory-strategy',
    title: 'Market Access and Regulatory Strategy',
    subtitle:
      'Choose approval pathways, build country launch plans, and avoid costly surprises before submission.',
    category: 'Market Access',
    instructor: 'Global regulatory advisors',
    instructorRole: 'EU, US, and international market access team',
    level: 'Beginner',
    duration: '4 hours',
    lessons: 26,
    rating: 4.7,
    students: 1110,
    price: 199,
    priceLabel: '$199',
    badge: 'Launch ready',
    image: defaultImages[0],
    accent: '#12a377',
    stripePriceEnv: 'STRIPE_PRICE_MARKET_ACCESS_STRATEGY',
    outcomes: [
      'Regulatory route selection',
      'Submission timing and country sequencing',
      'Commercial launch readiness checklist',
    ],
  },
];

export const learningPaths = [
  {
    title: 'Regulatory affairs foundation',
    copy: 'From device classification to technical file architecture, this path prepares new RA hires for real submissions.',
    courses: 5,
    hours: 22,
    progress: 72,
  },
  {
    title: 'Quality system builder',
    copy: 'Practical ISO 13485, supplier control, CAPA, and internal audit training for lean medical-device teams.',
    courses: 4,
    hours: 18,
    progress: 64,
  },
  {
    title: 'Digital health compliance',
    copy: 'SaMD, AI, cybersecurity, usability, and post-market evidence for software-driven products.',
    courses: 6,
    hours: 28,
    progress: 81,
  },
];

export const companyLogos = [
  'Kinepict',
  'MannKind',
  'Convergent',
  'HTI',
  'Kalogon',
];

export function getCourseById(courseId: string) {
  return featuredCourses.find((course) => course.id === courseId);
}

export function mapSupabaseCourse(
  row: SupabaseCourseRow,
  index: number,
): AcademyCourse | null {
  if (!row.id && !row.slug) {
    return null;
  }

  const fallback = featuredCourses[index % featuredCourses.length];
  const category = normalizeCategory(row.category);
  const slug = row.slug || slugify(row.title || row.id || `course-${index}`);
  const id = row.id || slug;
  const price =
    typeof row.price_cents === 'number'
      ? Math.round(row.price_cents / 100)
      : typeof row.price === 'number'
        ? row.price
        : fallback.price;

  return {
    id,
    slug,
    title: row.title || fallback.title,
    subtitle: row.subtitle || row.description || fallback.subtitle,
    category,
    instructor: row.instructor || fallback.instructor,
    instructorRole: row.instructor_role || fallback.instructorRole,
    level: row.level || fallback.level,
    duration: row.duration || fallback.duration,
    lessons: row.lesson_count || row.lessons || fallback.lessons,
    rating: typeof row.rating === 'number' ? row.rating : fallback.rating,
    students: row.learner_count || row.students || fallback.students,
    price,
    priceLabel: row.price_label || `$${price}`,
    badge: row.badge || fallback.badge,
    image:
      row.thumbnail_url ||
      row.image ||
      defaultImages[index % defaultImages.length],
    accent: row.accent || fallback.accent,
    stripePriceEnv:
      row.stripe_price_env ||
      `STRIPE_PRICE_${slug.replace(/-/g, '_').toUpperCase()}`,
    stripePriceId: row.stripe_price_id,
    outcomes: normalizeOutcomes(row.outcomes, index),
  };
}

function normalizeCategory(value?: string): CourseCategory {
  const match = contentCategories.find(
    (category) => category.toLowerCase() === value?.toLowerCase(),
  );

  return match || 'EU MDR';
}

function normalizeOutcomes(
  value: SupabaseCourseRow['outcomes'],
  index: number,
) {
  if (Array.isArray(value) && value.length) {
    return value.slice(0, 4);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).slice(0, 4);
      }
    } catch {
      return value
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
  }

  return featuredCourses[index % featuredCourses.length].outcomes;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
