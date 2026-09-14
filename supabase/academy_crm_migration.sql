-- ====================================================================
-- EASY MEDICAL DEVICE ACADEMY & CRM UNIFIED SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor (Project: tygrefjpsktwfgwogzrl)
-- ====================================================================

-- 1. Register Easy Medical Device Academy in businesses table
INSERT INTO public.businesses (slug, name, created_at)
VALUES ('easy-medical-device-academy', 'Easy Medical Device Academy', NOW())
ON CONFLICT (slug) DO UPDATE
SET name = 'Easy Medical Device Academy';

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  category TEXT NOT NULL,
  instructor TEXT DEFAULT 'Monir El Azzouzi',
  instructor_role TEXT DEFAULT 'MedTech Regulatory Expert',
  level TEXT DEFAULT 'Intermediate',
  duration TEXT DEFAULT '5 hours',
  lesson_count INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 4.8,
  learner_count INTEGER DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_label TEXT DEFAULT '$249',
  badge TEXT,
  thumbnail_url TEXT,
  accent TEXT DEFAULT '#7c3aed',
  outcomes JSONB DEFAULT '[]'::jsonb,
  stripe_price_id TEXT,
  stripe_price_env TEXT,
  sort_order INTEGER DEFAULT 100,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Lessons Table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_title TEXT DEFAULT 'General',
  title TEXT NOT NULL,
  lesson_type TEXT DEFAULT 'video',
  duration_minutes INTEGER DEFAULT 10,
  video_url TEXT,
  sort_order INTEGER DEFAULT 100,
  preview_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enrollments Table (Purchases / Enrolled Students)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  learner_name TEXT,
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'pending', 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Lesson Progress Table
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_email TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  progress_percent INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (learner_email, course_id, lesson_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);
CREATE INDEX IF NOT EXISTS idx_enrollments_learner ON public.enrollments(learner_email);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_learner ON public.lesson_progress(learner_email);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- COURSES: Public can read published courses; authenticated staff can do everything
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  USING (is_published = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert courses" ON public.courses;
CREATE POLICY "Authenticated users can insert courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update courses" ON public.courses;
CREATE POLICY "Authenticated users can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete courses" ON public.courses;
CREATE POLICY "Authenticated users can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (true);

-- LESSONS: Public can view previews; authenticated can view all / edit
DROP POLICY IF EXISTS "Public can view preview lessons" ON public.lessons;
CREATE POLICY "Public can view preview lessons"
  ON public.lessons FOR SELECT
  USING (preview_enabled = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage lessons" ON public.lessons;
CREATE POLICY "Authenticated users can manage lessons"
  ON public.lessons FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ENROLLMENTS: Learners can view their own; authenticated staff can view all
DROP POLICY IF EXISTS "Learners view own enrollments" ON public.enrollments;
CREATE POLICY "Learners view own enrollments"
  ON public.enrollments FOR SELECT
  USING (learner_email = (auth.jwt() ->> 'email') OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage enrollments" ON public.enrollments;
CREATE POLICY "Authenticated users can manage enrollments"
  ON public.enrollments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- LESSON PROGRESS: Learners view/update their own; staff view all
DROP POLICY IF EXISTS "Learners manage own progress" ON public.lesson_progress;
CREATE POLICY "Learners manage own progress"
  ON public.lesson_progress FOR ALL
  USING (learner_email = (auth.jwt() ->> 'email') OR auth.role() = 'authenticated')
  WITH CHECK (learner_email = (auth.jwt() ->> 'email') OR auth.role() = 'authenticated');

-- ====================================================================
-- SEED INITIAL 6 COURSES (IF NOT ALREADY PRESENT)
-- ====================================================================
INSERT INTO public.courses (
  id, slug, title, subtitle, category, instructor, instructor_role, level, duration, lesson_count, rating, learner_count, price_cents, price_label, badge, thumbnail_url, accent, outcomes, is_published, sort_order
) VALUES
(
  'eu-mdr-technical-file',
  'eu-mdr-technical-file-masterclass',
  'EU MDR Technical File Masterclass',
  'Build a complete MDR-ready technical documentation set with templates, evidence maps, and reviewer logic.',
  'EU MDR',
  'Monir El Azzouzi',
  'Regulatory Affairs & Quality Specialist',
  'Intermediate',
  '6.5 hours',
  42,
  4.8,
  1820,
  24900,
  '$249',
  'Bestseller',
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
  '#7c3aed',
  '["Technical file structure for EU MDR audits", "GSPR evidence mapping and gap review", "Notified body response preparation"]'::jsonb,
  true,
  1
),
(
  'iso-13485-qms',
  'iso-13485-qms-implementation',
  'ISO 13485 QMS Implementation Sprint',
  'Create a lean, audit-ready quality system without burying your team in unnecessary procedures.',
  'ISO 13485',
  'Monir El Azzouzi',
  'Lead Auditor & QMS Specialist',
  'Beginner to advanced',
  '5 hours',
  31,
  4.7,
  1390,
  21900,
  '$219',
  'Team favorite',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80',
  '#08a99f',
  '["Process map and SOP architecture", "CAPA, supplier, and training controls", "Audit evidence your team can maintain"]'::jsonb,
  true,
  2
),
(
  'ivdr-pathway',
  'ivdr-pathway-for-diagnostic-teams',
  'IVDR Pathway for Diagnostic Teams',
  'Navigate classification, performance evaluation, clinical evidence, and notified body expectations.',
  'IVDR',
  'Monir El Azzouzi',
  'Diagnostics Regulatory Team',
  'Intermediate',
  '4.5 hours',
  28,
  4.9,
  860,
  22900,
  '$229',
  'New',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
  '#4f46e5',
  '["Classification and conformity routes", "Performance evaluation plan and report", "Post-market performance follow-up basics"]'::jsonb,
  true,
  3
),
(
  'samd-compliance',
  'software-as-a-medical-device-compliance',
  'Software as a Medical Device Compliance',
  'Connect IEC 62304, cybersecurity, usability, and AI claims into a coherent regulatory story.',
  'Software',
  'Monir El Azzouzi',
  'Digital Health & SaMD Specialist',
  'Advanced',
  '7 hours',
  46,
  4.8,
  1240,
  27900,
  '$279',
  'Hot topic',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
  '#2563eb',
  '["Software safety classification", "Cybersecurity and usability evidence", "AI and change management controls"]'::jsonb,
  true,
  4
),
(
  'risk-management-design-controls',
  'risk-management-design-controls',
  'Risk Management for Design Controls',
  'Use ISO 14971 risk files to make design reviews, verification, validation, and PMS decisions clearer.',
  'Risk',
  'Monir El Azzouzi',
  'Risk & Design Control Faculty',
  'Intermediate',
  '3.5 hours',
  24,
  4.6,
  970,
  18900,
  '$189',
  'Practical',
  'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80',
  '#e08c1b',
  '["Hazard analysis and benefit-risk decisions", "Risk control traceability", "Design review evidence packs"]'::jsonb,
  true,
  5
),
(
  'market-access-strategy',
  'market-access-regulatory-strategy',
  'Market Access and Regulatory Strategy',
  'Choose approval pathways, build country launch plans, and avoid costly surprises before submission.',
  'Market Access',
  'Monir El Azzouzi',
  'Global Regulatory Advisor',
  'Beginner',
  '4 hours',
  26,
  4.7,
  1110,
  19900,
  '$199',
  'Launch ready',
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
  '#12a377',
  '["Regulatory route selection", "Submission timing and country sequencing", "Commercial launch readiness checklist"]'::jsonb,
  true,
  6
)
ON CONFLICT (id) DO NOTHING;
