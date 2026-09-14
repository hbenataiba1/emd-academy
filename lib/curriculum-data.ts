export type LessonResource = {
  name: string;
  size: string;
  type: string;
};

export type TranscriptEntry = {
  time: string;
  seconds: number;
  text: string;
};

export type CourseLesson = {
  id: string;
  title: string;
  duration: string;
  durationSeconds: number;
  type: 'video' | 'article' | 'quiz' | 'template';
  completed?: boolean;
  videoUrl?: string;
  subtitleSummary?: string;
  description: string;
  resources?: LessonResource[];
  transcripts?: TranscriptEntry[];
};

export type CourseSection = {
  id: string;
  title: string;
  lessons: CourseLesson[];
};

export type CourseCurriculum = {
  courseId: string;
  title: string;
  instructor: string;
  instructorRole: string;
  rating: number;
  ratingCount: number;
  studentCount: number;
  lastUpdated: string;
  totalDuration: string;
  sections: CourseSection[];
};

export const defaultCourseCurriculums: Record<string, CourseCurriculum> = {
  'eu-mdr-technical-file': {
    courseId: 'eu-mdr-technical-file',
    title: 'EU MDR Technical File Masterclass (2026) - GSPR, Clinical & Notified Body Audit Readiness',
    instructor: 'Monir El Azzouzi',
    instructorRole: 'Founder & CEO Easy Medical Device, Lead Regulatory Consultant',
    rating: 4.9,
    ratingCount: 1820,
    studentCount: 3450,
    lastUpdated: 'February 2026',
    totalDuration: '6.5 hours',
    sections: [
      {
        id: 'sec-1',
        title: 'Section 1: EU MDR Foundations & Regulatory Classification',
        lessons: [
          {
            id: 'les-1',
            title: '1. Welcome & How to Get the Most from This Masterclass',
            duration: '04:15',
            durationSeconds: 255,
            type: 'video',
            completed: true,
            subtitleSummary: 'Welcome to the Easy Medical Device Academy MDR Masterclass! In this introductory module, Monir explains how the course is structured and how to use the downloadable templates.',
            description: 'Get an overview of the roadmap to building a bulletproof EU MDR Technical Documentation dossier. We cover the learning methodology, course toolkit, and notified body expectations.',
            resources: [
              { name: 'MDR_Masterclass_Welcome_Guide.pdf', size: '1.2 MB', type: 'PDF' },
              { name: 'Audit_Readiness_Checklist_2026.xlsx', size: '450 KB', type: 'Spreadsheet' },
            ],
            transcripts: [
              { time: '00:00', seconds: 0, text: 'Hello and welcome everyone! I am Monir El Azzouzi, Founder and CEO of Easy Medical Device.' },
              { time: '00:45', seconds: 45, text: 'In this masterclass, we will demystify the EU Medical Device Regulation 2017/745.' },
              { time: '01:30', seconds: 90, text: 'You will learn the exact step-by-step framework we use with our consulting clients.' },
              { time: '02:40', seconds: 160, text: 'Make sure you download the attached templates before proceeding to Section 2.' },
            ],
          },
          {
            id: 'les-2',
            title: '2. MDD vs MDR: Understanding the Structural Shifts',
            duration: '12:30',
            durationSeconds: 750,
            type: 'video',
            completed: true,
            subtitleSummary: 'Comparison of the Directives (MDD) vs the Regulation (MDR) focusing on clinical evaluation rigor and post-market surveillance.',
            description: 'Deep dive into what changed between MDD and MDR: increased notified body scrutiny, stricter clinical requirements, EUDAMED registration, and economic operator obligations.',
            resources: [
              { name: 'MDD_vs_MDR_Gap_Analysis_Matrix.xlsx', size: '890 KB', type: 'Spreadsheet' },
            ],
          },
          {
            id: 'les-3',
            title: '3. Annex VIII Classification Rules & Borderline Determination',
            duration: '18:45',
            durationSeconds: 1125,
            type: 'video',
            completed: true,
            subtitleSummary: 'Practical application of the 22 classification rules under Annex VIII with special emphasis on Rule 11 for software.',
            description: 'Step-by-step walkthrough of determining device classification (Class I, IIa, IIb, III) and documenting your justification in the technical file.',
            resources: [
              { name: 'Annex_VIII_Classification_Decision_Tree.pdf', size: '2.1 MB', type: 'PDF' },
            ],
          },
        ],
      },
      {
        id: 'sec-2',
        title: 'Section 2: Annex II & III Technical Documentation Architecture',
        lessons: [
          {
            id: 'les-4',
            title: '4. Device Description, Specification & Intended Purpose Formulation',
            duration: '15:20',
            durationSeconds: 920,
            type: 'video',
            completed: true,
            subtitleSummary: 'Formulating clear intended purpose statements that align with clinical claims and technical specifications.',
            description: 'How to write Section 1 of your Annex II technical file: intended purpose, patient population, contraindications, variants, and novel technology descriptions.',
            resources: [
              { name: 'Device_Description_Annex_II_Template.docx', size: '1.4 MB', type: 'Word' },
            ],
          },
          {
            id: 'les-5',
            title: '5. Manufacturing Information & Verification/Validation Evidence',
            duration: '22:10',
            durationSeconds: 1330,
            type: 'video',
            completed: false,
            subtitleSummary: 'Documenting design validation, test protocols, sterilization validation, and critical supplier qualifications.',
            description: 'Explore the exact evidence required by notified body reviewers for manufacturing flowcharts, critical process validations, biocompatibility, and bench testing.',
            resources: [
              { name: 'Manufacturing_Validation_Protocol_Template.docx', size: '780 KB', type: 'Word' },
              { name: 'Biocompatibility_ISO_10993_Summary_Sheet.xlsx', size: '620 KB', type: 'Spreadsheet' },
            ],
            transcripts: [
              { time: '00:00', seconds: 0, text: 'Now we arrive at one of the most critical parts of Annex II: manufacturing and verification validation.' },
              { time: '02:15', seconds: 135, text: 'Notified bodies do not just want to see summary results; they look for traceability from design inputs to verification protocols.' },
              { time: '05:30', seconds: 330, text: 'Let us examine how to structure your test summary reports to prevent non-conformities during phase 1 reviews.' },
              { time: '11:00', seconds: 660, text: 'Notice how the risk controls from ISO 14971 must link directly to each verification test.' },
            ],
          },
          {
            id: 'les-6',
            title: '6. GSPR (Annex I) Mapping Master Spreadsheet Deep Dive',
            duration: '26:40',
            durationSeconds: 1600,
            type: 'video',
            completed: false,
            subtitleSummary: 'Filling out every General Safety and Performance Requirement with cross-references to harmonized standards and test reports.',
            description: 'The General Safety and Performance Requirements (GSPR) are the backbone of CE marking. We fill out a live GSPR matrix row by row.',
            resources: [
              { name: 'GSPR_Annex_I_Master_Compliance_Matrix_2026.xlsx', size: '1.8 MB', type: 'Spreadsheet' },
            ],
          },
          {
            id: 'les-7',
            title: '7. Pre-submission Gap Analysis Workshop & Audit Checklist',
            duration: '14:15',
            durationSeconds: 855,
            type: 'video',
            completed: false,
            subtitleSummary: 'Conducting internal mock audits before submitting the technical dossier to BSI, TÜV SÜD, DEKRA, or GMED.',
            description: 'Run a structured gap assessment against common notified body screening checklists to catch missing signatures, outdated norms, or broken cross-references.',
            resources: [
              { name: 'Notified_Body_Screening_Gap_Checklist.pdf', size: '950 KB', type: 'PDF' },
            ],
          },
        ],
      },
      {
        id: 'sec-3',
        title: 'Section 3: Clinical Evaluation (CER) & Post-Market Surveillance (PMS)',
        lessons: [
          {
            id: 'les-8',
            title: '8. Clinical Evaluation Plan & State-of-the-Art (SOTA) Literature Search',
            duration: '28:10',
            durationSeconds: 1690,
            type: 'video',
            completed: false,
            subtitleSummary: 'Establishing clinical evaluation plans and objective state-of-the-art criteria.',
            description: 'Establishing state-of-the-art benchmark criteria, systematic literature search protocols (MDCG 2020-6 / MEDDEV 2.7/1 rev 4), and clinical evidence appraisal.',
            resources: [
              { name: 'Clinical_Evaluation_Plan_Template.docx', size: '2.3 MB', type: 'Word' },
            ],
          },
          {
            id: 'les-9',
            title: '9. Post-Market Clinical Follow-Up (PMCF) Strategy and Survey Design',
            duration: '19:45',
            durationSeconds: 1185,
            type: 'video',
            completed: false,
            subtitleSummary: 'Proactive PMCF design and user survey methodologies for Class IIa/IIb devices.',
            description: 'When is PMCF mandatory? How to design proactive PMCF studies and user surveys that fulfill MDCG 2020-7 and 2020-8 guidelines.',
          },
          {
            id: 'les-10',
            title: '10. Periodic Safety Update Reports (PSUR) & Trend Reporting Protocols',
            duration: '21:30',
            durationSeconds: 1290,
            type: 'video',
            completed: false,
            subtitleSummary: 'Timelines and vigilance trigger thresholds for PSUR submissions.',
            description: 'PSUR preparation timelines, vigilance reporting thresholds, and integrating customer feedback into risk management.',
          },
        ],
      },
      {
        id: 'sec-4',
        title: 'Section 4: Notified Body Audits & Managing Non-Conformities',
        lessons: [
          {
            id: 'les-11',
            title: '11. Inside the Mind of a Notified Body Reviewer',
            duration: '18:50',
            durationSeconds: 1130,
            type: 'video',
            completed: false,
            subtitleSummary: 'How notified body reviewers analyze files and where major non-conformities are triggered.',
            description: 'How reviewers structure their time, where they look first, and the red flags that trigger major non-conformities.',
          },
          {
            id: 'les-12',
            title: '12. Root Cause Analysis & CAPA for Audit Findings',
            duration: '24:15',
            durationSeconds: 1455,
            type: 'video',
            completed: false,
            subtitleSummary: 'Answering Request for Information (RFI) letters within 30-day deadlines.',
            description: 'How to answer notified body queries (RFI) with convincing evidence and tight 30-day resolution responses.',
          },
          {
            id: 'les-13',
            title: '13. Course Conclusion & Claiming Your Official Certificate',
            duration: '05:40',
            durationSeconds: 340,
            type: 'video',
            completed: false,
            subtitleSummary: 'Congratulations! How to claim and share your verified certificate on LinkedIn.',
            description: 'Final congratulations from Monir, tips for ongoing regulatory monitoring, and instructions to download your accredited certificate.',
          },
        ],
      },
    ],
  },
};

export function getCurriculumForCourse(courseIdOrSlug?: string): CourseCurriculum {
  if (!courseIdOrSlug) {
    return defaultCourseCurriculums['eu-mdr-technical-file'];
  }

  // Check direct key or match by prefix
  if (defaultCourseCurriculums[courseIdOrSlug]) {
    return defaultCourseCurriculums[courseIdOrSlug];
  }

  const normalized = courseIdOrSlug.toLowerCase();
  for (const key of Object.keys(defaultCourseCurriculums)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return defaultCourseCurriculums[key];
    }
  }

  // Generate a realistic MedTech curriculum for any other course
  const cleanTitle = courseIdOrSlug
    .replace(/-/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    courseId: courseIdOrSlug,
    title: `${cleanTitle} (2026 Masterclass)`,
    instructor: 'Monir El Azzouzi',
    instructorRole: 'Founder & CEO Easy Medical Device, Lead Regulatory Consultant',
    rating: 4.8,
    ratingCount: 1240,
    studentCount: 2850,
    lastUpdated: 'February 2026',
    totalDuration: '5.5 hours',
    sections: [
      {
        id: 'sec-1',
        title: 'Section 1: Core Principles and Foundations',
        lessons: [
          {
            id: 'les-1',
            title: '1. Course Orientation & Regulatory Framework',
            duration: '05:10',
            durationSeconds: 310,
            type: 'video',
            completed: true,
            subtitleSummary: 'Welcome and overview of standards, audit criteria, and key regulatory pathways.',
            description: 'Introduction to regulatory expectations, scope of standards, and practical implementation roadmap.',
          },
          {
            id: 'les-2',
            title: '2. Key Terminology and Standard Requirements',
            duration: '14:20',
            durationSeconds: 860,
            type: 'video',
            completed: true,
            subtitleSummary: 'Clause-by-clause walkthrough with real-world MedTech interpretations.',
            description: 'Detailed clause-by-clause walkthrough with real-world MedTech interpretations.',
          },
        ],
      },
      {
        id: 'sec-2',
        title: 'Section 2: Step-by-Step Implementation & Templates',
        lessons: [
          {
            id: 'les-3',
            title: '3. Technical Documentation Construction & Traceability',
            duration: '21:15',
            durationSeconds: 1275,
            type: 'video',
            completed: false,
            subtitleSummary: 'Practical exercise building your technical files and compliance records.',
            description: 'Practical exercise building your technical files and compliance records.',
            resources: [
              { name: 'Audit_Ready_Template_Pack.zip', size: '3.4 MB', type: 'Archive' },
            ],
          },
          {
            id: 'les-4',
            title: '4. Verification, Validation & Audit Defense',
            duration: '18:40',
            durationSeconds: 1120,
            type: 'video',
            completed: false,
            subtitleSummary: 'Defending your documentation during internal audits and notified body assessments.',
            description: 'Defending your documentation during internal audits and notified body assessments.',
          },
        ],
      },
      {
        id: 'sec-3',
        title: 'Section 3: Case Studies & Final Certification',
        lessons: [
          {
            id: 'les-5',
            title: '5. Real-World Case Study Breakdown',
            duration: '22:30',
            durationSeconds: 1350,
            type: 'video',
            completed: false,
            subtitleSummary: 'Detailed analysis of successful submissions and lessons learned from past audits.',
            description: 'Detailed analysis of successful submissions and lessons learned from past audits.',
          },
          {
            id: 'les-6',
            title: '6. Course Completion & Certificate Generation',
            duration: '06:10',
            durationSeconds: 370,
            type: 'video',
            completed: false,
            subtitleSummary: 'How to verify and share your official Easy Medical Device Academy certificate.',
            description: 'How to verify and share your official Easy Medical Device Academy certificate.',
          },
        ],
      },
    ],
  };
}

