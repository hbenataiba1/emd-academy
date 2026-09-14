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
  getAcademyAuthHeader,
  getStoredAcademySession,
  type AcademySession,
} from '@/lib/academy-session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type CoursePlayerProps = {
  courseId?: string;
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

export function CoursePlayer({ courseId = 'eu-mdr-technical-file' }: CoursePlayerProps) {
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
  const [accessState, setAccessState] = useState<
    'checking' | 'ready' | 'blocked'
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

  const [activeLessonId, setActiveLessonId] = useState<string>(() => {
    // Default to first incomplete lesson, or first lesson
    const firstIncomplete = allLessons.find((l) => !completedLessonIds.has(l.id));
    return firstIncomplete?.id || allLessons[0]?.id || 'les-1';
  });

  const activeLesson = useMemo(() => {
    return allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  }, [allLessons, activeLessonId]);

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
    const session = getStoredAcademySession();
    setAcademySession(session);

    if (!session) {
      setAccessState('blocked');
      setAccessMessage('Sign in to start or continue this course.');
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

        if (!enrollResponse.ok && enrollPayload.requiresPayment) {
          setAccessState('blocked');
          setAccessMessage(
            enrollPayload.message ||
              'Complete checkout to unlock this paid course.',
          );
          return;
        }

        if (!enrollResponse.ok) {
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

        if (!cancelled) {
          setCompletedLessonIds(new Set(savedLessons));
          setAccessState('ready');
        }
      } catch {
        if (!cancelled) {
          setAccessState('blocked');
          setAccessMessage('Course access is temporarily unavailable.');
        }
      }
    }

    unlockCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Playback timer simulation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const max = activeLesson?.durationSeconds || 900;
          if (prev >= max) {
            setIsPlaying(false);
            // Mark current lesson as complete
            setCompletedLessonIds((old) => new Set(old).add(activeLesson.id));
            persistLessonProgress(activeLesson.id, true);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, activeLesson]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleLessonCompleted = (lessonId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const persistLessonProgress = async (lessonId: string, completed: boolean) => {
    const session = academySession || getStoredAcademySession();
    if (!session) return;

    try {
      await fetch('/api/academy/progress', {
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
    } catch {
      // The local UI stays responsive; the next page load will reconcile progress.
    }
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
    if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
      setActiveLessonId(allLessons[currentIndex + 1].id);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  const handlePrevLesson = () => {
    const currentIndex = allLessons.findIndex((l) => l.id === activeLessonId);
    if (currentIndex > 0) {
      setActiveLessonId(allLessons[currentIndex - 1].id);
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
      <div className="flex min-h-screen items-center justify-center bg-[#0e0c14] px-4 text-white">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#7c3aed]/20 text-[#b58dfb]">
            <PlayCircle className="size-6" />
          </div>
          <h1 className="text-2xl font-black">Opening your course</h1>
          <p className="mt-2 text-sm text-[#a098b5]">
            We are checking your academy access and loading your saved progress.
          </p>
        </div>
      </div>
    );
  }

  if (!academySession || accessState === 'blocked') {
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
          {/* Rating button */}
          <button
            type="button"
            onClick={() => setRatingModalOpen(true)}
            className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-[#d0c9e2] transition hover:bg-white/10 sm:flex"
          >
            <Star className="size-3.5 fill-[#f59e0b] text-[#f59e0b]" />
            <span>Leave a rating</span>
          </button>

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
                          setCurrentTime(Math.round(videoRef.current.currentTime));
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
              {showCaptions && (
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

              {/* Video Media Controls Bar */}
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
              </div>
            </div>

          {/* 3. TABS HEADER UNDER VIDEO */}
          <div className="border-b border-white/10 bg-[#14101e] px-4 sm:px-6">
            <div className="flex gap-4 overflow-x-auto text-xs font-semibold text-[#8f88a2] sm:text-sm scrollbar-none">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'qa', label: `Q&A (${qaList.length})` },
                { key: 'notes', label: `Notes (${notes.length})` },
                { key: 'announcements', label: 'Announcements' },
                { key: 'reviews', label: 'Reviews' },
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
                    <span className="flex items-center gap-1 font-bold text-white">
                      <Star className="size-4 fill-[#f59e0b] text-[#f59e0b]" />
                      {curriculum.rating} ({curriculum.ratingCount.toLocaleString()} ratings)
                    </span>
                    <span>•</span>
                    <span>{curriculum.studentCount.toLocaleString()} students</span>
                    <span>•</span>
                    <span>Total {curriculum.totalDuration}</span>
                    <span>•</span>
                    <span>Updated {curriculum.lastUpdated}</span>
                  </div>
                </div>

                {/* Action quick banner for mark complete */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#171322] p-4 shadow-sm">
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

                  <div className="flex items-center gap-2">
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
                <div className="rounded-2xl border border-white/10 bg-[#171322] p-6">
                  <h3 className="text-lg font-bold text-white">
                    {activeLesson?.type === 'article' ? 'Article Reading Material' : 'About this Lecture'}
                  </h3>
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
                  {activeLesson?.resources && activeLesson.resources.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#b58dfb]">
                        Downloadable Resources in this Lecture
                      </h4>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {activeLesson.resources.map((res) => (
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
                    {activeLesson?.resources && activeLesson.resources.length > 0 ? (
                      activeLesson.resources.map((item: any, idx: number) => (
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
                              {secCompleted} / {secTotal} |{' '}
                              {section.lessons.reduce((acc, l) => acc + Math.round(l.durationSeconds / 60), 0)} min
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

                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => {
                                    setActiveLessonId(lesson.id);
                                    setCurrentTime(0);
                                    setIsPlaying(true);
                                  }}
                                  className={`group flex cursor-pointer items-start gap-3 p-3.5 transition ${
                                    isActive
                                      ? 'border-l-4 border-[#7c3aed] bg-[#221738] text-white'
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
                                        : 'border-white/30 bg-white/5 hover:border-white'
                                    }`}
                                    aria-label="Toggle completed"
                                  >
                                    {isDone && <Check className="size-3 stroke-[3]" />}
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
