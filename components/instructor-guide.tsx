'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, CircleHelp, X } from 'lucide-react';

/* ---------------------------------------------------------------------------------------------
   The guide that stays with a new instructor: it follows them from the dashboard to the course
   editor and to the recording studio, highlights what to click and says it in simple words.
   The pages mark the things to show with  data-guide="name"  (and the editor with
   data-editor-step, the studio with data-guide-context). The guide moves to the right step by
   itself, and can be reopened at any time with the "Guide" button.
--------------------------------------------------------------------------------------------- */

type Where = 'home' | 'editor1' | 'editor2' | 'editor3' | 'studio' | 'studio-review' | 'editor4' | 'editor5';
type GuideStep = {
  where: Where;
  target?: string;
  title: string;
  text: string;
  /** The popup button clicks the highlighted button of the page for the instructor, and has this name. */
  click?: string;
};

const STEPS: GuideStep[] = [
  {
    where: 'home',
    target: 'add-course',
    title: 'Welcome! Let us create your first course',
    text: 'We will do it together, step by step. Use the button below: it does the same as the purple "Add course" button.',
    click: 'Add course',
  },
  {
    where: 'editor1',
    target: 'course-form',
    title: 'Step 1: describe your course',
    text: 'Fill in these fields: the title, one short sentence, the description, the category and the level. Do not worry, you can change everything later.',
  },
  {
    where: 'editor1',
    target: 'next-step',
    title: 'Fields filled in?',
    text: 'Then go to the next step. Your work is saved by itself.',
    click: 'Next step',
  },
  {
    where: 'editor2',
    target: 'course-price',
    title: 'Step 2: the price',
    text: 'Write the price in dollars. Write 0 if your course is free.',
  },
  {
    where: 'editor2',
    target: 'next-step',
    title: 'Price done?',
    text: 'Go to the next step: your lessons.',
    click: 'Next step',
  },
  {
    where: 'editor3',
    target: 'lesson-title',
    title: 'Step 3: your first lesson',
    text: 'A course is made of lessons. Write the title of your first lesson here, for example "What is the EU MDR?".',
  },
  {
    where: 'editor3',
    target: 'record-studio',
    title: 'Record the lesson',
    text: 'Open the studio to record this lesson with your slides and your camera. Already have a video? Use "Choose a video file" next to it instead. Record ONE lesson at a time, not the whole course.',
    click: 'Record in the studio',
  },
  {
    where: 'studio',
    target: 'studio-slides',
    title: 'Your slides',
    text: 'Your slides appear here. If you added a presentation to the lesson, it is already loaded. Otherwise choose your PDF. You can start from any slide.',
  },
  {
    where: 'studio',
    target: 'studio-mic',
    title: 'Check your microphone',
    text: 'Say something: the bar must move. Click "Test my sound" to listen to yourself. If something is wrong, a message tells you what to do.',
  },
  {
    where: 'studio',
    target: 'studio-start',
    title: 'Start recording',
    text: 'Ready? Start recording and talk to your learners. Change slides with the arrow keys. Made a mistake? Press M, you will cut it out after. Click Stop when you finish.',
    click: 'Start recording',
  },
  {
    where: 'studio-review',
    target: 'studio-use',
    title: 'Listen, cut, and save',
    text: 'Watch your recording. You can delete any part you do not like (select it on the timeline, then Delete). When you are happy, save it in your lesson.',
    click: 'Use this video',
  },
  {
    where: 'editor3',
    target: 'add-lesson',
    title: 'Next lesson',
    text: 'Your first lesson is done! Add the next lesson and repeat: title, then record. You can also come back later.',
    click: 'Add a lesson',
  },
  {
    where: 'editor3',
    target: 'next-step',
    title: 'All your lessons are ready?',
    text: 'Then go to the final exam.',
    click: 'Next step',
  },
  {
    where: 'editor4',
    target: 'exam',
    title: 'Step 4: the final exam',
    text: 'Add at least 3 questions, each with its answers. Learners who pass the exam get their certificate, with your name on it.',
  },
  {
    where: 'editor4',
    target: 'next-step',
    title: 'Exam done?',
    text: 'Go to the last step.',
    click: 'Next step',
  },
  {
    where: 'editor5',
    target: 'send-review',
    title: 'Step 5: send it to us',
    text: 'Check that everything in the list is green, then send your course. We check it, prepare the cover and publish it. You will receive an email.',
    click: 'Send for review',
  },
];

const STORAGE_KEY = 'emd-instructor-guide-v1';
type Saved = { index: number; status: 'active' | 'closed' | 'done' };

function load(): Saved {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as Saved | null;
    if (value && typeof value.index === 'number' && ['active', 'closed', 'done'].includes(value.status)) return value;
  } catch {
    // nothing saved yet
  }
  return { index: 0, status: 'active' };
}

function save(value: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // not saved: the guide simply starts again next time
  }
}

/** Where the instructor is right now. */
function whereAmI(pathname: string): Where | 'other' {
  // a window of the page is open (for example the explanation before the studio): the guide waits
  if (document.querySelector('[role="dialog"][aria-label="Record one lesson at a time"]')) return 'other';
  // recording: the guide stays out of the way
  if (document.querySelector('[data-guide-busy]')) return 'other';
  if (document.querySelector('[data-guide="studio-use"]')) return 'studio-review';
  if (document.querySelector('[data-guide-context="studio"]')) return 'studio';
  const editor = document.querySelector<HTMLElement>('[data-editor-step]');
  if (editor) {
    const step = Number(editor.dataset.editorStep);
    if (step >= 1 && step <= 5) return `editor${step}` as Where;
  }
  return pathname.startsWith('/academy/instructor') ? 'home' : 'other';
}

type Box = { top: number; left: number; width: number; height: number; disabled: boolean };

const CARD_W = 360;
const CARD_H = 300;

/** Where the card goes: a corner that does not hide the highlighted thing (and never the bottom right, where the "Next step" button is). */
function cardPlace(box: Box | null): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw * 0.92);
  const corners = [
    { top: 80, left: vw - 20 - w },
    { top: 80, left: 20 },
    { top: vh - 20 - CARD_H, left: 20 },
  ];
  if (!box) return corners[0];
  const free = corners.find(
    (corner) =>
      corner.left + w < box.left - 12 ||
      corner.left > box.left + box.width + 12 ||
      corner.top + CARD_H < box.top - 12 ||
      corner.top > box.top + box.height + 12,
  );
  return free ?? corners[0];
}

export function InstructorGuide() {
  const pathname = usePathname();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [where, setWhere] = useState<Where | 'other'>('other');
  const [box, setBox] = useState<Box | null>(null);
  const [waiting, setWaiting] = useState(false);
  const savedRef = useRef<Saved | null>(null);
  const pending = useRef<{ index: number; until: number } | null>(null);
  savedRef.current = saved;

  const update = useCallback((next: Saved) => {
    savedRef.current = next;
    setSaved(next);
    save(next);
  }, []);

  useEffect(() => {
    setSaved(load());
  }, []);

  // follow the instructor: where is he, and what should be shown?
  useEffect(() => {
    const tick = () => {
      const current = savedRef.current;
      const here = whereAmI(pathname);
      setWhere(here);
      if (!current || current.status !== 'active') {
        setBox(null);
        return;
      }

      // the step shown always belongs to the place where the instructor is
      let index = current.index;
      if (pending.current && Date.now() > pending.current.until) pending.current = null;
      if (pending.current && STEPS[pending.current.index]?.where === here) {
        // the page changed after the click: show the step that follows
        index = pending.current.index;
        pending.current = null;
        update({ ...current, index });
      } else if (!pending.current && STEPS[index]?.where !== here) {
        const first = STEPS.findIndex((step) => step.where === here);
        if (first >= 0) {
          index = first;
          update({ ...current, index });
        }
      }
      setWaiting(Boolean(pending.current));

      const step = STEPS[index];
      const element = step?.where === here && step.target ? document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`) : null;
      if (!element) return setBox(null);
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return setBox(null);
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        disabled: element instanceof HTMLButtonElement && element.disabled,
      });
    };

    tick();
    const id = window.setInterval(tick, 120);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [pathname, update]);

  // bring the highlighted thing into view when the step changes
  const shownIndex = saved?.index ?? 0;
  useEffect(() => {
    if (!saved || saved.status !== 'active') return;
    const step = STEPS[shownIndex];
    if (!step?.target) return;
    const element = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 80) element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownIndex, where, saved?.status]);

  if (!saved || where === 'other' || waiting) return null;

  const step = STEPS[saved.index];
  const stepsHere = STEPS.map((item, index) => ({ item, index })).filter(({ item }) => item.where === where);

  // closed or finished: only a small button to open the guide again
  if (saved.status !== 'active' || !step || step.where !== where) {
    if (saved.status === 'active' && stepsHere.length === 0) return null;
    return (
      <button
        type="button"
        onClick={() => update({ index: stepsHere[0]?.index ?? 0, status: 'active' })}
        className="fixed bottom-5 right-5 z-[130] inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-[#6d31dc]"
      >
        <CircleHelp className="size-4" aria-hidden="true" /> Guide
      </button>
    );
  }

  const backHere = saved.index > 0 && STEPS[saved.index - 1].where === where;

  // the popup does the click for the instructor, then waits for the page to change
  function act(item: GuideStep) {
    const current = savedRef.current;
    if (!current || !item.target) return;
    const element = document.querySelector<HTMLElement>(`[data-guide="${item.target}"]`);
    if (!element || (element instanceof HTMLButtonElement && element.disabled)) return;
    const following = current.index + 1;
    if (following >= STEPS.length) update({ ...current, status: 'done' });
    else pending.current = { index: following, until: Date.now() + (item.target === 'add-course' ? 15000 : 4000) };
    element.click();
  }
  const place = cardPlace(box);

  return (
    <>
      {/* the highlighted thing: everything else is dimmed */}
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[125] rounded-xl ring-4 ring-[#34d4c6] transition-all duration-300"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
            boxShadow: '0 0 0 9999px rgba(25, 22, 37, 0.55)',
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-label="Instructor guide"
        className="fixed z-[130] w-[min(92vw,360px)] rounded-2xl border border-[#d9d1ee] bg-white p-5 shadow-2xl"
        style={place}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#067b75]">
            Guide · step {saved.index + 1} of {STEPS.length}
          </p>
          <button
            type="button"
            onClick={() => update({ ...saved, status: 'closed' })}
            aria-label="Hide the guide"
            title="Hide the guide (you can open it again)"
            className="-mr-1 -mt-1 rounded-full p-1 text-[#8e879f] hover:bg-[#f4f0ff] hover:text-[#7c3aed]"
          >
            <X className="size-4" />
          </button>
        </div>
        <h3 className="mt-1.5 text-lg font-black leading-snug text-[#191625]">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#5f5872]">{step.text}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {backHere ? (
            <button
              type="button"
              onClick={() => update({ ...saved, index: saved.index - 1 })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9d1ee] px-3 text-xs font-bold text-[#302945] hover:border-[#7c3aed]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
            </button>
          ) : (
            <span />
          )}
          {step.click ? (
            <button
              type="button"
              onClick={() => act(step)}
              disabled={Boolean(box?.disabled)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-5 text-sm font-black text-white hover:bg-[#6d31dc] disabled:opacity-50"
            >
              {step.click} <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => update({ ...saved, index: saved.index + 1 })}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-5 text-sm font-black text-white hover:bg-[#6d31dc]"
            >
              Continue <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {step.click && box?.disabled ? <p className="mt-2 text-xs font-semibold text-[#b7791f]">This button is not ready yet. Do the previous part first (for example, choose your slides).</p> : null}
        <button type="button" onClick={() => update({ ...saved, status: 'done' })} className="mt-3 text-xs font-semibold text-[#8e879f] underline hover:text-[#7c3aed]">
          I know how it works, stop the guide
        </button>
      </div>
    </>
  );
}
