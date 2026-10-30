'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  HelpCircle,
  Presentation,
  Video,
  X,
} from 'lucide-react';

import { courseStatusLabel } from '@/components/academy-instructor-courses-page';
import { useConfirm } from '@/components/confirm-dialog';
import { FormSkeleton } from '@/components/instructor-skeletons';
import { getAcademyAuthHeader, getStoredAcademySession } from '@/lib/academy-session';

type Resource = { name: string; url: string };

type Lesson = {
  key: string;
  id?: string;
  title: string;
  /** The module this lesson belongs to (lessons with the same name are grouped). */
  sectionTitle: string;
  type: 'video' | 'article';
  videoUrl: string;
  minutes: number;
  text: string;
  preview: boolean;
  resources: Resource[];
  progress?: number | null;
};

type Section = { key: string; title: string; lessons: Lesson[] };

type ExamOption = { id: string; text: string };
type ExamQuestion = {
  key: string;
  question: string;
  options: ExamOption[];
  correctOptionIds: string[];
  explanation: string;
};
type Exam = { passingScore: number; timeLimitMinutes: number; questions: ExamQuestion[] };

type Details = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: string;
  price: string;
  outcomes: string;
};

type Loaded = {
  editable: boolean;
  course: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    category: string;
    level: string;
    price: number;
    presentationUrl?: string;
    outcomes: string[];
    reviewStatus: 'draft' | 'in_review' | 'changes_requested' | 'approved';
    reviewNote: string;
    isPublished: boolean;
  };
  sections: { title: string; lessons: Omit<Lesson, 'key'>[] }[];
  exam: Exam | null;
};

const CATEGORIES = ['EU MDR', 'IVDR', 'ISO 13485', 'FDA', 'SaMD & Software', 'Risk Management', 'Quality Systems', 'Clinical Evaluation', 'Market Access'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const inputClass =
  'w-full rounded-xl border border-[#d9d1ee] bg-white px-4 py-2.5 text-sm text-[#191625] outline-none transition placeholder:text-[#9a93ad] focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f4fb] disabled:text-[#6e687d]';

let counter = 0;
const newKey = () => `k${Date.now().toString(36)}${counter++}`;

const blankQuestion = (): ExamQuestion => ({
  key: newKey(),
  question: '',
  options: [1, 2, 3, 4].map((n) => ({ id: `opt-${n}`, text: '' })),
  correctOptionIds: [],
  explanation: '',
});

const blankLesson = (): Lesson => ({
  key: newKey(),
  title: '',
  sectionTitle: '',
  type: 'video',
  videoUrl: '',
  minutes: 10,
  text: '',
  preview: false,
  resources: [],
});

/** Sends a file straight to storage and returns its public address. */
async function uploadFile(file: File, folder: 'videos' | 'resources', onProgress: (pct: number) => void) {
  const session = getStoredAcademySession();
  if (!session) throw new Error('Please sign in again.');

  const response = await fetch('/api/academy/instructor/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
    body: JSON.stringify({ fileName: file.name, folder }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    signedUrl?: string;
    publicUrl?: string;
    message?: string;
  };
  if (!response.ok || !payload.signedUrl || !payload.publicUrl) {
    throw new Error(payload.message || 'The upload could not be prepared.');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', payload.signedUrl as string);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? 'This file is too large to upload.' : `Upload failed (status ${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Network error during the upload.'));
    xhr.send(file);
  });

  return payload.publicUrl;
}

export function AcademyInstructorCourseEditor({ courseId }: { courseId: string }) {
  const { confirm, dialog } = useConfirm();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [exam, setExam] = useState<Exam>({ passingScore: 80, timeLimitMinutes: 20, questions: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [notice, setNotice] = useState('');
  const fileTarget = useRef<{ section: string; lesson: string; kind: 'video' | 'resource' | 'presentation' } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [presentationUrl, setPresentationUrl] = useState('');
  const [presentationProgress, setPresentationProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const session = getStoredAcademySession();
    if (!session) {
      window.location.assign(`/academy/login?next=/academy/instructor/courses/${courseId}`);
      return;
    }

    try {
      const response = await fetch(`/api/academy/instructor/courses/${encodeURIComponent(courseId)}`, {
        headers: getAcademyAuthHeader(session),
      });
      if (response.status === 401 || response.status === 403) {
        window.location.assign('/academy/instructor/apply');
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as Loaded & { message?: string };
      if (!response.ok) {
        setError(payload.message || 'The course could not be loaded.');
        return;
      }

      setLoaded(payload);
      setDetails({
        title: payload.course.title === 'Untitled course' ? '' : payload.course.title,
        subtitle: payload.course.subtitle,
        description: payload.course.description,
        category: payload.course.category,
        level: payload.course.level,
        price: payload.course.price ? String(payload.course.price) : '',
        outcomes: payload.course.outcomes.join('\n'),
      });
      setPresentationUrl(payload.course.presentationUrl || '');
      // A course is a simple list of lessons: they all go in one group.
      const loadedLessons = payload.sections.flatMap((section) =>
        section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title, key: newKey() })),
      );
      setSections([
        {
          key: newKey(),
          title: payload.sections[0]?.title || 'Introduction',
          lessons: loadedLessons.length ? loadedLessons : [blankLesson()],
        },
      ]);
      setExam(
        payload.exam
          ? { ...payload.exam, questions: payload.exam.questions.map((question) => ({ ...question, key: newKey() })) }
          : { passingScore: 80, timeLimitMinutes: 20, questions: [] },
      );
    } catch {
      setError('Network error. Please try again.');
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warn before leaving with changes that were not saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const editable = Boolean(loaded?.editable);

  function setDetail<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }

  function updateSections(next: Section[]) {
    setSections(next);
    setDirty(true);
  }

  function patchLesson(sectionKey: string, lessonKey: string, patch: Partial<Lesson>, markDirty = true) {
    setSections((prev) =>
      prev.map((section) =>
        section.key !== sectionKey
          ? section
          : { ...section, lessons: section.lessons.map((lesson) => (lesson.key === lessonKey ? { ...lesson, ...patch } : lesson)) },
      ),
    );
    if (markDirty) setDirty(true);
  }

  function move<T>(list: T[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    return copy;
  }

  function updateExam(next: Exam) {
    setExam(next);
    setDirty(true);
  }

  function patchQuestion(key: string, patch: Partial<ExamQuestion>) {
    updateExam({ ...exam, questions: exam.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) });
  }

  function pickFile(section: string, lesson: string, kind: 'video' | 'resource' | 'presentation') {
    fileTarget.current = { section, lesson, kind };
    if (fileInput.current) {
      fileInput.current.accept =
        kind === 'video' ? 'video/*' : kind === 'presentation' ? '.pdf,.ppt,.pptx' : '.pdf,.docx,.xlsx,.pptx,.zip,.png,.jpg,.jpeg';
      fileInput.current.value = '';
      fileInput.current.click();
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = fileTarget.current;
    if (!file || !target) return;
    await runUpload(file, target);
  }

  async function runUpload(
    file: File,
    target: { section: string; lesson: string; kind: 'video' | 'resource' | 'presentation' },
  ) {
    setError('');
    if (target.kind === 'presentation') {
      setPresentationProgress(0);
      try {
        const url = await uploadFile(file, 'resources', setPresentationProgress);
        setPresentationUrl(url);
        setDirty(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The upload failed.');
      } finally {
        setPresentationProgress(null);
      }
      return;
    }

    patchLesson(target.section, target.lesson, { progress: 0 }, false);
    try {
      const url = await uploadFile(file, target.kind === 'video' ? 'videos' : 'resources', (pct) =>
        patchLesson(target.section, target.lesson, { progress: pct }, false),
      );

      setSections((prev) =>
        prev.map((section) =>
          section.key !== target.section
            ? section
            : {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.key !== target.lesson
                    ? lesson
                    : target.kind === 'video'
                      ? { ...lesson, videoUrl: url, progress: null }
                      : { ...lesson, resources: [...lesson.resources, { name: file.name, url }], progress: null },
                ),
              },
        ),
      );
      setDirty(true);
    } catch (err) {
      patchLesson(target.section, target.lesson, { progress: null }, false);
      setError(err instanceof Error ? err.message : 'The upload failed.');
    }
  }

  async function save(): Promise<boolean> {
    const session = getStoredAcademySession();
    if (!session || !details) return false;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/academy/instructor/courses/${encodeURIComponent(courseId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
        body: JSON.stringify({
          title: details.title,
          subtitle: details.subtitle,
          description: details.description,
          category: details.category,
          level: details.level,
          price: Number(details.price || 0),
          outcomes: details.outcomes.split('\n'),
          exam,
          presentationUrl,
          sections: (sections[0]?.lessons || []).reduce<{ title: string; lessons: unknown[] }[]>((groups, lesson) => {
            const title = lesson.sectionTitle.trim();
            const item = {
              id: lesson.id,
              title: lesson.title,
              type: lesson.type,
              videoUrl: lesson.videoUrl,
              minutes: lesson.minutes,
              text: lesson.text,
              preview: lesson.preview,
              resources: lesson.resources,
            };
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.title === title) lastGroup.lessons.push(item);
            else groups.push({ title, lessons: [item] });
            return groups;
          }, []),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(payload.message || 'The course could not be saved.');
        return false;
      }
      setDirty(false);
      setNotice('Saved.');
      // Reload so new lessons get their ids.
      await load();
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    const session = getStoredAcademySession();
    if (!session) return;
    const ok = await confirm({
      title: 'Send this course to our team?',
      message: 'Our team will review it. You will not be able to edit it while it is being reviewed.',
      confirmLabel: 'Send for review',
    });
    if (!ok) return;

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      if (!(await save())) return;

      const response = await fetch(`/api/academy/instructor/courses/${encodeURIComponent(courseId)}/submit`, {
        method: 'POST',
        headers: getAuthJson(session),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(payload.message || 'The course could not be sent.');
        return;
      }
      setNotice('Your course was sent to our team. We will email you when we have reviewed it.');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCourse() {
    const session = getStoredAcademySession();
    if (!session) return;
    const ok = await confirm({
      title: 'Delete this draft?',
      message: 'The course and its lessons will be deleted. This cannot be undone.',
      confirmLabel: 'Delete the draft',
      danger: true,
    });
    if (!ok) return;

    const response = await fetch(`/api/academy/instructor/courses/${encodeURIComponent(courseId)}`, {
      method: 'DELETE',
      headers: getAcademyAuthHeader(session),
    });
    if (response.ok) {
      setDirty(false);
      window.location.assign('/academy/instructor/courses');
    } else {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'The course could not be deleted.');
    }
  }

  const status = loaded ? courseStatusLabel({ review_status: loaded.course.reviewStatus, is_published: loaded.course.isPublished }) : null;
  const totalLessons = sections.reduce((sum, section) => sum + section.lessons.length, 0);

  const STEP_TITLES = [
    ['Course info & details', 'Enter the foundational information for your course. You can switch between the steps at any time.'],
    ['Pricing', 'Set your price. Our team designs the cover image before your course goes online.'],
    ['Curriculum & lessons', 'Add your lessons one after the other, with their videos and resources.'],
    ['Final exam', 'Write the exam learners must pass to earn the certificate.'],
    ['Review & send', 'Check everything, then send your course to our team for review.'],
  ] as const;

  const validQuestion = (question: ExamQuestion) =>
    question.question.trim().length > 0 &&
    question.options.filter((option) => option.text.trim()).length >= 2 &&
    question.correctOptionIds.length > 0;

  const lessonsComplete =
    totalLessons > 0 &&
    sections.every((section) =>
      section.lessons.every((lesson) => lesson.title.trim() && (lesson.type === 'article' ? lesson.text.trim() : lesson.videoUrl.trim())),
    );

  const checks = details
    ? [
        { ok: details.title.trim().length >= 3, label: 'A title for your course' },
        { ok: details.description.trim().length >= 80, label: 'A description of at least a few sentences' },
        { ok: totalLessons > 0, label: 'At least one lesson' },
        { ok: lessonsComplete, label: 'Every lesson has a title and its video' },
        { ok: exam.questions.filter(validQuestion).length >= 3, label: 'A final exam with at least 3 complete questions' },
      ]
    : [];
  const allOk = checks.length > 0 && checks.every((item) => item.ok);
  const last = STEP_TITLES.length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#fbfbfe] text-[#191625]">
      <input ref={fileInput} type="file" className="hidden" onChange={onFile} />
      {dialog}

      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e4ddf4] bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/academy/instructor/courses"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Courses</span>
          </Link>
          <span className="h-5 w-px shrink-0 bg-[#e4ddf4]" />
          <span className="max-w-[160px] truncate text-base font-black sm:max-w-xs lg:max-w-md">{details?.title || 'New course'}</span>
          {status ? <span className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-black sm:inline-block ${status.style}`}>{status.label}</span> : null}
        </div>

        <div className="hidden items-center gap-1.5 rounded-2xl bg-[#f1eef8] p-1.5 md:flex">
          {STEP_TITLES.map(([label], index) => {
            const number = index + 1;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(number)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition lg:text-sm ${
                  step === number ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#625b75] hover:bg-white/70'
                }`}
              >
                <span className={`flex size-6 items-center justify-center rounded-lg text-xs font-black ${step === number ? 'bg-white/20 text-white' : 'bg-[#e4ddf4] text-[#3b3650]'}`}>{number}</span>
                <span className="hidden xl:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/academy/instructor/courses" aria-label="Close" className="rounded-xl p-2 text-[#8e879f] transition hover:bg-[#f1eef8] hover:text-[#3b3650]">
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Work area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl space-y-6">
          {!loaded || !details ? (
            error ? (
              <p className="text-sm font-semibold text-[#c0264b]">{error}</p>
            ) : (
              <FormSkeleton />
            )
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-black sm:text-3xl">
                  Step {step}: {STEP_TITLES[step - 1][0]}
                </h1>
                <p className="mt-1.5 text-sm text-[#5f5872]">{STEP_TITLES[step - 1][1]}</p>
              </div>

              {loaded.course.reviewStatus === 'changes_requested' && loaded.course.reviewNote ? (
                <div className="rounded-2xl border border-[#f1d3d3] bg-[#fff8f8] p-5 text-sm text-[#5a2b2b]">
                  <strong>Our team asked for changes:</strong>
                  <p className="mt-1 whitespace-pre-line">{loaded.course.reviewNote}</p>
                </div>
              ) : null}

              {!editable ? (
                <div className="rounded-2xl border border-[#e4ddf4] bg-white p-5 text-sm text-[#5f5872]">
                  {loaded.course.isPublished
                    ? 'This course is published. To change it, write to contacts@easymedicaldevice.com.'
                    : 'This course is with our team for review, so it is read only. We will email you the result.'}
                </div>
              ) : null}

              {step === 1 ? (
                <>
            {/* Details */}
            <div className="space-y-5 rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8">
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">Title *</span>
                <input className={`${inputClass} mt-1.5`} value={details.title} onChange={(e) => setDetail('title', e.target.value)} disabled={!editable} maxLength={140} />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">Short subtitle</span>
                <input className={`${inputClass} mt-1.5`} value={details.subtitle} onChange={(e) => setDetail('subtitle', e.target.value)} disabled={!editable} maxLength={240} placeholder="One sentence that sells the course" />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">Description *</span>
                <textarea className={`${inputClass} mt-1.5`} rows={6} value={details.description} onChange={(e) => setDetail('description', e.target.value)} disabled={!editable} maxLength={8000} placeholder="What the course covers, who it is for and how it helps." />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[#302945]">Category</span>
                  <select className={`${inputClass} mt-1.5`} value={details.category} onChange={(e) => setDetail('category', e.target.value)} disabled={!editable}>
                    {[...new Set([details.category, ...CATEGORIES])].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-[#302945]">Level</span>
                  <select className={`${inputClass} mt-1.5`} value={details.level} onChange={(e) => setDetail('level', e.target.value)} disabled={!editable}>
                    {LEVELS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">What learners will learn</span>
                <span className="ml-2 text-xs text-[#8e879f]">one point per line</span>
                <textarea className={`${inputClass} mt-1.5`} rows={5} value={details.outcomes} onChange={(e) => setDetail('outcomes', e.target.value)} disabled={!editable} />
              </label>
            </div>

                </>
              ) : null}

              {step === 2 ? (
                <>
            <div className="space-y-5 rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8">
              <label className="block max-w-xs">
                <span className="text-sm font-bold text-[#302945]">Price (USD)</span>
                <input className={`${inputClass} mt-1.5`} type="number" min={0} step={1} value={details.price} onChange={(e) => setDetail('price', e.target.value)} disabled={!editable} placeholder="0 = free" />
              </label>
              <p className="rounded-xl bg-[#f6f4fb] p-4 text-xs leading-5 text-[#6e687d]">
                You do not need to upload a cover image: our team designs it before the course goes online. Learners
                who pass your final exam receive the Academy certificate. Our team may adjust the price.
              </p>
            </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
            {/* Course presentation: one for the whole course */}
            <div className="rounded-2xl border border-[#e4ddf4] bg-white p-5 sm:p-6">
              <div className="flex items-start gap-2.5">
                <Presentation className="mt-0.5 size-5 shrink-0 text-[#7c3aed]" aria-hidden="true" />
                <div>
                  <p className="text-base font-black">
                    Course presentation <span className="text-sm font-semibold text-[#8e879f]">(optional)</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[#6e687d]">
                    One presentation for the whole course. Learners see it in a <b>Presentation</b> tab in every lesson, next
                    to the video, and can download it. Upload a PDF or PowerPoint, or paste a Google Slides link.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div
                  onDragOver={(event) => {
                    if (!editable) return;
                    event.preventDefault();
                    setDragKey('presentation');
                  }}
                  onDragLeave={() => setDragKey(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragKey(null);
                    const file = event.dataTransfer.files?.[0];
                    if (file && editable && presentationProgress == null) {
                      void runUpload(file, { section: '', lesson: '', kind: 'presentation' });
                    }
                  }}
                  className={`flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    dragKey === 'presentation'
                      ? 'border-[#7c3aed] bg-[#f1ebff]'
                      : presentationUrl && presentationProgress == null
                        ? 'border-[#9fe0c2] bg-[#f3fcf8]'
                        : 'border-[#c4b5fd] bg-[#faf8ff]'
                  }`}
                >
                  {presentationProgress != null ? (
                    <div className="w-full max-w-md">
                      <p className="text-4xl font-black text-[#7c3aed]">{presentationProgress}%</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#ece8f7]">
                        <div className="h-full rounded-full bg-[#7c3aed] transition-all" style={{ width: `${presentationProgress}%` }} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#302945]">Uploading your slides...</p>
                      <p className="text-xs text-[#6e687d]">Keep this page open until it reaches 100%.</p>
                    </div>
                  ) : presentationUrl ? (
                    <>
                      <span className="flex size-14 items-center justify-center rounded-full bg-[#10b981] text-white">
                        <Check className="size-7" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-base font-black text-[#0f6f4d]">Presentation added</p>
                        <p className="mx-auto mt-0.5 max-w-xs truncate text-xs text-[#6e687d] sm:max-w-md">{presentationUrl}</p>
                      </div>
                      {editable ? (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => pickFile('', '', 'presentation')}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] hover:border-[#7c3aed]"
                          >
                            <Upload className="size-4 text-[#7c3aed]" aria-hidden="true" /> Replace the slides
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPresentationUrl('');
                              setDirty(true);
                            }}
                            className="text-sm font-bold text-[#c0264b] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="flex size-16 items-center justify-center rounded-full bg-[#f1ebff] text-[#7c3aed]">
                        <Presentation className="size-8" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-lg font-black">Upload your slides</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-[#5f5872]">
                          Drag and drop the file here, or choose it on your computer.
                        </p>
                        <p className="mt-1 text-xs text-[#8e879f]">PDF or PowerPoint (.pptx)</p>
                      </div>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => pickFile('', '', 'presentation')}
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7c3aed] px-6 text-sm font-black text-white transition hover:bg-[#6d31dc]"
                        >
                          <Upload className="size-4" aria-hidden="true" /> Choose a file
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[#8e879f]">
                  <span className="h-px flex-1 bg-[#e4ddf4]" />
                  or use a link
                  <span className="h-px flex-1 bg-[#e4ddf4]" />
                </div>
                <input
                  className={inputClass}
                  value={presentationUrl}
                  onChange={(e) => {
                    setPresentationUrl(e.target.value);
                    setDirty(true);
                  }}
                  disabled={!editable}
                  placeholder="Paste a link to your slides (Google Slides or a PDF)"
                />
              </div>
            </div>

            {/* Curriculum */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">
                  Lessons <span className="text-sm font-semibold text-[#8e879f]">({totalLessons})</span>
                </h2>
              </div>

              {sections.slice(0, 1).map((section) => (
                <div key={section.key} className="rounded-2xl border border-[#e4ddf4] bg-white p-5 sm:p-6">
                  <div className="space-y-4">
                    {section.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.key} className="rounded-xl border border-[#ede8fb] bg-[#faf8ff] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-black text-white">{lessonIndex + 1}</span>
                          <input
                            className={`${inputClass} min-w-0 flex-1`}
                            value={lesson.title}
                            onChange={(e) => patchLesson(section.key, lesson.key, { title: e.target.value })}
                            disabled={!editable}
                            placeholder="Lesson title"
                            maxLength={160}
                          />
                          {editable ? (
                            <>
                              <IconButton label="Move up" onClick={() => updateSections(sections.map((s) => (s.key === section.key ? { ...s, lessons: move(s.lessons, lessonIndex, -1) } : s)))}><ArrowUp className="size-4" /></IconButton>
                              <IconButton label="Move down" onClick={() => updateSections(sections.map((s) => (s.key === section.key ? { ...s, lessons: move(s.lessons, lessonIndex, 1) } : s)))}><ArrowDown className="size-4" /></IconButton>
                              <IconButton label="Delete lesson" danger onClick={() => updateSections(sections.map((s) => (s.key === section.key ? { ...s, lessons: s.lessons.filter((l) => l.key !== lesson.key) } : s)))}><Trash2 className="size-4" /></IconButton>
                            </>
                          ) : null}
                        </div>

                        <label className="mt-3 block">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#6e687d]">Section / Module</span>
                          <input
                            className={`${inputClass} mt-1`}
                            value={lesson.sectionTitle}
                            onChange={(e) => patchLesson(section.key, lesson.key, { sectionTitle: e.target.value })}
                            disabled={!editable}
                            placeholder="e.g. Module 1: Classification"
                            maxLength={120}
                          />
                        </label>

                        {lesson.type === 'video' ? (
                          <div className="mt-4 space-y-3">
                            <div
                              onDragOver={(event) => {
                                if (!editable) return;
                                event.preventDefault();
                                setDragKey(lesson.key);
                              }}
                              onDragLeave={() => setDragKey(null)}
                              onDrop={(event) => {
                                event.preventDefault();
                                setDragKey(null);
                                const file = event.dataTransfer.files?.[0];
                                if (file && editable && lesson.progress == null) {
                                  void runUpload(file, { section: section.key, lesson: lesson.key, kind: 'video' });
                                }
                              }}
                              className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                                dragKey === lesson.key
                                  ? 'border-[#7c3aed] bg-[#f1ebff]'
                                  : lesson.videoUrl && lesson.progress == null
                                    ? 'border-[#9fe0c2] bg-[#f3fcf8]'
                                    : 'border-[#c4b5fd] bg-[#faf8ff]'
                              }`}
                            >
                              {lesson.progress != null ? (
                                <div className="w-full max-w-md">
                                  <p className="text-4xl font-black text-[#7c3aed]">{lesson.progress}%</p>
                                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#ece8f7]">
                                    <div className="h-full rounded-full bg-[#7c3aed] transition-all" style={{ width: `${lesson.progress}%` }} />
                                  </div>
                                  <p className="mt-3 text-sm font-bold text-[#302945]">Uploading your video...</p>
                                  <p className="text-xs text-[#6e687d]">Keep this page open until it reaches 100%.</p>
                                </div>
                              ) : lesson.videoUrl ? (
                                <>
                                  <span className="flex size-14 items-center justify-center rounded-full bg-[#10b981] text-white">
                                    <Check className="size-7" aria-hidden="true" />
                                  </span>
                                  <div>
                                    <p className="text-base font-black text-[#0f6f4d]">Video added</p>
                                    <p className="mx-auto mt-0.5 max-w-xs truncate text-xs text-[#6e687d] sm:max-w-md">{lesson.videoUrl}</p>
                                  </div>
                                  {editable ? (
                                    <button
                                      type="button"
                                      onClick={() => pickFile(section.key, lesson.key, 'video')}
                                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] hover:border-[#7c3aed]"
                                    >
                                      <Upload className="size-4 text-[#7c3aed]" aria-hidden="true" /> Replace the video
                                    </button>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <span className="flex size-16 items-center justify-center rounded-full bg-[#f1ebff] text-[#7c3aed]">
                                    <Upload className="size-8" aria-hidden="true" />
                                  </span>
                                  <div>
                                    <p className="text-lg font-black">Upload your video</p>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-[#5f5872]">
                                      Drag and drop the video file here, or choose it on your computer.
                                    </p>
                                    <p className="mt-1 text-xs text-[#8e879f]">MP4, MOV, M4V or WebM</p>
                                  </div>
                                  {editable ? (
                                    <button
                                      type="button"
                                      onClick={() => pickFile(section.key, lesson.key, 'video')}
                                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7c3aed] px-6 text-sm font-black text-white transition hover:bg-[#6d31dc]"
                                    >
                                      <Upload className="size-4" aria-hidden="true" /> Choose a video file
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs font-semibold text-[#8e879f]">
                              <span className="h-px flex-1 bg-[#e4ddf4]" />
                              or use a link
                              <span className="h-px flex-1 bg-[#e4ddf4]" />
                            </div>
                            <input
                              className={`${inputClass}`}
                              value={lesson.videoUrl}
                              onChange={(e) => patchLesson(section.key, lesson.key, { videoUrl: e.target.value })}
                              disabled={!editable}
                              placeholder="Paste a video link (YouTube, Vimeo...)"
                            />
                          </div>
                        ) : (
                          <p className="mt-3 rounded-xl bg-[#f6f4fb] p-4 text-xs leading-5 text-[#6e687d]">
                            This is a text lesson added by our team. It is shown to learners as written.
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#625b75]">
                          <label className="inline-flex items-center gap-2">
                            Length
                            <input
                              type="number"
                              min={0}
                              max={600}
                              value={lesson.minutes}
                              onChange={(e) => patchLesson(section.key, lesson.key, { minutes: Number(e.target.value) })}
                              disabled={!editable}
                              className="w-20 rounded-lg border border-[#d9d1ee] bg-white px-2 py-1.5 text-sm"
                            />
                            min
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={lesson.preview}
                              onChange={(e) => patchLesson(section.key, lesson.key, { preview: e.target.checked })}
                              disabled={!editable}
                              className="size-4 accent-[#7c3aed]"
                            />
                            Free preview
                          </label>
                          <FreePreviewHelp />
                        </div>

                        <div className="mt-4 rounded-xl border border-dashed border-[#d9d1ee] bg-white p-4">
                          <div className="flex items-start gap-2.5">
                            <FileText className="mt-0.5 size-4 shrink-0 text-[#7c3aed]" aria-hidden="true" />
                            <div>
                              <p className="text-sm font-black">Lesson resources <span className="font-semibold text-[#8e879f]">(optional)</span></p>
                              <p className="text-xs leading-5 text-[#6e687d]">
                                Files and links learners can open with this lesson: slides, a PDF, a spreadsheet, a useful website.
                              </p>
                            </div>
                          </div>
                        <div className="mt-3 space-y-2">
                          {lesson.resources.length === 0 ? <p className="text-xs text-[#8e879f]">No resource added to this lesson yet.</p> : null}
                          {lesson.resources.map((resource, resourceIndex) => (
                            <div key={resourceIndex} className="flex items-center gap-2">
                              <Link2 className="size-4 shrink-0 text-[#7c3aed]" aria-hidden="true" />
                              <input
                                className={`${inputClass} w-40 sm:w-56`}
                                value={resource.name}
                                onChange={(e) => patchLesson(section.key, lesson.key, { resources: lesson.resources.map((r, i) => (i === resourceIndex ? { ...r, name: e.target.value } : r)) })}
                                disabled={!editable}
                                placeholder="Resource name (e.g. Slides)"
                              />
                              <input
                                className={`${inputClass} min-w-0 flex-1`}
                                value={resource.url}
                                onChange={(e) => patchLesson(section.key, lesson.key, { resources: lesson.resources.map((r, i) => (i === resourceIndex ? { ...r, url: e.target.value } : r)) })}
                                disabled={!editable}
                                placeholder="Link: https://..."
                              />
                              {editable ? (
                                <IconButton label="Remove resource" danger onClick={() => patchLesson(section.key, lesson.key, { resources: lesson.resources.filter((_, i) => i !== resourceIndex) })}>
                                  <Trash2 className="size-4" />
                                </IconButton>
                              ) : null}
                            </div>
                          ))}
                          {editable ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => patchLesson(section.key, lesson.key, { resources: [...lesson.resources, { name: '', url: '' }] })}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9d1ee] bg-white px-3 text-xs font-bold text-[#302945] hover:border-[#7c3aed]"
                              >
                                <Link2 className="size-3.5 text-[#7c3aed]" aria-hidden="true" /> Add a resource link
                              </button>
                              <button
                                type="button"
                                onClick={() => pickFile(section.key, lesson.key, 'resource')}
                                disabled={lesson.progress != null}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9d1ee] bg-white px-3 text-xs font-bold text-[#302945] hover:border-[#7c3aed] disabled:opacity-60"
                              >
                                <Upload className="size-3.5 text-[#7c3aed]" aria-hidden="true" /> Upload a resource file (PDF, Word, Excel...)
                              </button>
                            </div>
                          ) : null}
                        </div>
                        </div>
                      </div>
                    ))}

                    {editable ? (
                      <button
                        type="button"
                        onClick={() => updateSections(sections.map((s) => (s.key === section.key ? { ...s, lessons: [...s.lessons, { ...blankLesson(), sectionTitle: s.lessons[s.lessons.length - 1]?.sectionTitle || '' }] } : s)))}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[#c4b5fd] px-3 text-xs font-bold text-[#7c3aed] hover:bg-[#f4f0ff]"
                      >
                        <Plus className="size-3.5" aria-hidden="true" /> Add a lesson
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

                </>
              ) : null}

              {step === 4 ? (
                <>
            {/* Final exam */}
            <div className="rounded-2xl border border-[#e4ddf4] bg-white p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">
                    Final exam <span className="text-sm font-semibold text-[#8e879f]">({exam.questions.length} questions)</span>
                  </h2>
                  <p className="mt-1 text-sm text-[#5f5872]">
                    Learners who pass receive the certificate. Write at least 3 questions.
                  </p>
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => updateExam({ ...exam, questions: [...exam.questions, blankQuestion()] })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9d1ee] bg-white px-3 text-xs font-bold text-[#302945] hover:border-[#7c3aed]"
                  >
                    <Plus className="size-3.5" aria-hidden="true" /> Add a question
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-[#302945]">
                  Passing score (%)
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={exam.passingScore}
                    onChange={(e) => updateExam({ ...exam, passingScore: Number(e.target.value) })}
                    disabled={!editable}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <label className="block text-sm font-bold text-[#302945]">
                  Time limit (minutes)
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={exam.timeLimitMinutes}
                    onChange={(e) => updateExam({ ...exam, timeLimitMinutes: Number(e.target.value) })}
                    disabled={!editable}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {exam.questions.map((question, index) => (
                  <div key={question.key} className="rounded-xl border border-[#ede8fb] bg-[#faf8ff] p-4">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-black text-white">{index + 1}</span>
                      <textarea
                        className={`${inputClass} min-w-0 flex-1`}
                        rows={2}
                        value={question.question}
                        onChange={(e) => patchQuestion(question.key, { question: e.target.value })}
                        disabled={!editable}
                        placeholder="Write the question"
                        maxLength={600}
                      />
                      {editable ? (
                        <IconButton label="Delete question" danger onClick={() => updateExam({ ...exam, questions: exam.questions.filter((q) => q.key !== question.key) })}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2 pl-9">
                      <div className="rounded-xl bg-white p-3 ring-1 ring-[#ede8fb]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black text-[#302945]">Tick the right answer(s)</p>
                          {question.correctOptionIds.length === 0 ? (
                            <span className="rounded-full bg-[#f1eef8] px-2.5 py-0.5 text-[11px] font-bold text-[#6e687d]">Nothing ticked yet</span>
                          ) : question.correctOptionIds.length === 1 ? (
                            <span className="rounded-full bg-[#e8f1ff] px-2.5 py-0.5 text-[11px] font-black text-[#2563eb]">Single choice</span>
                          ) : (
                            <span className="rounded-full bg-[#f1ebff] px-2.5 py-0.5 text-[11px] font-black text-[#7c3aed]">
                              Multiple choice ({question.correctOptionIds.length} right answers)
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-[#6e687d]">
                          Tick <b>one</b> answer and the learner picks one (single choice). Tick <b>several</b> and the learner
                          must pick all of them (multiple choice).
                        </p>
                      </div>
                      {question.options.map((option) => {
                        const right = question.correctOptionIds.includes(option.id);
                        return (
                          <div key={option.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={right}
                              disabled={!editable}
                              onChange={() =>
                                patchQuestion(question.key, {
                                  correctOptionIds: right
                                    ? question.correctOptionIds.filter((id) => id !== option.id)
                                    : [...question.correctOptionIds, option.id],
                                })
                              }
                              className="size-4 shrink-0 accent-[#0f8a5f]"
                              aria-label="This is a right answer"
                            />
                            <input
                              className={`${inputClass} min-w-0 flex-1`}
                              value={option.text}
                              onChange={(e) =>
                                patchQuestion(question.key, {
                                  options: question.options.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)),
                                })
                              }
                              disabled={!editable}
                              placeholder="Answer"
                              maxLength={400}
                            />
                            {editable && question.options.length > 2 ? (
                              <IconButton
                                label="Remove answer"
                                danger
                                onClick={() =>
                                  patchQuestion(question.key, {
                                    options: question.options.filter((o) => o.id !== option.id),
                                    correctOptionIds: question.correctOptionIds.filter((id) => id !== option.id),
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </IconButton>
                            ) : null}
                          </div>
                        );
                      })}
                      {editable && question.options.length < 6 ? (
                        <button
                          type="button"
                          onClick={() =>
                            patchQuestion(question.key, {
                              options: [...question.options, { id: `opt-${Date.now().toString(36)}`, text: '' }],
                            })
                          }
                          className="text-xs font-bold text-[#7c3aed] hover:underline"
                        >
                          + Add an answer
                        </button>
                      ) : null}
                      <input
                        className={`${inputClass} mt-1`}
                        value={question.explanation}
                        onChange={(e) => patchQuestion(question.key, { explanation: e.target.value })}
                        disabled={!editable}
                        placeholder="Explanation shown after the exam (optional)"
                        maxLength={800}
                      />
                    </div>
                  </div>
                ))}

                {editable ? (
                  <button
                    type="button"
                    onClick={() => updateExam({ ...exam, questions: [...exam.questions, blankQuestion()] })}
                    className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#c4b5fd] bg-[#faf8ff] text-center transition hover:border-[#7c3aed] hover:bg-[#f4f0ff] ${exam.questions.length === 0 ? 'min-h-[200px] p-8' : 'p-5'}`}
                  >
                    <span className={`flex items-center justify-center rounded-full bg-[#7c3aed] text-white ${exam.questions.length === 0 ? 'size-14' : 'size-10'}`}>
                      <Plus className={exam.questions.length === 0 ? 'size-7' : 'size-5'} aria-hidden="true" />
                    </span>
                    <span className={`font-black text-[#191625] ${exam.questions.length === 0 ? 'text-lg' : 'text-base'}`}>
                      {exam.questions.length === 0 ? 'Add your first question' : 'Add another question'}
                    </span>
                    <span className="text-xs text-[#6e687d]">
                      {exam.questions.length === 0
                        ? 'Write a question, add its answers and tick the right ones. You need at least 3 questions.'
                        : `${exam.questions.length} question${exam.questions.length === 1 ? '' : 's'} so far. You need at least 3.`}
                    </span>
                  </button>
                ) : exam.questions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#d9d1ee] p-6 text-center text-sm text-[#6e687d]">No question yet.</p>
                ) : null}
              </div>
            </div>

                </>
              ) : null}

              {step === 5 ? (
                <>
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8">
                <span className="block text-xs font-black uppercase tracking-wider text-[#7c3aed]">Academy catalog preview</span>
                <h3 className="mt-2 text-2xl font-black">{details.title || 'Untitled course'}</h3>
                {details.subtitle ? <p className="mt-1 text-sm text-[#5f5872]">{details.subtitle}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[#f4f0ff] px-3 py-1 text-[#7c3aed]">{details.category}</span>
                  <span className="rounded-full bg-[#f1eef8] px-3 py-1 text-[#6e687d]">{details.level}</span>
                  <span className="rounded-full bg-[#e6f8ef] px-3 py-1 text-[#0f8a5f]">{Number(details.price) > 0 ? `$${Number(details.price).toFixed(2)}` : 'Free'}</span>
                  <span className="rounded-full bg-[#f1eef8] px-3 py-1 text-[#6e687d]">{totalLessons} lesson{totalLessons === 1 ? '' : 's'}</span>
                  <span className="rounded-full bg-[#f1eef8] px-3 py-1 text-[#6e687d]">{exam.questions.length} exam question{exam.questions.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8">
                <h3 className="text-base font-black">Before you send it</h3>
                <ul className="mt-4 space-y-2.5">
                  {checks.map((item) => (
                    <li key={item.label} className="flex items-start gap-3 text-sm">
                      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white ${item.ok ? 'bg-[#10b981]' : 'bg-[#d6d0e6]'}`}>
                        {item.ok ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                      </span>
                      <span className={item.ok ? 'text-[#3b3650]' : 'font-semibold text-[#191625]'}>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 rounded-xl bg-[#f6f4fb] p-4 text-xs leading-5 text-[#6e687d]">
                  After you send it, our team reviews your course, may edit it, designs the cover and publishes it. We
                  email you the result.
                </p>
              </div>

              {editable && loaded.course.reviewStatus === 'draft' ? (
                <button type="button" onClick={removeCourse} className="text-xs font-bold text-[#c0264b] hover:underline">
                  Delete this draft
                </button>
              ) : null}
            </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e4ddf4] bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(25,22,37,0.04)] sm:px-6">
        {step === 1 ? (
          <Link href="/academy/instructor/courses" className="inline-flex h-10 items-center rounded-xl border border-[#d9d1ee] px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f8f6ff]">
            Exit
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d1ee] px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f8f6ff]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Previous step
          </button>
        )}

        <p className={`hidden text-xs font-semibold md:block ${error ? 'text-[#c0264b]' : notice ? 'text-[#0f8a5f]' : 'text-[#8e879f]'}`}>
          {error || notice || (editable ? (dirty ? 'You have unsaved changes.' : 'All changes saved.') : '')}
        </p>

        <div className="flex items-center gap-2">
          {editable ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || submitting}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:border-[#7c3aed] disabled:opacity-60"
            >
              {saving && !submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              Save draft
            </button>
          ) : null}
          {step < last ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7c3aed] px-6 text-sm font-black text-white transition hover:bg-[#6d31dc]"
            >
              Next step <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : editable ? (
            <button
              type="button"
              onClick={() => void submitForReview()}
              disabled={saving || submitting || !allOk}
              title={allOk ? undefined : 'Complete the list above first'}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#10b981] px-6 text-sm font-black text-white transition hover:bg-[#0f9f70] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              Send for review
            </button>
          ) : (
            <Link href="/academy/instructor/courses" className="inline-flex h-10 items-center rounded-xl bg-[#7c3aed] px-6 text-sm font-black text-white transition hover:bg-[#6d31dc]">
              Back to my courses
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function getAuthJson(session: NonNullable<ReturnType<typeof getStoredAcademySession>>) {
  return { 'content-type': 'application/json', ...getAcademyAuthHeader(session) };
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e4ddf4] bg-white transition ${
        danger ? 'text-[#c0264b] hover:bg-[#fff5f5]' : 'text-[#625b75] hover:border-[#7c3aed] hover:text-[#7c3aed]'
      }`}
    >
      {children}
    </button>
  );
}

/** A small "?" that explains what a free preview is and why it helps. */
function FreePreviewHelp() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="What is a free preview?"
        aria-expanded={open}
        className="flex size-5 items-center justify-center rounded-full text-[#8e879f] transition hover:text-[#7c3aed]"
      >
        <HelpCircle className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-72 -translate-x-1/2 rounded-xl border border-[#ded6f3] bg-white p-4 text-left text-xs font-normal leading-5 text-[#3b3650] shadow-[0_12px_40px_rgba(25,22,37,0.18)] sm:w-80"
        >
          <b className="block text-sm text-[#191625]">What is a free preview?</b>
          <span className="mt-1 block">
            A free preview lesson can be watched by anyone, even before they buy the course and without an account.
            It is a sample of your course.
          </span>
          <b className="mt-3 block text-sm text-[#191625]">Why it helps</b>
          <span className="mt-1 block">
            People enroll more easily when they can try a course first: they see your voice, your teaching style and the
            quality of your videos.
          </span>
          <span className="mt-3 block rounded-lg bg-[#f4f0ff] p-2.5 font-semibold text-[#5b21b6]">
            Tip: make 1 or 2 lessons free, for example your introduction, and keep the rest for learners who enroll.
          </span>
        </span>
      ) : null}
    </span>
  );
}
