import {
  academyRestFetch,
  getAcademyDisplayName,
  getAcademySupabaseConfig,
  type AcademyAuthUser,
} from '@/lib/academy-auth';

export type VerifiedCertificate = {
  certificateNumber: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  revoked: boolean;
};

type CertificateRow = {
  user_id: string;
  course_id: string;
  certificate_number: string;
  issued_at: string;
  revoked_at?: string | null;
};

export function isValidCertificateNumber(value: string) {
  return /^[A-Za-z0-9-]{6,80}$/.test(value);
}

export async function lookupCertificate(
  certificateNumber: string,
): Promise<VerifiedCertificate | null> {
  if (!isValidCertificateNumber(certificateNumber)) {
    return null;
  }

  try {
    const response = await academyRestFetch(
      `certificates?select=user_id,course_id,certificate_number,issued_at,revoked_at&certificate_number=eq.${encodeURIComponent(certificateNumber)}&limit=1`,
      { useServiceRole: true },
    );

    if (!response.ok) {
      return null;
    }

    const row = ((await response.json()) as CertificateRow[])[0];
    if (!row) {
      return null;
    }

    const [courseTitle, learnerName] = await Promise.all([
      getCourseTitle(row.course_id),
      getLearnerName(row.user_id, row.course_id),
    ]);

    return {
      certificateNumber: row.certificate_number,
      learnerName,
      courseTitle,
      issuedAt: row.issued_at,
      revoked: Boolean(row.revoked_at),
    };
  } catch {
    return null;
  }
}

async function getCourseTitle(courseId: string) {
  const response = await academyRestFetch(
    `courses?select=title&id=eq.${encodeURIComponent(courseId)}&limit=1`,
    { useServiceRole: true },
  );

  if (response.ok) {
    const rows = (await response.json()) as { title?: string }[];
    if (rows[0]?.title) return rows[0].title;
  }

  return 'Easy Medical Device Academy course';
}

// Same name the certificate itself shows: profile name, then the email prefix.
async function getLearnerName(userId: string, courseId: string) {
  const config = getAcademySupabaseConfig(true);

  if (config?.serviceRoleKey) {
    const response = await fetch(
      new URL(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, config.url),
      {
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: 'no-store',
      },
    );

    if (response.ok) {
      return getAcademyDisplayName((await response.json()) as AcademyAuthUser);
    }
  }

  const enrollment = await academyRestFetch(
    `enrollments?select=learner_name&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
    { useServiceRole: true },
  );

  if (enrollment.ok) {
    const rows = (await enrollment.json()) as { learner_name?: string }[];
    if (rows[0]?.learner_name) return rows[0].learner_name;
  }

  return 'Verified learner';
}
