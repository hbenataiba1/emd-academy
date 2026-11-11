'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Award, Building2, LayoutDashboard, ShieldCheck, Video, Wallet, type LucideIcon } from 'lucide-react';

/* ---------------------------------------------------------------------------------------------
   "Why teach with us": the features are on the right. The one in the middle of the screen is the
   active one, and the picture on the left (a drawing of the real dashboard) changes with it.
   Each picture below is a first version: we improve them one by one.
--------------------------------------------------------------------------------------------- */

const P = '#7c3aed';
const T = '#34d4c6';
const LINE = '#e4ddf4';

// the window that holds every picture
type Place = { x: number; y: number; width: number; height: number };

function Frame({ title, children, place }: { title: string; children: ReactNode; place?: Place }) {
  return (
    <svg viewBox="0 0 560 420" role="img" aria-label={title} className={place ? undefined : 'h-full w-full'} {...place}>
      <rect x="4" y="4" width="552" height="412" rx="22" fill="#fff" stroke={LINE} strokeWidth="2" />
      <path d="M4 26a22 22 0 0 1 22-22h508a22 22 0 0 1 22 22v34H4z" fill="#f4f0ff" />
      <circle cx="30" cy="32" r="6" fill="#ef4444" opacity=".7" />
      <circle cx="50" cy="32" r="6" fill="#f6b44b" />
      <circle cx="70" cy="32" r="6" fill="#22c55e" opacity=".8" />
      <text x="96" y="37" fontSize="13" fontWeight="700" fill="#6e687d">{title}</text>
      {children}
    </svg>
  );
}

function Tile({ x, y, w = 160, label, value }: { x: number; y: number; w?: number; label: string; value: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="84" rx="14" fill="#fff" stroke={LINE} strokeWidth="2" />
      <text x={x + 16} y={y + 28} fontSize="11" fontWeight="800" fill="#8e879f" letterSpacing="1">{label.toUpperCase()}</text>
      <text x={x + 16} y={y + 66} fontSize="30" fontWeight="800" fill="#191625">{value}</text>
    </g>
  );
}

const DashHome = ({ place }: { place: Place }) => (
    <Frame title="Instructor dashboard" place={place}>
      <rect x="28" y="84" width="504" height="86" rx="16" fill={P} />
      <text x="48" y="116" fontSize="11" fontWeight="800" fill={T} letterSpacing="2">INSTRUCTOR DASHBOARD</text>
      <text x="48" y="148" fontSize="26" fontWeight="800" fill="#fff">Welcome, Alex</text>
      <Tile x={28} y={188} label="Courses" value="3 / 4" />
      <Tile x={200} y={188} label="Learners" value="182" />
      <Tile x={372} y={188} label="Certificates" value="97" />
      <Tile x={28} y={290} label="Rating" value="4.8" />
      <Tile x={200} y={290} label="Enrollments" value="214" />
      <Tile x={372} y={290} label="Questions" value="3" />
    </Frame>
);

const DashLearners = ({ place }: { place: Place }) => (
    <Frame title="Your learners" place={place}>
      <text x="28" y="94" fontSize="15" fontWeight="800" fill="#191625">Learners and their progress</text>
      <rect x="440" y="78" width="92" height="22" rx="11" fill="#f4f0ff" />
      <text x="486" y="93" fontSize="11" fontWeight="800" fill={P} textAnchor="middle">182 enrolled</text>
      {[
        ['MS', 'Maria S.', 'EU MDR in practice', 100, '#22c55e'],
        ['JK', 'John K.', 'EU MDR in practice', 72, P],
        ['LR', 'Lina R.', 'ISO 13485 basics', 45, P],
        ['TB', 'Tom B.', 'ISO 13485 basics', 12, P],
        ['AN', 'Anna N.', 'EU MDR in practice', 88, P],
        ['PD', 'Paul D.', 'ISO 13485 basics', 100, '#22c55e'],
      ].map(([initials, name, course, pct, color], index) => (
        <g key={name as string}>
          <rect x="28" y={112 + index * 50} width="504" height="42" rx="12" fill="#fbfbfe" stroke={LINE} strokeWidth="1.5" />
          <circle cx="54" cy={133 + index * 50} r="14" fill="#ede4ff" />
          <text x="54" y={137 + index * 50} fontSize="10" fontWeight="800" fill={P} textAnchor="middle">{initials}</text>
          <text x="80" y={129 + index * 50} fontSize="13" fontWeight="800" fill="#191625">{name}</text>
          <text x="80" y={144 + index * 50} fontSize="10" fontWeight="500" fill="#8e879f">{course}</text>
          <rect x="290" y={129 + index * 50} width="170" height="9" rx="4.5" fill="#ece8f7" />
          <rect x="290" y={129 + index * 50} width={(170 * (pct as number)) / 100} height="9" rx="4.5" fill={color as string} />
          <text x="516" y={138 + index * 50} fontSize="12" fontWeight="800" fill={pct === 100 ? '#15803d' : '#191625'} textAnchor="end">{pct}%</text>
        </g>
      ))}
    </Frame>
);

const DashQuestions = ({ place }: { place: Place }) => (
    <Frame title="Questions from learners" place={place}>
      <text x="28" y="94" fontSize="15" fontWeight="800" fill="#191625">Questions from your learners</text>
      <rect x="436" y="78" width="96" height="22" rx="11" fill="#ffe9ee" />
      <text x="484" y="93" fontSize="11" fontWeight="800" fill="#e11d48" textAnchor="middle">3 to answer</text>

      <rect x="28" y="112" width="504" height="150" rx="14" fill="#fff" stroke={P} strokeWidth="2" />
      <circle cx="56" cy="138" r="14" fill="#ede4ff" />
      <text x="56" y="142" fontSize="10" fontWeight="800" fill={P} textAnchor="middle">JK</text>
      <text x="80" y="134" fontSize="13" fontWeight="800" fill="#191625">John K.</text>
      <text x="80" y="149" fontSize="10" fontWeight="500" fill="#8e879f">Lesson 3 · Classification rules</text>
      <text x="46" y="180" fontSize="14" fontWeight="600" fill="#302945">Does a software app fall under Rule 11?</text>
      <rect x="46" y="198" width="372" height="40" rx="10" fill="#faf8ff" stroke={P} strokeWidth="1.5" />
      <text x="58" y="223" fontSize="12" fill="#8e879f">Write your answer...</text>
      <rect x="428" y="198" width="88" height="40" rx="10" fill={P} />
      <text x="472" y="223" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">Reply</text>

      {[
        ['LR', 'Lina R.', 'Lesson 1 · Scope of the standard', 'Is ISO 13485 mandatory in the EU?'],
        ['TB', 'Tom B.', 'Lesson 5 · Technical documentation', 'Where do I find the template?'],
      ].map(([initials, name, lesson, question], index) => (
        <g key={name}>
          <rect x="28" y={276 + index * 62} width="504" height="54" rx="12" fill="#fbfbfe" stroke={LINE} strokeWidth="1.5" />
          <circle cx="54" cy={303 + index * 62} r="13" fill="#ede4ff" />
          <text x="54" y={307 + index * 62} fontSize="10" fontWeight="800" fill={P} textAnchor="middle">{initials}</text>
          <text x="78" y={298 + index * 62} fontSize="12" fontWeight="800" fill="#191625">{name} <tspan fontSize="10" fontWeight="500" fill="#8e879f">{lesson}</tspan></text>
          <text x="78" y={316 + index * 62} fontSize="12" fontWeight="600" fill="#302945">{question}</text>
          <rect x="446" y={292 + index * 62} width="70" height="22" rx="11" fill="#fff3d6" />
          <text x="481" y={307 + index * 62} fontSize="10" fontWeight="800" fill="#a16207" textAnchor="middle">New</text>
        </g>
      ))}
    </Frame>
);

const pictures: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 640 480" role="img" aria-label="Your dashboard: overview, learners and questions" className="h-full w-full">
      <defs>
        <filter id="dash-shadow" x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#3b0764" floodOpacity=".2" />
        </filter>
      </defs>
      <g filter="url(#dash-shadow)"><DashLearners place={{ x: 0, y: 70, width: 404, height: 303 }} /></g>
      <g filter="url(#dash-shadow)"><DashHome place={{ x: 386, y: 24, width: 254, height: 190 }} /></g>
      <g filter="url(#dash-shadow)"><DashQuestions place={{ x: 380, y: 250, width: 260, height: 195 }} /></g>
    </svg>
  ),
  platform: (
    <Frame title="We run the platform">
      {[
        ['Secure video hosting', 'Ready'],
        ['Secure payments', 'Ready'],
        ['Automatic emails', 'Ready'],
      ].map(([label, state], index) => (
        <g key={label}>
          <rect x="40" y={92 + index * 100} width="480" height="80" rx="16" fill="#fbfbfe" stroke={LINE} strokeWidth="2" />
          <circle cx="82" cy={132 + index * 100} r="20" fill="#f4f0ff" />
          <path d={`M72 ${132 + index * 100}l7 7 12-13`} stroke={P} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="120" y={138 + index * 100} fontSize="20" fontWeight="800" fill="#191625">{label}</text>
          <rect x="430" y={118 + index * 100} width="70" height="28" rx="14" fill="#dcfce7" />
          <text x="465" y={137 + index * 100} fontSize="13" fontWeight="800" fill="#15803d" textAnchor="middle">{state}</text>
        </g>
      ))}
    </Frame>
  ),
  certificates: (
    <Frame title="Certificate">
      <rect x="28" y="74" width="504" height="282" rx="12" fill="#f8f6ff" stroke={P} strokeWidth="3" />
      <rect x="38" y="84" width="484" height="262" rx="6" fill="none" stroke="#d4a017" strokeWidth="1.2" opacity=".7" />
      <text x="280" y="112" fontSize="9" fontWeight="700" fill={P} textAnchor="middle" letterSpacing="4">EASY MEDICAL DEVICE ACADEMY</text>
      <text x="280" y="152" fontSize="34" fontWeight="700" fill="#1a1033" textAnchor="middle" letterSpacing="5">CERTIFICATE</text>
      <text x="280" y="171" fontSize="9" fontWeight="600" fill={P} textAnchor="middle" letterSpacing="4">OF COMPLETION</text>
      <text x="280" y="204" fontSize="9" fontWeight="600" fill="#64748b" textAnchor="middle" letterSpacing="3">THIS IS TO CERTIFY THAT</text>
      <text x="280" y="234" fontSize="30" fontStyle="italic" fontWeight="700" fill="#3b0764" textAnchor="middle">Learner name</text>
      <line x1="180" y1="243" x2="380" y2="243" stroke="#d4a017" strokeWidth="1.5" />
      <text x="280" y="266" fontSize="12" fontWeight="500" fill="#475569" textAnchor="middle">has successfully completed the course</text>
      <text x="280" y="288" fontSize="17" fontWeight="700" fill="#581c87" textAnchor="middle">Your course title</text>

      {/* verify code */}
      <rect x="58" y="276" width="46" height="46" rx="6" fill="#fff" stroke="#d4a017" strokeWidth="1.5" />
      {[0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4].map((c) => ((r * 5 + c * 3 + r * c) % 3 === 0 ? <rect key={`${r}${c}`} x={64 + c * 7.6} y={282 + r * 7.6} width="6" height="6" rx="1" fill="#3b0764" /> : null)))}
      <text x="81" y="335" fontSize="6.5" fontWeight="700" fill="#64748b" textAnchor="middle">VERIFY ONLINE</text>

      {/* the instructor signature, with his company */}
      <text x="450" y="296" fontSize="24" fontStyle="italic" fill="#3b0764" textAnchor="middle">Your name</text>
      <line x1="384" y1="303" x2="516" y2="303" stroke={P} strokeWidth="1.8" />
      <text x="450" y="317" fontSize="9" fontWeight="800" fill="#334155" textAnchor="middle">Your name, Instructor</text>
      <text x="450" y="330" fontSize="9" fontWeight="600" fill={P} textAnchor="middle">Your company</text>

      {/* what happens next */}
      <rect x="28" y="370" width="244" height="38" rx="19" fill="#dcfce7" />
      <circle cx="52" cy="389" r="10" fill="#22c55e" />
      <path d="M47 389l4 4 7-8" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="70" y="394" fontSize="13" fontWeight="800" fill="#15803d">Generated automatically</text>
      <rect x="288" y="370" width="244" height="38" rx="19" fill="#e8f1fb" />
      <rect x="302" y="379" width="20" height="20" rx="4" fill="#0a66c2" />
      <text x="312" y="394" fontSize="12" fontWeight="800" fill="#fff" textAnchor="middle">in</text>
      <text x="332" y="394" fontSize="13" fontWeight="800" fill="#0a66c2">Shared on LinkedIn</text>
    </Frame>
  ),
  earnings: (
    <Frame title="Earnings">
      <Tile x={28} y={84} w={160} label="You earn" value="70%" />
      <Tile x={200} y={84} w={160} label="This month" value="$1,240" />
      <Tile x={372} y={84} w={160} label="Sales" value="38" />
      {[60, 95, 70, 130, 110, 160, 190].map((h, i) => (
        <rect key={i} x={50 + i * 66} y={400 - h} width="44" height={h} rx="8" fill={i === 6 ? P : '#cdbdf3'} />
      ))}
    </Frame>
  ),
  studio: (
    <Frame title="Recording studio">
      <rect x="28" y="80" width="504" height="248" rx="16" fill="#2a0a52" />
      <rect x="46" y="96" width="468" height="216" rx="10" fill="#fff" />
      <text x="70" y="132" fontSize="12" fontWeight="800" fill={P} letterSpacing="2">MODULE 1</text>
      <text x="70" y="166" fontSize="26" fontWeight="800" fill="#191625">What is the EU MDR?</text>
      <path d="M70 178c40-10 90 8 140-2s70-6 100 2" stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="70" y="200" width="200" height="10" rx="5" fill="#e4ddf4" />
      <rect x="70" y="224" width="160" height="10" rx="5" fill="#e4ddf4" />
      <rect x="70" y="248" width="180" height="10" rx="5" fill="#e4ddf4" />
      <circle cx="450" cy="262" r="42" fill={T} stroke="#fff" strokeWidth="5" />
      <g stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="450" cy="250" r="12" /><path d="M428 288v-4a14 14 0 0 1 14-14h16a14 14 0 0 1 14 14v4" /></g>
      <rect x="28" y="344" width="400" height="48" rx="12" fill="#f4f0ff" />
      {['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8'].map((c, i) => (
        <circle key={c} cx={56 + i * 30} cy="368" r="10" fill={c} />
      ))}
      <rect x="440" y="344" width="92" height="48" rx="12" fill="#ef4444" />
      <text x="486" y="374" fontSize="16" fontWeight="800" fill="#fff" textAnchor="middle">Stop</text>
    </Frame>
  ),
  visibility: (
    <Frame title="Course page">
      {/* the course detail page */}
      <rect x="24" y="76" width="512" height="126" rx="14" fill={P} />
      <text x="44" y="102" fontSize="10" fontWeight="800" fill={T} letterSpacing="2">EU MDR</text>
      <text x="44" y="132" fontSize="23" fontWeight="800" fill="#fff">EU MDR in practice</text>
      <text x="44" y="152" fontSize="12" fontWeight="500" fill="#e2d8ff">Everything you need to place your device on the EU market</text>
      <rect x="44" y="164" width="486" height="1" fill="#fff" opacity=".2" />
      <circle cx="64" cy="184" r="12" fill={T} />
      <text x="64" y="188" fontSize="10" fontWeight="800" fill="#fff" textAnchor="middle">AS</text>
      <text x="84" y="181" fontSize="12" fontWeight="800" fill="#fff">Alex Smith</text>
      <text x="84" y="195" fontSize="10.5" fontWeight="600" fill="#cdbdf3">MedTech Consulting</text>

      <rect x="24" y="214" width="240" height="26" rx="13" fill="#f4f0ff" />
      <text x="38" y="231" fontSize="11" fontWeight="800" fill={P}>Alex Smith · MedTech Consulting</text>
      <rect x="24" y="252" width="250" height="9" rx="4.5" fill="#e4ddf4" />
      <rect x="24" y="270" width="210" height="9" rx="4.5" fill="#e4ddf4" />
      <rect x="24" y="288" width="230" height="9" rx="4.5" fill="#e4ddf4" />
      <rect x="24" y="312" width="130" height="34" rx="17" fill={P} />
      <text x="89" y="334" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">Enroll now</text>

      {/* the certificate */}
      <g transform="rotate(-3 410 300)">
        <rect x="286" y="212" width="250" height="186" rx="8" fill="#f8f6ff" stroke={P} strokeWidth="2.5" />
        <rect x="294" y="220" width="234" height="170" rx="4" fill="none" stroke="#d4a017" strokeWidth="1" opacity=".7" />
        <text x="411" y="242" fontSize="7" fontWeight="700" fill={P} textAnchor="middle" letterSpacing="3">EASY MEDICAL DEVICE ACADEMY</text>
        <text x="411" y="272" fontSize="22" fontWeight="700" fill="#1a1033" textAnchor="middle" letterSpacing="3">CERTIFICATE</text>
        <text x="411" y="304" fontSize="17" fontStyle="italic" fontWeight="700" fill="#3b0764" textAnchor="middle">Learner name</text>
        <line x1="351" y1="311" x2="471" y2="311" stroke="#d4a017" strokeWidth="1.5" />
        <text x="411" y="330" fontSize="10" fontWeight="700" fill="#581c87" textAnchor="middle">EU MDR in practice</text>
        <text x="470" y="364" fontSize="19" fontStyle="italic" fill="#3b0764" textAnchor="middle">Alex Smith</text>
        <line x1="425" y1="369" x2="515" y2="369" stroke={P} strokeWidth="1.5" />
        <text x="470" y="381" fontSize="7" fontWeight="700" fill="#334155" textAnchor="middle">Instructor, MedTech Consulting</text>
      </g>
    </Frame>
  ),
};

type Feature = { id: string; icon: LucideIcon; title: string; text: string; screens?: (keyof typeof pictures)[] };

const features: Feature[] = [
  {
    id: 'visibility',
    icon: Building2,
    title: 'Visibility for you and your company',
    text: 'Your name and your company appear on your course page and in the Academy catalog, in front of regulatory, quality and engineering professionals who may become your clients, partners or future colleagues.',
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Your own dashboard',
    text: 'Create and manage your courses, follow your learners and enrollments, and see your reviews in one place.',
  },
  {
    id: 'platform',
    icon: ShieldCheck,
    title: 'We run the platform',
    text: 'Video hosting, secure payments and automatic emails are included. You focus on teaching.',
  },
  {
    id: 'certificates',
    icon: Award,
    title: 'Certificates, automatically',
    text: 'When a learner passes the exam of your course, their certificate is generated automatically and can be verified online and shared on LinkedIn. Nothing to do on your side.',
  },
  {
    id: 'earnings',
    icon: Wallet,
    title: 'Earn from every sale',
    text: 'You earn a share of every enrollment in your courses, and you can see your earnings in your dashboard.',
  },
  {
    id: 'studio',
    icon: Video,
    title: 'Record easily in our virtual studio',
    text: 'Open the studio in your browser and teach like a pro: your slides and your camera appear together, you can draw on the slide to show what matters, and any mistake is cut out in two clicks. Nothing to install and no editing software. Your video is saved straight into your lesson, one lesson at a time.',
  },
];

// How much you scroll for each picture (in screen heights) on large screens
const SCROLL_PER_SCREEN = 0.5;

// every picture, in order, and the feature it belongs to
const steps = features.flatMap((feature, featureIndex) =>
  (feature.screens ?? [feature.id]).map((picture, screenIndex) => ({ picture: picture as string, featureIndex, screenIndex })),
);

export function WhyTeachScroller() {
  const [step, setStep] = useState(0);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const active = steps[step].featureIndex;

  // Large screens: the whole block stays in place and the scroll moves from one picture to the next.
  useEffect(() => {
    const update = () => {
      const box = wrapper.current;
      if (!box || window.innerWidth < 1024) return;
      const rect = box.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const progress = Math.min(0.9999, Math.max(0, -rect.top / travel));
      setStep(Math.floor(progress * steps.length));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // clicking a feature scrolls to its first picture
  function goTo(featureIndex: number) {
    const box = wrapper.current;
    if (!box) return;
    const first = steps.findIndex((item) => item.featureIndex === featureIndex);
    const travel = box.offsetHeight - window.innerHeight;
    const top = box.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((first + 0.5) / steps.length) * travel, behavior: 'smooth' });
  }

  const screensOfActive = steps.filter((item) => item.featureIndex === active);

  return (
    <>
      {/* large screens: pinned */}
      <div ref={wrapper} className="relative mt-10 hidden lg:block" style={{ height: `${100 + steps.length * SCROLL_PER_SCREEN * 100}vh` }}>
        <div className="sticky top-16 grid h-[calc(100vh-4rem)] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-16">
          <div>
            <div className="relative aspect-[4/3] w-full">
              {steps.map((item, index) => (
                <div
                  key={item.picture}
                  aria-hidden={step !== index}
                  className={`absolute inset-0 transition-opacity ${step === index ? 'opacity-100 duration-500 delay-200' : 'pointer-events-none opacity-0 duration-300'}`}
                >
                  {pictures[item.picture]}
                </div>
              ))}
            </div>
            {/* small dots when a feature has several pictures */}
            <div className="mt-4 flex h-2 justify-center gap-2" aria-hidden="true">
              {screensOfActive.length > 1
                ? screensOfActive.map((item) => (
                    <span key={item.picture} className={`h-2 rounded-full transition-all duration-300 ${steps[step].picture === item.picture ? 'w-6 bg-[#7c3aed]' : 'w-2 bg-[#cdbdf3]'}`} />
                  ))
                : null}
            </div>
          </div>

          <ol className="space-y-3">
            {features.map(({ id, icon: Icon, title, text }, index) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={active === index}
                  className={`w-full rounded-2xl border p-4 text-left transition-all duration-500 ${
                    active === index ? 'border-[#7c3aed]/50 bg-white shadow-lg' : 'border-[#e4ddf4] bg-white/70 shadow-sm hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className={`text-base font-black transition-colors duration-500 ${active === index ? 'text-[#191625]' : 'text-[#6e687d]'}`}>{title}</span>
                  </span>
                  <span className={`grid transition-all duration-500 ease-out ${active === index ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <span className="overflow-hidden text-sm leading-6 text-[#5f5872]">{text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* small screens: one after the other, each with its pictures */}
      <ol className="mt-10 space-y-6 lg:hidden">
        {features.map(({ id, icon: Icon, title, text, screens }) => (
          <li key={id} className="rounded-2xl border border-[#e4ddf4] bg-white p-6 shadow-sm">
            <div className="mb-5 space-y-3">
              {(screens ?? [id]).map((picture) => (
                <div key={picture as string} className="aspect-[4/3] w-full overflow-hidden rounded-xl">{pictures[picture as string]}</div>
              ))}
            </div>
            <span className="flex size-11 items-center justify-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5f5872]">{text}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
