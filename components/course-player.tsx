'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  LockKeyhole,
  Maximize,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minus,
  MoreHorizontal,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  PlayCircle,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Subtitles,
  ThumbsUp,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import {
  type CourseCurriculum,
  type CourseLesson,
  type CourseSection,
  getCurriculumForCourse,
} from '@/lib/curriculum-data';
import {
  getAcademyDisplayName,
  getAcademyAuthHeader,
  getStoredAcademySession,
  type AcademySession,
} from '@/lib/academy-session';
import {
  getStoredCourseProgress,
  markCourseStarted,
  saveStoredLessonProgress,
} from '@/lib/academy-learning-state';
import {
  buildCertificateSvg,
  downloadCertificatePdf,
  formatCertificateDate,
  openLinkedInCertificate as shareCertificateOnLinkedIn,
} from '@/lib/academy-certificate';
import { PlayerSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type CoursePlayerProps = {
  courseId?: string;
  freeCourse?: boolean;
};

type NoteItem = {
  id: string;
  timestamp: string;
  seconds: number;
  lessonTitle: string;
  content: string;
};

type QAItem = {
  id: string;
  author: string;
  role: string;
  timeAgo: string;
  question: string;
  votes: number;
  answers: {
    author: string;
    role: string;
    isInstructor?: boolean;
    content: string;
    timeAgo: string;
  }[];
};

type QuizOption = {
  id: string;
  text: string;
};

type QuizQuestion = {
  _key?: string;
  question: string;
  options: QuizOption[];
  correctOptionId?: string;
  correctOptionIds?: string[];
  explanation?: string;
};

type QuizMeta = {
  passingScore: number;
  certificateTitle: string;
  certificateEnabled: boolean;
};

type IssuedCertificate = {
  certificate_number?: string;
  issued_at?: string;
};

function parseQuizMeta(description?: string): QuizMeta {
  const fallback: QuizMeta = {
    passingScore: 80,
    certificateTitle: 'Certificate of Completion',
    certificateEnabled: true,
  };

  if (!description) return fallback;

  try {
    const parsed = JSON.parse(description) as Partial<QuizMeta>;
    return {
      passingScore:
        typeof parsed.passingScore === 'number'
          ? parsed.passingScore
          : fallback.passingScore,
      certificateTitle:
        typeof parsed.certificateTitle === 'string' && parsed.certificateTitle.trim()
          ? parsed.certificateTitle
          : fallback.certificateTitle,
      certificateEnabled: parsed.certificateEnabled !== false,
    };
  } catch {
    return fallback;
  }
}

function parseQuizQuestions(lesson?: CourseLesson): QuizQuestion[] {
  return (lesson?.resources || [])
    .filter((resource) => resource.type === 'quiz_question' && resource.url)
    .map((resource) => {
      try {
        return JSON.parse(resource.url || '') as QuizQuestion;
      } catch {
        return null;
      }
    })
    .filter((question): question is QuizQuestion =>
      Boolean(question?.question && question.options?.length),
    );
}

function getCorrectQuizOptionIds(question: QuizQuestion) {
  if (question.correctOptionIds?.length) return question.correctOptionIds;
  return question.correctOptionId ? [question.correctOptionId] : [];
}

function isQuizQuestionCorrect(question: QuizQuestion, answers: string[] = []) {
  const correctIds = getCorrectQuizOptionIds(question).sort();
  const selectedIds = [...answers].sort();

  return (
    correctIds.length > 0 &&
    correctIds.length === selectedIds.length &&
    correctIds.every((id, index) => id === selectedIds[index])
  );
}

function formatQuizTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getEmbedUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('youtube.com/watch?v=', 'youtube.com/embed/');
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const id = url.split('vimeo.com/')[1]?.split(/[?#]/)[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

function isEmbedUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com');
}

export function CoursePlayer({
  courseId = 'eu-mdr-technical-file',
  freeCourse = false,
}: CoursePlayerProps) {
  const [curriculum, setCurriculum] = useState<CourseCurriculum>(() => getCurriculumForCourse(courseId));
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/academy/curriculum?courseId=${encodeURIComponent(courseId)}`)
      .then((res) => res.json())
      .then((data: any) => {
        if (active && data?.curriculum) {
          setCurriculum(data.curriculum);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [courseId]);

  const [academySession, setAcademySession] = useState<
    AcademySession | null | undefined
  >(undefined);
  const [issuedCertificate, setIssuedCertificate] =
    useState<IssuedCertificate | null>(null);
  const [accessState, setAccessState] = useState<
    'checking' | 'ready' | 'blocked' | 'preview'
  >('checking');
  const [accessMessage, setAccessMessage] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);

  // Track completed lessons
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(() => {
    return new Set<string>();
  });

  // Active section & lesson
  const allLessons = useMemo(() => {
    return curriculum.sections.flatMap((s) => s.lessons);
  }, [curriculum]);
  const previewLessons = useMemo(() => {
    return allLessons.filter((lesson) => lesson.previewEnabled);
  }, [allLessons]);

  const [activeLessonId, setActiveLessonId] = useState<string>(() => {
    // Default to first incomplete lesson, or first lesson
    const firstIncomplete = allLessons.find((l) => !completedLessonIds.has(l.id));
    return firstIncomplete?.id || allLessons[0]?.id || 'les-1';
  });

  const activeLesson = useMemo(() => {
    return allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  }, [allLessons, activeLessonId]);
  const learnerName = useMemo(
    () => getAcademyDisplayName(academySession || getStoredAcademySession()),
    [academySession],
  );
  const quizMeta = useMemo(() => parseQuizMeta(activeLesson?.description), [activeLesson]);
  const quizQuestions = useMemo(() => parseQuizQuestions(activeLesson), [activeLesson]);
  const visibleResources = useMemo(
    () =>
      (activeLesson?.resources || []).filter(
        (resource) => resource.type !== 'quiz_question',
      ),
    [activeLesson],
  );

  const hasFullAccess = Boolean(academySession && accessState === 'ready');
  const isPreviewMode = accessState === 'preview';
  const canAccessLesson = (lesson?: CourseLesson) => {
    if (!lesson) return false;
    return hasFullAccess || Boolean(lesson.previewEnabled);
  };

  const signInToUnlock = () => {
    window.location.assign(
      `/academy/login?next=${encodeURIComponent(`/academy/learn/${courseId}`)}`,
    );
  };

  useEffect(() => {
    const requestedLessonId =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('lesson');
    const requestedLesson = requestedLessonId
      ? allLessons.find((lesson) => lesson.id === requestedLessonId)
      : null;

    if (requestedLesson && canAccessLesson(requestedLesson)) {
      setActiveLessonId(requestedLesson.id);
      return;
    }

    if (isPreviewMode && activeLesson && !activeLesson.previewEnabled && previewLessons[0]) {
      setActiveLessonId(previewLessons[0].id);
    }
  }, [allLessons, activeLesson, courseId, hasFullAccess, isPreviewMode, previewLessons]);

  // Reset playback on lesson change
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [activeLessonId]);

  // Sidebar controls
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'content' | 'ai'>('content');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    curriculum.sections.forEach((sec) => {
      initial[sec.id] = true;
    });
    return initial;
  });

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'notes' | 'announcements' | 'reviews' | 'resources'>('overview');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [quizSecondsLeft, setQuizSecondsLeft] = useState<number | null>(null);
  const [quizAttempt, setQuizAttempt] = useState(0);
  const submitQuizRef = useRef<() => void>(() => {});
  const quizCorrectCount = quizQuestions.filter((question, index) =>
    isQuizQuestionCorrect(
      question,
      quizAnswers[question._key || `question-${index}`] || [],
    ),
  ).length;
  const answeredQuizCount = quizQuestions.filter((question, index) => {
    const questionKey = question._key || `question-${index}`;
    return (quizAnswers[questionKey] || []).length > 0;
  }).length;
  const quizScore = quizQuestions.length
    ? Math.round((quizCorrectCount / quizQuestions.length) * 100)
    : 0;
  const quizPassed = quizSubmitted && quizScore >= quizMeta.passingScore;
  const incorrectQuizQuestionNumbers = quizQuestions
    .map((question, index) =>
      isQuizQuestionCorrect(
        question,
        quizAnswers[question._key || `question-${index}`] || [],
      )
        ? null
        : index + 1,
    )
    .filter((index): index is number => index !== null);
  const allQuizQuestionsAnswered =
    quizQuestions.length > 0 && answeredQuizCount === quizQuestions.length;
  const certificateNumber =
    issuedCertificate?.certificate_number ||
    `EMDA-${new Date().getFullYear()}-${courseId
      .slice(0, 4)
      .toUpperCase()}-${(academySession?.user.id || 'ACADEMY')
      .slice(0, 8)
      .toUpperCase()}`;
  const certificateIssuedDate = formatCertificateDate(issuedCertificate?.issued_at);
  const quizCertificateReady =
    activeLesson?.type === 'quiz' &&
    quizMeta.certificateEnabled &&
    (quizPassed || completedLessonIds.has(activeLesson.id));
  const certificateSvg = useMemo(
    () =>
      buildCertificateSvg({
        learnerName,
        courseTitle: curriculum.title,
        certificateTitle: quizMeta.certificateTitle,
        certificateNumber,
        issuedDate: certificateIssuedDate,
      }),
    [
      learnerName,
      curriculum.title,
      quizMeta.certificateTitle,
      certificateNumber,
      certificateIssuedDate,
    ],
  );
  const certificatePreviewUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(certificateSvg)}`,
    [certificateSvg],
  );

  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setCurrentQuizQuestionIndex(0);
  }, [activeLessonId]);

  // Exam countdown: starts from the lesson duration and auto-submits at 0.
  const quizTimerActive =
    activeLesson?.type === 'quiz' &&
    hasFullAccess &&
    !quizSubmitted &&
    !quizCertificateReady &&
    quizQuestions.length > 0;
  const quizTimeLimitSeconds = activeLesson?.durationSeconds || 0;

  useEffect(() => {
    setQuizSecondsLeft(quizTimeLimitSeconds > 0 ? quizTimeLimitSeconds : null);
  }, [activeLessonId, quizAttempt, quizTimeLimitSeconds]);

  useEffect(() => {
    if (!quizTimerActive || quizSecondsLeft === null) return;
    if (quizSecondsLeft <= 0) {
      submitQuizRef.current();
      return;
    }
    const timeout = window.setTimeout(
      () => setQuizSecondsLeft((value) => (value === null ? null : value - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [quizTimerActive, quizSecondsLeft]);

  useEffect(() => {
    setCurrentQuizQuestionIndex((index) =>
      Math.min(index, Math.max(quizQuestions.length - 1, 0)),
    );
  }, [quizQuestions.length]);

  // Video element sync
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = isMuted ? 0 : volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Rating & Share modals
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Notes state
  const [newNoteText, setNewNoteText] = useState('');
  const [notes, setNotes] = useState<NoteItem[]>([
    {
      id: 'note-1',
      timestamp: '02:15',
      seconds: 135,
      lessonTitle: '5. Manufacturing Information & Verification Evidence',
      content: 'Important: Traceability from ISO 14971 risk controls to verification test protocols must be clearly cross-referenced in Annex II Section 5.',
    },
    {
      id: 'note-2',
      timestamp: '05:30',
      seconds: 330,
      lessonTitle: '4. Device Description & Intended Purpose',
      content: 'Clinical claims in the IFU must strictly mirror the intended purpose defined in Section 1 of the technical dossier.',
    },
  ]);

  // Q&A state
  const [searchQA, setSearchQA] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [showAskForm, setShowAskForm] = useState(false);
  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: 'qa-1',
      author: 'David Meyer',
      role: 'Regulatory Affairs Engineer',
      timeAgo: '1 day ago',
      question: 'For Class IIb implantable devices, does the notified body require full biocompatibility test reports or is an ISO 10993 evaluation summary report sufficient?',
      votes: 14,
      answers: [
        {
          author: 'Monir El Azzouzi',
          role: 'Lead Instructor • Easy Medical Device',
          isInstructor: true,
          timeAgo: '18 hours ago',
          content: 'Hi David! For Class IIb and Class III, notified bodies will ask for the full biological evaluation plan (BEP), the biological evaluation report (BER), and the individual accredited lab test reports. A high-level summary alone is one of the most common causes of Phase 1 non-conformities.',
        },
      ],
    },
    {
      id: 'qa-2',
      author: 'Claire Dufresne',
      role: 'Quality Assurance Manager',
      timeAgo: '4 days ago',
      question: 'Where do we place the GSPR mapping in the Annex II folder hierarchy? Does it go into Section 1 or Section 4?',
      votes: 8,
      answers: [
        {
          author: 'Monir El Azzouzi',
          role: 'Lead Instructor • Easy Medical Device',
          isInstructor: true,
          timeAgo: '3 days ago',
          content: 'Hello Claire! The GSPR matrix typically resides in Section 4 ("General Safety and Performance Requirements") of the Annex II dossier. It serves as the master navigation map connecting every applicable GSPR item to the underlying evidence reports throughout Sections 1-6.',
        },
      ],
    },
  ]);

  // AI Assistant state
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<
    { sender: 'user' | 'ai'; text: string; time: string }[]
  >([
    {
      sender: 'ai',
      text: 'Hello! I am your AI Regulatory Assistant for this masterclass. You can ask me any question about EU MDR, GSPR mappings, classification rules, or guidance documents (MDCG). How can I assist your study today?',
      time: 'Just now',
    },
  ]);

  // Calculate total progress
  const totalLessonsCount = allLessons.length || 1;
  const completedCount = completedLessonIds.size;
  const progressPercent = Math.round((completedCount / totalLessonsCount) * 100);

  useEffect(() => {
    const storedProgress = getStoredCourseProgress(courseId);
    if (storedProgress?.completedLessonIds?.length) {
      const completedIds = new Set(storedProgress.completedLessonIds);
      setCompletedLessonIds((prev) => {
        const next = new Set(prev);
        storedProgress.completedLessonIds.forEach((lessonId) => next.add(lessonId));
        return next;
      });
      const resumeLesson =
        allLessons.find((lesson) => lesson.id === storedProgress.lastLessonId) ||
        allLessons.find((lesson) => !completedIds.has(lesson.id));
      if (resumeLesson) {
        setActiveLessonId(resumeLesson.id);
      }
    }
  }, [allLessons, courseId]);

  useEffect(() => {
    const session = academySession || getStoredAcademySession();
    if (!session) return;

    markCourseStarted({
      id: courseId,
      title: curriculum.title,
      instructor: curriculum.instructor,
      category: 'Academy',
      lessons: totalLessonsCount,
      accent: '#7c3aed',
    });
  }, [academySession, courseId, curriculum.instructor, curriculum.title, totalLessonsCount]);

  useEffect(() => {
    const session = getStoredAcademySession();
    setAcademySession(session);

    if (!session) {
      if (previewLessons.length > 0) {
        setAccessState('preview');
        setAccessMessage('Preview mode: sign in to unlock the full course and save progress.');
      } else {
        setAccessState('blocked');
        setAccessMessage('Sign in to start or continue this course.');
      }
      return;
    }

    let cancelled = false;

    async function unlockCourse() {
      setAccessState('checking');
      try {
        const enrollResponse = await fetch('/api/academy/enroll', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...getAcademyAuthHeader(session),
          },
          body: JSON.stringify({ courseId }),
        });
        const enrollPayload = (await enrollResponse
          .json()
          .catch(() => ({}))) as { message?: string; requiresPayment?: boolean };

        if (cancelled) return;

        if (enrollResponse.status === 401) {
          setAcademySession(null);
          setAccessState('blocked');
          setAccessMessage('Please log in again to continue this course.');
          return;
        }

        if (!enrollResponse.ok && enrollPayload.requiresPayment && !freeCourse) {
          setAccessState('blocked');
          setAccessMessage(
            enrollPayload.message ||
              'Complete checkout to unlock this paid course.',
          );
          return;
        }

        if (!enrollResponse.ok) {
          if (freeCourse) {
            setAccessState('ready');
            return;
          }

          setAccessState('blocked');
          setAccessMessage(
            enrollPayload.message || 'Course access could not be confirmed.',
          );
          return;
        }

        const profileResponse = await fetch('/api/academy/me', {
          headers: getAcademyAuthHeader(session),
        });
        const profile = (await profileResponse.json().catch(() => ({}))) as {
          progress?: Record<string, string[]>;
        };
        const savedLessons = profile.progress?.[courseId] || [];
        const storedProgress = getStoredCourseProgress(courseId);

        if (!cancelled) {
          const mergedLessons = new Set([
            ...savedLessons,
            ...(storedProgress?.completedLessonIds || []),
          ]);
          setCompletedLessonIds(mergedLessons);
          const resumeLesson =
            allLessons.find((lesson) => lesson.id === storedProgress?.lastLessonId) ||
            allLessons.find((lesson) => !mergedLessons.has(lesson.id));
          if (resumeLesson) {
            setActiveLessonId(resumeLesson.id);
          }
          setAccessState('ready');
        }
      } catch {
        if (!cancelled) {
          if (freeCourse) {
            setAccessState('ready');
          } else {
            setAccessState('blocked');
            setAccessMessage('Course access is temporarily unavailable.');
          }
        }
      }
    }

    unlockCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId, freeCourse, previewLessons.length]);

  // Playback timer simulation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const max = activeLesson?.durationSeconds || 900;
          const nextTime = prev + 1;
          if (nextTime >= max * 0.8) {
            markLessonCompleted(activeLesson);
          }
          if (prev >= max) {
            setIsPlaying(false);
            markLessonCompleted(activeLesson);
            return 0;
          }
          return nextTime;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, activeLesson, hasFullAccess]);

  useEffect(() => {
    if (!activeLesson?.videoUrl || !isEmbedUrl(activeLesson.videoUrl) || !hasFullAccess) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.hidden) return;

      setCurrentTime((prev) => {
        const max = activeLesson.durationSeconds || 900;
        const nextTime = Math.min(max, prev + 1);
        if (nextTime >= max * 0.8) {
          markLessonCompleted(activeLesson);
        }
        return nextTime;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeLesson, hasFullAccess]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleQuizAnswer = (
    question: QuizQuestion,
    questionKey: string,
    optionId: string,
  ) => {
    if (quizSubmitted) return;

    const multiple = getCorrectQuizOptionIds(question).length > 1;
    setQuizAnswers((prev) => {
      const current = prev[questionKey] || [];
      return {
        ...prev,
        [questionKey]: multiple
          ? current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId]
          : [optionId],
      };
    });
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
    if (quizQuestions.length && quizScore >= quizMeta.passingScore) {
      markLessonCompleted(activeLesson);
    }
  };

  submitQuizRef.current = submitQuiz;

  const toggleLessonCompleted = (lessonId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasFullAccess) {
      signInToUnlock();
      return;
    }
    setCompletedLessonIds((prev) => {
      const next = new Set(prev);
      let isCompleted = true;
      if (next.has(lessonId)) {
        next.delete(lessonId);
        isCompleted = false;
      } else {
        next.add(lessonId);
      }
      persistLessonProgress(lessonId, isCompleted);
      return next;
    });
  };

  function markLessonCompleted(lesson?: CourseLesson) {
    if (!lesson || !hasFullAccess) return;

    setCompletedLessonIds((prev) => {
      if (prev.has(lesson.id)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(lesson.id);
      persistLessonProgress(lesson.id, true);
      return next;
    });
  }

  const persistLessonProgress = async (lessonId: string, completed: boolean) => {
    const lesson = allLessons.find((item) => item.id === lessonId);
    saveStoredLessonProgress({
      courseId,
      lessonId,
      lessonTitle: lesson?.title,
      completed,
      totalLessons: totalLessonsCount,
      course: {
        id: courseId,
        title: curriculum.title,
        instructor: curriculum.instructor,
        category: 'Academy',
        accent: '#7c3aed',
      },
    });

    const session = academySession || getStoredAcademySession();
    if (!session) return;

    try {
      const response = await fetch('/api/academy/progress', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAcademyAuthHeader(session),
        },
        body: JSON.stringify({
          courseId,
          lessonId,
          completed,
          progressPercent: completed ? 100 : 0,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        certificate?: IssuedCertificate | null;
      };
      if (payload.certificate?.certificate_number) {
        setIssuedCertificate(payload.certificate);
      }
    } catch {
      // The local UI stays responsive; the next page load will reconcile progress.
    }
  };

  const downloadCertificate = () => {
    downloadCertificatePdf({
      learnerName,
      courseTitle: curriculum.title,
      certificateTitle: quizMeta.certificateTitle,
      certificateNumber,
      issuedDate: certificateIssuedDate,
    });
  };

  const openLinkedInCertificate = () => {
    shareCertificateOnLinkedIn({
      certificateTitle: quizMeta.certificateTitle,
      certificateNumber,
      issuedAt: issuedCertificate?.issued_at,
    });
  };

  const startProtectedCheckout = async () => {
    const session = academySession || getStoredAcademySession();
    if (!session) {
      window.location.assign(
        `/academy/login?next=${encodeURIComponent(`/academy/learn/${courseId}`)}`,
      );
      return;
    }

    setCheckoutPending(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAcademyAuthHeader(session),
        },
        body: JSON.stringify({ courseId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
      };

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      setAccessMessage(payload.message || 'Checkout could not be opened.');
    } finally {
      setCheckoutPending(false);
    }
  };

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleNextLesson = () => {
    const currentIndex = allLessons.findIndex((l) => l.id === activeLessonId);
    const nextLesson = allLessons.slice(currentIndex + 1).find(canAccessLesson);
    if (nextLesson) {
      setActiveLessonId(nextLesson.id);
      setCurrentTime(0);
      setIsPlaying(true);
    } else if (!hasFullAccess) {
      signInToUnlock();
    }
  };

  const handlePrevLesson = () => {
    const currentIndex = allLessons.findIndex((l) => l.id === activeLessonId);
    const prevLesson = allLessons.slice(0, currentIndex).reverse().find(canAccessLesson);
    if (prevLesson) {
      setActiveLessonId(prevLesson.id);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      timestamp: formatSeconds(currentTime),
      seconds: currentTime,
      lessonTitle: activeLesson?.title || 'Current Lesson',
      content: newNoteText.trim(),
    };
    setNotes([newNote, ...notes]);
    setNewNoteText('');
  };

  const handleAddQuestion = () => {
    if (!newQuestionTitle.trim() || !newQuestionText.trim()) return;
    const newQA: QAItem = {
      id: `qa-${Date.now()}`,
      author: 'You (Learner)',
      role: 'Regulatory Student',
      timeAgo: 'Just now',
      question: `${newQuestionTitle.trim()}\n\n${newQuestionText.trim()}`,
      votes: 1,
      answers: [],
    };
    setQaList([newQA, ...qaList]);
    setNewQuestionTitle('');
    setNewQuestionText('');
    setShowAskForm(false);
  };

  const handleSendAiMessage = () => {
    if (!aiQuery.trim()) return;
    const userMsg = aiQuery.trim();
    setAiMessages((prev) => [
      ...prev,
      { sender: 'user', text: userMsg, time: 'Just now' },
    ]);
    setAiQuery('');

    // Simulated intelligent regulatory response
    setTimeout(() => {
      let reply = `Under EU MDR 2017/745, regarding "${userMsg}": Ensure that the rationale is documented in your Annex II Technical File and supported by current MDCG guidance. In Section ${activeLesson?.title}, Monir emphasizes cross-referencing your risk management file (ISO 14971) directly to this requirement.`;

      if (userMsg.toLowerCase().includes('rule 11') || userMsg.toLowerCase().includes('software')) {
        reply = 'Rule 11 (Annex VIII) classifies software intended to provide information used to take decisions with diagnosis or therapeutic purposes as Class IIa or higher. Most clinical decision support systems jump from MDD Class I to MDR Class IIa or IIb.';
      } else if (userMsg.toLowerCase().includes('gspr') || userMsg.toLowerCase().includes('annex i')) {
        reply = 'The GSPR (General Safety and Performance Requirements) in Annex I replaces the Essential Requirements of the MDD. You must complete all 23 requirements and cite harmonized standards / common specifications for each.';
      } else if (userMsg.toLowerCase().includes('pmcf') || userMsg.toLowerCase().includes('clinical')) {
        reply = 'Post-Market Clinical Follow-up (PMCF) is a continuous process under MDR Annex XIV Part B. If a proactive PMCF study is deemed not applicable, you must document a detailed clinical justification in the Clinical Evaluation Report (CER).';
      }

      setAiMessages((prev) => [
        ...prev,
        { sender: 'ai', text: reply, time: 'Just now' },
      ]);
    }, 600);
  };

  if (academySession === undefined || accessState === 'checking') {
    return (
      <PlayerSkeleton />
    );
  }

  if (accessState === 'blocked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0c14] px-4 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#171322] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#7c3aed]/20 text-[#b58dfb]">
            <Award className="size-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#34d4c6]">
            Easy Medical Device Academy
          </p>
          <h1 className="mt-3 text-3xl font-black">Course access required</h1>
          <p className="mt-3 text-sm leading-6 text-[#bfb7d4]">
            {accessMessage || 'Sign in or complete checkout to unlock this course.'}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {!academySession ? (
              <>
                <Link
                  href={`/academy/login?next=${encodeURIComponent(`/academy/learn/${courseId}`)}`}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
                >
                  Log in
                </Link>
                <Link
                  href={`/academy/signup?next=${encodeURIComponent(`/academy/learn/${courseId}`)}`}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Create account
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={startProtectedCheckout}
                disabled={checkoutPending}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-wait disabled:opacity-70"
              >
                {checkoutPending ? 'Opening checkout...' : 'Complete checkout'}
              </button>
            )}
          </div>
          <Link
            href="/academy#courses"
            className="mt-5 inline-flex text-sm font-semibold text-[#b58dfb] hover:text-white"
          >
            Back to course catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0e0c14] text-white">
      {/* 1. TOP HEADER (Udemy Style) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#14101e] px-3 sm:px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link
            href="/academy"
            className="group flex flex-col justify-center transition"
          >
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#b8b0cf] group-hover:text-white leading-none transition-colors">
              Easy Medical Device
            </span>
            <span className="text-base sm:text-lg font-black tracking-tight text-[#b58dfb] group-hover:text-white leading-none mt-0.5 transition-colors">
              Academy
            </span>
          </Link>

          <span className="text-white/20">|</span>

          <h1 className="truncate text-xs font-medium text-[#ded8ec] sm:text-sm">
            {curriculum.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Progress Indicator */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-[#d0c9e2] transition hover:bg-white/10"
            >
              <div className="relative flex size-5 items-center justify-center">
                <svg className="size-5 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/20"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#34d4c6] transition-all duration-500"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <Award className="absolute size-2.5 text-[#34d4c6]" />
              </div>
              <span className="hidden sm:inline">Your progress</span>
              <span className="font-bold text-white">{progressPercent}%</span>
              <ChevronDown className="size-3 text-white/50" />
            </button>

            {/* Dropdown Menu */}
            <div className="invisible absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#1a1528] p-4 text-xs shadow-2xl opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 z-50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Course Progress</span>
                <span className="text-[#34d4c6] font-extrabold">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#7c3aed] to-[#34d4c6] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[#9f98b2]">
                {completedCount} of {totalLessonsCount} completed
              </p>
              <div className="mt-3 border-t border-white/10 pt-3">
                <Link
                  href="/academy#certificate"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] py-2 font-bold text-white transition hover:bg-[#6d31dc]"
                >
                  <Award className="size-3.5" />
                  <span>
                    {progressPercent === 100 ? 'Download Certificate' : 'Preview Certificate'}
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-[#d0c9e2] transition hover:bg-white/10"
          >
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>

          {/* Exit / Back to Catalog */}
          <Link
            href="/academy"
            className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#d0c9e2] transition hover:bg-white/10 hover:text-white"
            title="Back to course catalog"
          >
            <X className="size-4" />
          </Link>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT / CENTER: VIDEO PLAYER & TABS AREA */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* VIDEO CANVAS / PLAYER */}
          {activeLesson?.type === 'article' ? (
            <div className="border-b border-white/10 bg-gradient-to-br from-[#1b152b] via-[#100d1a] to-[#05030a] px-5 py-2 text-white sm:px-10 sm:py-3 lg:px-16">
              <article className="w-full">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#7c3aed]/20 px-3 py-1 text-xs font-black text-[#d8c6ff]">
                      Article
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#d8d0ea]">
                      {activeLesson.duration}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => markLessonCompleted(activeLesson)}
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-3 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
                    >
                      <Check className="size-3.5" />
                      Mark complete
                    </button>
                    <button
                      type="button"
                      onClick={handleNextLesson}
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-white/10"
                    >
                      Next
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                <header className="mb-3 px-1">
                  <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                    {activeLesson.title}
                  </h1>
                  {activeLesson.subtitleSummary ? (
                    <p className="mt-2 text-sm leading-6 text-[#c6bed8] sm:text-base">
                      {activeLesson.subtitleSummary}
                    </p>
                  ) : null}
                </header>

                <div className="rounded-lg border border-white/10 bg-[#171322] p-3 shadow-2xl shadow-black/30 sm:p-4">
                  {activeLesson.description ? (
                    /<(h[1-6]|p|div|ul|ol|blockquote|strong|b|em|i|br|hr)/i.test(activeLesson.description) ? (
                      <div
                        className="text-[15px] leading-7 text-[#c6bed8] sm:text-base
                          [&_h1]:mt-4 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:leading-tight [&_h1]:text-white
                          [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-black [&_h2]:leading-tight [&_h2]:text-white
                          [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-[#b58dfb]
                          [&_p]:mb-3 [&_p]:leading-7
                          [&_blockquote]:my-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-[#7c3aed] [&_blockquote]:bg-[#7c3aed]/10 [&_blockquote]:p-3 [&_blockquote]:font-semibold [&_blockquote]:text-white
                          [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6
                          [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6
                          [&_li]:pl-1
                          [&_strong]:font-black [&_strong]:text-white
                          [&_hr]:my-5 [&_hr]:border-white/10
                          [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl
                          [&_iframe]:max-w-full
                          [&_mark]:rounded [&_mark]:bg-amber-400/20 [&_mark]:px-1 [&_mark]:text-amber-200
                          [&_a]:font-bold [&_a]:text-[#b58dfb] [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: activeLesson.description }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#c6bed8] sm:text-base">
                        {activeLesson.description}
                      </p>
                    )
                  ) : (
                    <p className="text-sm italic text-[#8e879f]">
                      No article content has been added for this lesson yet.
                    </p>
                  )}
                </div>
              </article>
            </div>
          ) : activeLesson?.type === 'quiz' ? (
            <div className="border-b border-white/10 bg-gradient-to-br from-[#1b152b] via-[#100d1a] to-[#05030a] px-4 py-8 text-white sm:px-6 lg:py-10">
              <section className="mx-auto max-w-5xl">
                <div className="rounded-xl border border-white/10 bg-[#171322] p-6 shadow-2xl shadow-black/30 sm:p-8">
                  {quizCertificateReady ? (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#34d4c6]">
                            Exam passed
                          </p>
                          <h1 className="mt-2 text-2xl font-black text-white sm:text-4xl">
                            Your certificate is ready
                          </h1>
                          <p className="mt-2 text-sm text-[#b8b0cf]">
                            Credential ID: {certificateNumber}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={downloadCertificate}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#34d4c6] px-4 text-sm font-black text-[#08110f] transition hover:bg-[#5ee7dc]"
                          >
                            <Download className="size-4" />
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={openLinkedInCertificate}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-4 text-sm font-black text-white transition hover:bg-[#004182]"
                          >
                            <Share2 className="size-4" />
                            Add to LinkedIn
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-br from-[#3b0764] via-[#581c87] to-[#1e0847] p-2 shadow-2xl">
                        <div className="overflow-hidden rounded-xl bg-white">
                          <img
                            src={certificatePreviewUrl}
                            alt={`${quizMeta.certificateTitle} certificate`}
                            className="block w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#7c3aed]/20 px-3 py-1 text-xs font-black text-[#d8c6ff]">
                        Certification exam
                      </span>
                      <span className="rounded-full bg-[#34d4c6]/15 px-3 py-1 text-xs font-black text-[#5ee7dc]">
                        Pass {quizMeta.passingScore}%
                      </span>
                      {quizTimerActive && quizSecondsLeft !== null ? (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black tabular-nums ${
                            quizSecondsLeft <= 60
                              ? 'bg-[#fff1f1] text-[#a53232]'
                              : 'bg-white/10 text-[#d8d0ea]'
                          }`}
                        >
                          Time left {formatQuizTime(quizSecondsLeft)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-[#d8d0ea]">
                          {activeLesson.duration}
                        </span>
                      )}
                    </div>
                    {quizSubmitted ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          quizPassed
                            ? 'bg-[#e9fbf8] text-[#067b75]'
                            : 'bg-[#fff1f1] text-[#a53232]'
                        }`}
                      >
                        Score {quizScore}%
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                        {activeLesson.title}
                      </h1>
                      <p className="mt-4 max-w-3xl text-base leading-7 text-[#c6bed8]">
                        Complete the exam one question at a time. Each step tells you whether to choose one answer or multiple answers.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-white">
                        <FileCheck2 className="size-4 text-[#b58dfb]" />
                        Exam summary
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-[#c6bed8]">
                        <div className="flex justify-between gap-3">
                          <span>Questions</span>
                          <strong className="text-white">{quizQuestions.length}</strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Passing score</span>
                          <strong className="text-white">{quizMeta.passingScore}%</strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Certificate</span>
                          <strong className="text-white">
                            {quizMeta.certificateEnabled ? 'Enabled' : 'Disabled'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {quizQuestions.length > 0 ? (
                    (() => {
                      const quizStepIndex = Math.min(
                        currentQuizQuestionIndex,
                        quizQuestions.length - 1,
                      );
                      const question = quizQuestions[quizStepIndex];
                      const questionKey =
                        question._key || `question-${quizStepIndex}`;
                      const selectedIds = quizAnswers[questionKey] || [];
                      const correctIds = getCorrectQuizOptionIds(question);
                      const multiple = correctIds.length > 1;
                      const correct = isQuizQuestionCorrect(question, selectedIds);
                      const isLastQuestion =
                        quizStepIndex === quizQuestions.length - 1;
                      const questionAnswered = selectedIds.length > 0;

                      return (
                        <div className="mt-8">
                          <div className="mb-4">
                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#b8b0cf]">
                              <span>
                                Question {quizStepIndex + 1} of {quizQuestions.length}
                              </span>
                              <span>
                                {answeredQuizCount} / {quizQuestions.length} answered
                              </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#34d4c6] transition-all"
                                style={{
                                  width: `${
                                    ((quizStepIndex + 1) / quizQuestions.length) * 100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#0f0b18] p-4 shadow-inner shadow-black/20 sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b58dfb]">
                                    Question {quizStepIndex + 1}
                                  </p>
                                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-[#d8d0ea]">
                                    {multiple ? 'Multiple answers' : 'One answer'}
                                  </span>
                                </div>
                                <h2 className="mt-3 text-lg font-black leading-7 text-white sm:text-2xl">
                                  {question.question}
                                </h2>
                                <p className="mt-2 text-sm font-semibold text-[#34d4c6]">
                                  {multiple
                                    ? 'Select all correct answers.'
                                    : 'Select one answer.'}
                                </p>
                              </div>
                              {quizSubmitted && !correct ? (
                                <span className="shrink-0 rounded-full bg-[#ef4444]/15 px-2.5 py-1 text-xs font-black text-[#ffb4b4]">
                                  Incorrect
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-6 space-y-3">
                              {question.options.map((option) => {
                                const selected = selectedIds.includes(option.id);

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => toggleQuizAnswer(question, questionKey, option.id)}
                                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                                      selected
                                        ? 'border-[#8b5cf6] bg-[#7c3aed]/20 text-white'
                                        : 'border-white/10 bg-white/5 text-[#d8d0ea] hover:bg-white/10'
                                    }`}
                                  >
                                    <span
                                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border text-[10px] font-black ${
                                        multiple ? 'rounded' : 'rounded-full'
                                      } ${
                                        selected
                                          ? 'border-[#b58dfb] bg-[#7c3aed] text-white'
                                          : 'border-white/30 bg-[#171322] text-transparent'
                                      }`}
                                    >
                                      {selected ? <Check className="size-3" /> : null}
                                    </span>
                                    <span className="leading-5">{option.text}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {quizSubmitted && !correct ? (
                              <div className="mt-5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-sm leading-6 text-[#ffcccc]">
                                This question was incorrect. Review the related course lesson before retaking the exam.
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentQuizQuestionIndex((index) =>
                                  Math.max(index - 1, 0),
                                )
                              }
                              disabled={quizStepIndex === 0}
                              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Previous question
                            </button>

                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              {!isLastQuestion ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCurrentQuizQuestionIndex((index) =>
                                      Math.min(index + 1, quizQuestions.length - 1),
                                    )
                                  }
                                  disabled={!quizSubmitted && !questionAnswered}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-black text-white transition hover:bg-[#6d31dc] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Next question
                                  <ArrowRight className="size-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={submitQuiz}
                                  disabled={quizSubmitted || !allQuizQuestionsAnswered}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-black text-white transition hover:bg-[#6d31dc] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <FileCheck2 className="size-4" />
                                  Submit exam
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mt-8 rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                      <HelpCircle className="mx-auto size-10 text-[#b58dfb]" />
                      <h2 className="mt-3 text-lg font-black text-white">
                        No exam questions added yet
                      </h2>
                      <p className="mt-2 text-sm text-[#c6bed8]">
                        Add certification questions in the CRM to activate the exam.
                      </p>
                    </div>
                  )}

                  <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">
                        {quizSubmitted
                          ? quizPassed
                            ? 'Exam passed'
                            : 'Exam not passed yet'
                          : 'Ready to submit?'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#b8b0cf]">
                        {quizSubmitted
                          ? quizPassed
                            ? `${quizMeta.certificateTitle} is ready. Credential ID: ${certificateNumber}.`
                            : `Questions to revise: ${incorrectQuizQuestionNumbers
                                .map((questionNumber) => `Question ${questionNumber}`)
                                .join(', ')}. Review the course, then retake the exam. Passing score is ${quizMeta.passingScore}%.`
                          : allQuizQuestionsAnswered
                            ? 'All questions are answered. Submit from the last question.'
                            : `Answer ${quizQuestions.length - answeredQuizCount} more question${
                                quizQuestions.length - answeredQuizCount === 1 ? '' : 's'
                              } before submitting.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quizSubmitted ? (
                        <button
                          type="button"
                          onClick={() => {
                            setQuizSubmitted(false);
                            setQuizAnswers({});
                            setCurrentQuizQuestionIndex(0);
                            setQuizAttempt((value) => value + 1);
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                          Retake exam
                        </button>
                      ) : null}
                      {quizPassed && quizMeta.certificateEnabled ? (
                        <>
                          <button
                            type="button"
                            onClick={downloadCertificate}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#34d4c6] px-4 text-sm font-black text-[#08110f] transition hover:bg-[#5ee7dc]"
                          >
                            <Download className="size-4" />
                            Download certificate
                          </button>
                          <button
                            type="button"
                            onClick={openLinkedInCertificate}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0a66c2] px-4 text-sm font-black text-white transition hover:bg-[#004182]"
                          >
                            <Share2 className="size-4" />
                            Add to LinkedIn
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="relative bg-black">
            <div className="relative mx-auto aspect-video max-h-[68vh] w-full overflow-hidden bg-[#0a0812]">
              {/* Real Video Player or Title Slide Frame */}
              {activeLesson?.videoUrl ? (
                isEmbedUrl(activeLesson.videoUrl) ? (
                  <iframe
                    src={getEmbedUrl(activeLesson.videoUrl)}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="relative h-full w-full flex items-center justify-center bg-black">
                    <video
                      ref={videoRef}
                      src={activeLesson.videoUrl}
                      className="h-full w-full object-contain"
                      playsInline
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          const nextTime = Math.round(videoRef.current.currentTime);
                          setCurrentTime(nextTime);
                          const maxTime =
                            videoRef.current.duration ||
                            activeLesson.durationSeconds ||
                            1;
                          if (nextTime >= maxTime * 0.8) {
                            markLessonCompleted(activeLesson);
                          }
                        }
                      }}
                      onEnded={() => {
                        setIsPlaying(false);
                        handleNextLesson();
                      }}
                      onClick={() => setIsPlaying(!isPlaying)}
                    />
                  </div>
                )
              ) : (
                <div className="relative h-full w-full select-none bg-gradient-to-br from-[#1b152b] via-[#100d1a] to-black">
                  {/* Background Instructor Lesson Graphic / Mock Video Frame */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80"
                        alt="EU MDR Masterclass Lesson Frame"
                        className={`h-full w-full object-cover transition-opacity duration-700 ${
                          isPlaying ? 'opacity-40 brightness-75' : 'opacity-25 brightness-50'
                        }`}
                      />

                      {/* Center Title Slide Preview */}
                      <div className="relative z-10 max-w-2xl px-6 text-center">
                        <Badge className="mb-3 border-white/20 bg-[#7c3aed]/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          Easy Medical Device Academy • 2026 Curriculum
                        </Badge>
                        <h2 className="text-xl font-extrabold text-white sm:text-3xl lg:text-4xl drop-shadow-md">
                          {activeLesson?.title}
                        </h2>
                        <p className="mt-2 text-xs text-[#d8d0ea] sm:text-sm line-clamp-2">
                          {activeLesson?.subtitleSummary || activeLesson?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtitles Overlay */}
              {showCaptions && !isEmbedUrl(activeLesson?.videoUrl) && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 max-w-xl rounded-md bg-black/80 px-4 py-1.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur sm:text-sm pointer-events-none">
                  {currentTime < 10
                    ? 'Welcome to this module with Easy Medical Device Academy.'
                    : currentTime < 25
                    ? 'In this lesson, we break down the Annex II Technical Documentation requirements.'
                    : currentTime < 45
                    ? 'Notice how the risk controls from ISO 14971 must link directly to each test protocol.'
                    : 'Ensure all notified body checklist items are addressed before submission.'}
                </div>
              )}

              {/* Big Centered Play Button Overlay (when paused and not an embed) */}
              {!isPlaying && !isEmbedUrl(activeLesson?.videoUrl) && (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 transition hover:bg-black/30"
                  aria-label="Play video"
                >
                  <div className="flex size-18 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_0_40px_rgba(124,58,237,0.7)] transition duration-200 hover:scale-110">
                    <Play className="ml-1 size-8 fill-current" />
                  </div>
                </button>
              )}

              {/* Video Media Controls Bar (embeds like YouTube bring their own controls) */}
              {!isEmbedUrl(activeLesson?.videoUrl) && (
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-6">
                {/* Timeline Scrubber */}
                <div className="group/time relative mb-2 flex h-2 w-full cursor-pointer items-center">
                  <input
                    type="range"
                    min={0}
                    max={videoRef.current?.duration ? Math.round(videoRef.current.duration) : (activeLesson?.durationSeconds || 900)}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (videoRef.current) {
                        videoRef.current.currentTime = val;
                      }
                    }}
                    className="absolute inset-0 w-full cursor-pointer opacity-0 z-10"
                  />
                  <div className="h-1 w-full rounded-full bg-white/25 group-hover/time:h-2 transition-all">
                    <div
                      className="relative h-full rounded-full bg-[#7c3aed]"
                      style={{
                        width: `${
                          (currentTime / (videoRef.current?.duration ? Math.round(videoRef.current.duration) : (activeLesson?.durationSeconds || 900))) *
                          100
                        }%`,
                      }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 size-3 rounded-full bg-white shadow opacity-0 group-hover/time:opacity-100" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-white">
                  {/* Left Controls */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="rounded p-1 transition hover:text-[#b58dfb]"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="size-5 fill-current" />
                      ) : (
                        <Play className="size-5 fill-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextTime = Math.max(0, currentTime - 10);
                        setCurrentTime(nextTime);
                        if (videoRef.current) videoRef.current.currentTime = nextTime;
                      }}
                      className="rounded p-1 text-white/80 transition hover:text-white"
                      title="Rewind 10s"
                    >
                      <RotateCcw className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const maxTime = videoRef.current?.duration || activeLesson?.durationSeconds || 900;
                        const nextTime = Math.min(maxTime, currentTime + 10);
                        setCurrentTime(nextTime);
                        if (videoRef.current) videoRef.current.currentTime = nextTime;
                      }}
                      className="rounded p-1 text-white/80 transition hover:text-white"
                      title="Forward 10s"
                    >
                      <RotateCw className="size-4" />
                    </button>

                      <button
                        type="button"
                        onClick={handleNextLesson}
                        className="rounded p-1 text-white/80 transition hover:text-white"
                        title="Next lecture"
                      >
                        <ChevronRight className="size-5" />
                      </button>

                      {/* Time display */}
                      <span className="font-mono text-xs text-[#c8c0da]">
                        {formatSeconds(currentTime)} / {activeLesson?.duration}
                      </span>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3">
                      {/* Volume */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className="rounded p-1 text-white/80 transition hover:text-white"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="size-4 text-red-400" />
                          ) : (
                            <Volume2 className="size-4" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            setVolume(Number(e.target.value));
                            setIsMuted(false);
                          }}
                          className="hidden h-1 w-16 accent-[#7c3aed] sm:block cursor-pointer"
                        />
                      </div>

                      {/* Speed selector */}
                      <div className="relative group/speed">
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 font-bold text-white/80 transition hover:text-white"
                        >
                          {playbackSpeed}x
                        </button>
                        <div className="invisible absolute bottom-full right-0 mb-2 flex flex-col rounded-lg border border-white/10 bg-[#1c172a] p-1 text-xs opacity-0 shadow-xl transition-all group-hover/speed:visible group-hover/speed:opacity-100 z-30">
                          {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setPlaybackSpeed(s)}
                              className={`rounded px-3 py-1 text-left hover:bg-white/10 ${
                                playbackSpeed === s ? 'font-bold text-[#b58dfb]' : 'text-white'
                              }`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CC Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowCaptions(!showCaptions)}
                        className={`rounded px-1.5 py-0.5 font-bold transition ${
                          showCaptions
                            ? 'bg-white/20 text-[#34d4c6]'
                            : 'text-white/60 hover:text-white'
                        }`}
                        title="Subtitles / Closed Captions"
                      >
                        CC
                      </button>

                      {/* Toggle Sidebar Icon (mobile/desktop) */}
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="rounded p-1 text-white/80 transition hover:text-white"
                        title="Toggle Curriculum Sidebar"
                      >
                        {sidebarOpen ? (
                          <PanelRightClose className="size-4" />
                        ) : (
                          <PanelRightOpen className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {activeLesson?.type !== 'quiz' ? (
            <>
              {/* 3. TABS HEADER UNDER VIDEO */}
              <div className="border-b border-white/10 bg-[#14101e] px-4 sm:px-6">
                <div className="flex gap-4 overflow-x-auto text-xs font-semibold text-[#8f88a2] sm:text-sm scrollbar-none">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'resources', label: 'Templates & Files' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`border-b-2 py-3.5 transition ${
                    activeTab === tab.key
                      ? 'border-[#7c3aed] text-white font-bold'
                      : 'border-transparent hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
                </div>
              </div>

              {/* 4. TAB CONTENT PANELS */}
              <div className="flex-1 bg-[#100d18] p-4 sm:p-6 md:p-8">
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="mx-auto max-w-4xl space-y-8">
                <div>
                  <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                    {activeLesson?.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#9f97b4] sm:text-sm">
                    <span>Total {curriculum.totalDuration}</span>
                    <span>•</span>
                    <span>Updated {curriculum.lastUpdated}</span>
                  </div>
                </div>

                {/* Action quick banner for mark complete */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#171322] p-4 shadow-sm">
                  {hasFullAccess ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleLessonCompleted(activeLesson.id)}
                        className={`flex size-6 items-center justify-center rounded-md border transition ${
                          completedLessonIds.has(activeLesson.id)
                            ? 'border-[#34d4c6] bg-[#34d4c6] text-[#0e0c14]'
                            : 'border-white/30 bg-white/5 text-white hover:border-white'
                        }`}
                      >
                        {completedLessonIds.has(activeLesson.id) && <Check className="size-4 stroke-[3]" />}
                      </button>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {completedLessonIds.has(activeLesson.id)
                            ? 'Lesson Completed'
                            : 'Mark lesson as complete'}
                        </p>
                        <p className="text-xs text-[#8e879f]">
                          Advance your certificate progress
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-[#7c3aed]/20 text-[#b58dfb]">
                        <LockKeyhole className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          Free preview mode
                        </p>
                        <p className="text-xs text-[#8e879f]">
                          Sign in to unlock all lessons and save your progress.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {!hasFullAccess ? (
                      <button
                        type="button"
                        onClick={signInToUnlock}
                        className="rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
                      >
                        Sign in
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handlePrevLesson}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={handleNextLesson}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
                    >
                      Next Lesson
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lesson Description */}
                {activeLesson?.type !== 'article' ? (
                  <div className="rounded-2xl border border-white/10 bg-[#171322] p-6">
                    <h3 className="text-lg font-bold text-white">About this Lecture</h3>
                    {activeLesson?.description ? (
                      /<(h[1-6]|p|div|ul|ol|blockquote|strong|b|em|i|br|hr)/i.test(activeLesson.description) ? (
                        <div
                          className="mt-4 text-sm leading-relaxed text-[#c6bed8] space-y-3
                            [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-2
                            [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2.5
                            [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#b58dfb] [&_h3]:mt-4 [&_h3]:mb-1.5
                            [&_p]:mb-3 [&_p]:leading-relaxed
                            [&_blockquote]:border-l-4 [&_blockquote]:border-[#7c3aed] [&_blockquote]:bg-[#7c3aed]/10 [&_blockquote]:p-4 [&_blockquote]:rounded-r-xl [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-white
                            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-3
                            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-3
                            [&_hr]:my-6 [&_hr]:border-white/10
                            [&_mark]:bg-amber-400/20 [&_mark]:text-amber-200 [&_mark]:px-1 [&_mark]:rounded
                            [&_a]:text-[#b58dfb] [&_a]:underline [&_a]:font-bold"
                          dangerouslySetInnerHTML={{ __html: activeLesson.description }}
                        />
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed text-[#c6bed8] whitespace-pre-wrap">
                          {activeLesson.description}
                        </p>
                      )
                    ) : (
                      <p className="mt-3 text-sm text-[#8e879f] italic">No description provided for this lesson.</p>
                    )}

                    {/* Attached resources */}
                    {visibleResources.length > 0 && (
                      <div className="mt-6 border-t border-white/10 pt-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#b58dfb]">
                          Downloadable Resources in this Lecture
                        </h4>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {visibleResources.map((res) => (
                            <div
                              key={res.name}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <FileSpreadsheet className="size-4 text-[#34d4c6]" />
                                <div>
                                  <p className="font-semibold text-white">{res.name}</p>
                                  <p className="text-[11px] text-[#8e879f]">{res.size} • {res.type}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="rounded p-1.5 text-[#b58dfb] transition hover:bg-white/10 hover:text-white"
                                title="Download resource"
                              >
                                <Download className="size-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Instructor Card */}
                <div className="rounded-2xl border border-white/10 bg-[#171322] p-6">
                  <h3 className="text-lg font-bold text-white">Instructor</h3>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="size-16 shrink-0 overflow-hidden rounded-full border-2 border-[#b58dfb] bg-[#b58dfb]">
                      <img
                        src="https://easymedicaldevice.com/wp-content/uploads/2026/02/monir-el-azzouzi-founder-ceo-easy-medical-device-400x350.jpg"
                        alt={curriculum.instructor}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">{curriculum.instructor}</h4>
                      <p className="text-xs text-[#b58dfb]">{curriculum.instructorRole}</p>
                      <p className="mt-3 text-xs leading-relaxed text-[#c6bed8] sm:text-sm">
                        Monir has guided over 100+ medical device manufacturers through CE marking, FDA 510(k), and ISO 13485 audits. He is also the host of the renowned Easy Medical Device Podcast.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Q&A */}
            {activeTab === 'qa' && (
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search questions in this course..."
                      value={searchQA}
                      onChange={(e) => setSearchQA(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                    />
                  </div>
                  <Button
                    onClick={() => setShowAskForm(!showAskForm)}
                    className="bg-[#7c3aed] text-white hover:bg-[#6d31dc]"
                  >
                    {showAskForm ? 'Close Question Form' : 'Ask a new question'}
                  </Button>
                </div>

                {/* Ask form */}
                {showAskForm && (
                  <div className="rounded-2xl border border-white/10 bg-[#171322] p-5">
                    <h3 className="text-base font-bold text-white">Ask Monir & the MedTech Faculty</h3>
                    <input
                      type="text"
                      placeholder="Title or summary of your question..."
                      value={newQuestionTitle}
                      onChange={(e) => setNewQuestionTitle(e.target.value)}
                      className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                    />
                    <textarea
                      rows={3}
                      placeholder="Details, clause references, or specific device challenges..."
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        onClick={handleAddQuestion}
                        className="bg-[#7c3aed] text-white hover:bg-[#6d31dc]"
                      >
                        Post Question
                      </Button>
                    </div>
                  </div>
                )}

                {/* Questions List */}
                <div className="space-y-4">
                  {qaList
                    .filter((q) =>
                      q.question.toLowerCase().includes(searchQA.toLowerCase())
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-[#171322] p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-[#7c3aed]/30 font-bold text-[#ded6f3]">
                              {item.author[0]}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">{item.author}</h4>
                              <p className="text-[11px] text-[#8e879f]">{item.role} • {item.timeAgo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#b58dfb]">
                            <ThumbsUp className="size-3" />
                            <span>{item.votes}</span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-relaxed text-[#dcd6ec] whitespace-pre-line">
                          {item.question}
                        </p>

                        {/* Answers */}
                        {item.answers.map((ans, idx) => (
                          <div
                            key={idx}
                            className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-bold text-white">
                                M
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white">{ans.author}</span>
                                {ans.isInstructor && (
                                  <Badge className="ml-2 bg-[#7c3aed] text-[10px] text-white">
                                    Instructor
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-[#8e879f] ml-auto">{ans.timeAgo}</span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-[#c6bed8] sm:text-sm">
                              {ans.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* TAB: NOTES */}
            {activeTab === 'notes' && (
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="rounded-2xl border border-white/10 bg-[#171322] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      Create a note at <span className="text-[#34d4c6] font-mono">{formatSeconds(currentTime)}</span>
                    </h3>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Type your personal note for this timestamp..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={handleAddNote}
                      className="bg-[#7c3aed] text-white hover:bg-[#6d31dc]"
                    >
                      Save Note
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-white/10 bg-[#171322] p-4 text-xs sm:text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTime(note.seconds);
                            setIsPlaying(true);
                          }}
                          className="flex items-center gap-1.5 rounded bg-[#7c3aed]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#b58dfb] transition hover:bg-[#7c3aed] hover:text-white"
                        >
                          <Play className="size-2.5 fill-current" />
                          <span>{note.timestamp}</span>
                        </button>
                        <span className="text-[11px] text-[#8e879f]">{note.lessonTitle}</span>
                      </div>
                      <p className="mt-2.5 text-[#dcd6ec] leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: ANNOUNCEMENTS */}
            {activeTab === 'announcements' && (
              <div className="mx-auto max-w-4xl space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#171322] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#7c3aed] font-bold text-white">
                      M
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Monir El Azzouzi posted an announcement
                      </h4>
                      <p className="text-xs text-[#8e879f]">3 days ago</p>
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">
                    2026 MDR Transition Timeline & MDCG Guidance Additions
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#c6bed8] sm:text-sm">
                    Dear Academy students, we have just added the newly published MDCG 2024 guidance interpretations to Section 3 of this masterclass! If you are preparing an Annex II submission this quarter, please make sure to download the updated GSPR matrix template.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#171322] p-6 md:flex-row md:items-center">
                  <div className="text-center md:border-r md:border-white/10 md:pr-8">
                    <p className="text-5xl font-black text-[#f59e0b]">{curriculum.rating}</p>
                    <div className="mt-2 flex justify-center text-[#f59e0b]">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="size-4 fill-current" />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-[#8e879f]">Course Rating</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { stars: 5, pct: 88 },
                      { stars: 4, pct: 10 },
                      { stars: 3, pct: 2 },
                      { stars: 2, pct: 0 },
                      { stars: 1, pct: 0 },
                    ].map((row) => (
                      <div key={row.stars} className="flex items-center gap-3 text-xs">
                        <span className="w-12 text-[#9f97b4]">{row.stars} stars</span>
                        <div className="h-2 flex-1 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#f59e0b]"
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-white font-medium">{row.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      name: 'Elena Rostova',
                      role: 'Senior RA Manager, Germany',
                      stars: 5,
                      text: 'Monir breaks down the GSPR mapping in a way no other regulatory training does. We passed our BSI surveillance audit with zero major findings thanks to these templates!',
                    },
                    {
                      name: 'Jean-Paul Mercier',
                      role: 'Lead QA Engineer, France',
                      stars: 5,
                      text: 'Clear, concise, and immediately applicable. Worth every euro for any MedTech company navigating EU MDR.',
                    },
                  ].map((rev, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-[#171322] p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-full bg-white/10 font-bold text-[#b58dfb]">
                            {rev.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{rev.name}</p>
                            <p className="text-[10px] text-[#8e879f]">{rev.role}</p>
                          </div>
                        </div>
                        <div className="flex text-[#f59e0b]">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className="size-3 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-[#c6bed8] sm:text-sm">
                        {rev.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: RESOURCES */}
            {activeTab === 'resources' && (
              <div className="mx-auto max-w-4xl space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#171322] p-6">
                  <h3 className="text-lg font-bold text-white">Lesson Resources & Downloads</h3>
                  <p className="mt-1 text-xs text-[#8e879f]">
                    Downloadable files, templates, and materials for this lecture.
                  </p>

                  <div className="mt-6 space-y-3">
                    {visibleResources.length > 0 ? (
                      visibleResources.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="size-5 text-[#b58dfb]" />
                            <div>
                              <p className="text-sm font-bold text-white">{item.name}</p>
                              <p className="text-xs text-[#8e879f]">
                                {item.type ? String(item.type).toUpperCase() : 'DOCUMENT'} {item.size ? `• ${item.size}` : ''}
                              </p>
                            </div>
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center justify-center rounded-lg bg-[#7c3aed] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#6d31dc] transition-colors"
                            >
                              <Download className="mr-1.5 size-3.5" />
                              Download
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-[#8e879f]">
                        No specific resource attachments for this lesson.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
              </div>
            </>
          ) : null}
        </div>

        {/* RIGHT SIDEBAR: COURSE CONTENT & AI TUTOR */}
        {sidebarOpen && (
          <aside className="w-80 shrink-0 border-l border-white/10 bg-[#14101e] flex flex-col md:w-96">
            {/* Sidebar Navigation Top Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSidebarTab('content')}
                  className={`rounded-md px-3 py-1.5 transition ${
                    sidebarTab === 'content'
                      ? 'bg-[#7c3aed] text-white font-bold'
                      : 'text-[#9f97b4] hover:text-white'
                  }`}
                >
                  Course content
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('ai')}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                    sidebarTab === 'ai'
                      ? 'bg-[#7c3aed] text-white font-bold'
                      : 'text-[#9f97b4] hover:text-white'
                  }`}
                >
                  <Sparkles className="size-3 text-[#34d4c6]" />
                  <span>AI Assistant</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                title="Collapse sidebar"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* SIDEBAR TAB 1: CURRICULUM ACCORDION */}
            {sidebarTab === 'content' && (
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-white/5">
                  {curriculum.sections.map((section, sIdx) => {
                    const secCompleted = section.lessons.filter((l) =>
                      completedLessonIds.has(l.id)
                    ).length;
                    const secTotal = section.lessons.length;
                    const isExpanded = !!expandedSections[section.id];
                    const visibleLessons = hasFullAccess
                      ? section.lessons
                      : section.lessons.filter((lesson) => lesson.previewEnabled);

                    return (
                      <div key={section.id} className="bg-[#14101e]">
                        {/* Section Header */}
                        <button
                          type="button"
                          onClick={() => toggleSectionExpand(section.id)}
                          className="flex w-full items-start justify-between p-4 text-left transition hover:bg-white/5"
                        >
                          <div className="pr-2">
                            <h3 className="text-xs font-bold text-white sm:text-sm">
                              {section.title}
                            </h3>
                            <p className="mt-1 text-[11px] text-[#8e879f]">
                              {hasFullAccess ? `${secCompleted} / ${secTotal}` : `${visibleLessons.length} preview`} |{' '}
                              {visibleLessons.reduce((acc, l) => acc + Math.round(l.durationSeconds / 60), 0)} min
                            </p>
                          </div>
                          <ChevronDown
                            className={`size-4 shrink-0 text-white/50 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Section Lessons List */}
                        {isExpanded && (
                          <div className="divide-y divide-white/5 bg-[#100d18]">
                            {section.lessons.map((lesson) => {
                              const isActive = activeLessonId === lesson.id;
                              const isDone = completedLessonIds.has(lesson.id);
                              const isLocked = !canAccessLesson(lesson);

                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => {
                                    if (isLocked) {
                                      signInToUnlock();
                                      return;
                                    }
                                    setActiveLessonId(lesson.id);
                                    setCurrentTime(0);
                                    setIsPlaying(true);
                                  }}
                                  className={`group flex cursor-pointer items-start gap-3 p-3.5 transition ${
                                    isActive
                                      ? 'border-l-4 border-[#7c3aed] bg-[#221738] text-white'
                                      : isLocked
                                        ? 'text-[#716982] hover:bg-white/[0.03]'
                                        : 'hover:bg-white/5 text-[#c8c0da]'
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <button
                                    type="button"
                                    onClick={(e) => toggleLessonCompleted(lesson.id, e)}
                                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition ${
                                      isDone
                                        ? 'border-[#34d4c6] bg-[#34d4c6] text-[#0e0c14]'
                                        : isLocked
                                          ? 'border-white/10 bg-white/[0.03] text-white/30'
                                          : 'border-white/30 bg-white/5 hover:border-white'
                                    }`}
                                    aria-label={isLocked ? 'Sign in to unlock lesson' : 'Toggle completed'}
                                  >
                                    {isDone ? <Check className="size-3 stroke-[3]" /> : isLocked ? <LockKeyhole className="size-2.5" /> : null}
                                  </button>

                                  <div className="flex-1">
                                    <p
                                      className={`text-xs font-medium leading-snug ${
                                        isActive ? 'font-bold text-white' : ''
                                      }`}
                                    >
                                      {lesson.title}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#8e879f]">
                                      <PlayCircle className="size-3 text-[#b58dfb]" />
                                      <span>{lesson.duration}</span>
                                      {lesson.previewEnabled && (
                                        <span className="rounded bg-[#34d4c6]/15 px-1 py-0.5 font-bold text-[#34d4c6]">
                                          Preview
                                        </span>
                                      )}
                                      {isLocked && (
                                        <span className="flex items-center gap-0.5 rounded bg-white/5 px-1 py-0.5 text-white/40">
                                          <LockKeyhole className="size-2.5" />
                                          <span>Locked</span>
                                        </span>
                                      )}
                                      {lesson.resources && lesson.resources.length > 0 && (
                                        <span className="flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.2 text-[#34d4c6]">
                                          <FileSpreadsheet className="size-2.5" />
                                          <span>Resources</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SIDEBAR TAB 2: AI REGULATORY ASSISTANT */}
            {sidebarTab === 'ai' && (
              <div className="flex flex-1 flex-col justify-between overflow-hidden p-3">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {aiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col text-xs ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`rounded-2xl p-3 max-w-[90%] leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-[#7c3aed] text-white'
                            : 'border border-white/10 bg-white/5 text-[#dcd6ec]'
                        }`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-[#34d4c6]">
                            <Sparkles className="size-3" />
                            <span>EMD AI Tutor</span>
                          </div>
                        )}
                        {msg.text}
                      </div>
                      <span className="mt-1 text-[9px] text-white/40">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* AI Input Box */}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask about GSPR, Rule 11, PMS..."
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendAiMessage();
                      }}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendAiMessage}
                      className="flex size-8 items-center justify-center rounded-lg bg-[#7c3aed] text-white transition hover:bg-[#6d31dc]"
                    >
                      <Send className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* RATING MODAL */}
      {ratingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1528] p-6 text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setRatingModalOpen(false)}
              className="absolute right-4 top-4 text-white/50 hover:text-white"
            >
              <X className="size-5" />
            </button>

            {ratingSubmitted ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto size-12 text-[#34d4c6]" />
                <h3 className="mt-3 text-lg font-bold">Thank you for your rating!</h3>
                <p className="mt-2 text-xs text-[#a098b5]">
                  Your review helps Monir and the Easy Medical Device team improve future lessons.
                </p>
                <Button
                  onClick={() => {
                    setRatingSubmitted(false);
                    setRatingModalOpen(false);
                  }}
                  className="mt-6 bg-[#7c3aed] text-white hover:bg-[#6d31dc]"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold">Rate this Masterclass</h3>
                <p className="mt-1 text-xs text-[#a098b5]">
                  How would you rate your learning experience with Monir El Azzouzi?
                </p>

                <div className="my-6 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      className="p-1 transition hover:scale-110"
                    >
                      <Star
                        className={`size-8 ${
                          star <= selectedRating
                            ? 'fill-[#f59e0b] text-[#f59e0b]'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Tell us what you loved or how we can improve..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-white/40 focus:border-[#7c3aed] focus:outline-none"
                />

                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRatingModalOpen(false)}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setRatingSubmitted(true)}
                    className="bg-[#7c3aed] text-white hover:bg-[#6d31dc]"
                  >
                    Submit Review
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
