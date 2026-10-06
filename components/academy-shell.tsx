"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Code2,
  ChevronDown,
  Globe,
  GraduationCap,
  Laptop,
  ListChecks,
  LogOut,
  Mic,
  Microscope,
  Network,
  Newspaper,
  Scale,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import {
  clearAcademySession,
  getAcademyAvatarUrl,
  getAcademyDisplayName,
  getStoredAcademySession,
  type AcademySession,
} from "@/lib/academy-session";

/* ── Menu data ──────────────────────────────── */
type MegaMenuItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  newTab?: boolean;
};

const expertiseMenuItems: MegaMenuItem[] = [
  { title: "Medical Devices", description: "Support every device class with expert guidance toward regulatory approval.", href: "https://easymedicaldevice.com/expertise/medical-devices/", icon: Stethoscope },
  { title: "IVD", description: "Help diagnostic manufacturers achieve compliance and faster global market approvals.", href: "https://easymedicaldevice.com/expertise/ivd/", icon: Microscope },
  { title: "Software as Medical Device", description: "Guide medical software to compliance and successful market entry.", href: "https://easymedicaldevice.com/expertise/software-as-medical-device/", icon: Laptop },
  { title: "AI / Digital Health", description: "Navigate AI regulation confidently and bring innovation safely to market.", href: "https://easymedicaldevice.com/expertise/ai-digital-health/", icon: Network },
];

const learnMenuItems: MegaMenuItem[] = [
  { title: "Blog", description: "Stay informed with clear regulatory insights that simplify complex compliance decisions.", href: "https://easymedicaldevice.com/blog/", icon: Newspaper },
  { title: "Podcast", description: "Learn directly from experts simplifying medical device compliance and regulation.", href: "https://podcast.easymedicaldevice.com/", icon: Mic, newTab: true },
  { title: "Medical Device Regulations", description: "Explore country-specific medical device regulations, registration requirements, and market access guidance.", href: "https://easymedicaldevice.com/regulations/", icon: Globe },
  { title: "Medical Device Events", description: "Discover upcoming MedTech conferences, regulatory webinars, healthcare events, and industry meetings worldwide.", href: "https://easymedicaldevice.com/events/", icon: Calendar },
  { title: "Magazines", description: "Explore in-depth regulatory trends and practical guidance for medical device success.", href: "https://easymedicaldevice.com/emd-mag/", icon: BookOpen },
  { title: "Academy", description: "Build regulatory skills through practical training designed for real-world success.", href: "/academy", icon: GraduationCap },
];

const aboutMenuItems: MegaMenuItem[] = [
  { title: "Company Overview", description: "Discover who we are and how we help you succeed.", href: "https://easymedicaldevice.com/about/", icon: Building2 },
  { title: "Our Team", description: "Meet experts dedicated to guiding your products safely to market.", href: "https://easymedicaldevice.com/team/", icon: Users },
];

type ServiceGroup = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: { label: string; href: string }[];
};

const SITE = "https://easymedicaldevice.com";

// Two columns, same layout as easymedicaldevice.com
const servicesMenuColumns: ServiceGroup[][] = [
  [
    {
      title: "Regulatory Consulting",
      icon: Scale,
      links: [
        { label: "Global Market Access", href: `${SITE}/services/medical-device-market-access/` },
        { label: "IVDR Consulting", href: `${SITE}/services/medical-device-ivdr-consulting/` },
        { label: "EU MDR Consulting", href: `${SITE}/services/medical-device-eu-mdr-consulting/` },
        { label: "FDA Consulting", href: `${SITE}/services/fda-medical-device-consulting/` },
        { label: "Authorized Representative", href: `${SITE}/services/medical-device-authorized-representative/` },
      ],
    },
    {
      title: "Quality Consulting",
      icon: ShieldCheck,
      links: [
        { label: "ISO 13485 Consulting", href: `${SITE}/services/medical-device-iso-13485-consulting/` },
        { label: "Audit & Inspection Readiness", href: `${SITE}/services/medical-device-audit-services/` },
        { label: "Quality & Risk Management Systems", href: `${SITE}/services/medical-device-risk-management/` },
        { label: "Regulatory Updates", href: `${SITE}/services/medical-device-regulatory-updates/` },
      ],
    },
    {
      title: "Verification & Validation",
      icon: ListChecks,
      links: [
        { label: "Biocompatibility Testing", href: `${SITE}/services/medical-device-biocompatibility-testing/` },
        { label: "Packaging & Labeling Compliance", href: `${SITE}/services/medical-device-packaging-and-labeling/` },
        { label: "Electromagnetic Compatibility", href: `${SITE}/services/medical-device-emc-testing/` },
        { label: "Usability testing", href: `${SITE}/services/medical-device-usability-testing/` },
        { label: "Cybersecurity", href: `${SITE}/services/medical-device-cybersecurity/` },
      ],
    },
    {
      title: "Additional Team",
      icon: Users,
      links: [
        { label: "Additional Regulatory Team", href: `${SITE}/services/additional-regulatory-team/` },
        { label: "Additional Quality Team", href: `${SITE}/services/additional-quality-team/` },
        { label: "PRRC Services", href: `${SITE}/services/prrc-services/` },
      ],
    },
  ],
  [
    {
      title: "Design & Development",
      icon: Code2,
      links: [
        { label: "Medical Device Software Development", href: `${SITE}/services/medical-device-software-development/` },
      ],
    },
    {
      title: "Business Setup & Corporate Services",
      icon: Building2,
      links: [
        { label: "Company Registration", href: `${SITE}/services/medical-device-manufacturer-registration/` },
        { label: "Bank Account Opening", href: `${SITE}/services/business-bank-account-opening/` },
      ],
    },
    {
      title: "Platforms",
      icon: Laptop,
      links: [
        { label: "EasyIFU", href: `${SITE}/easyifu/` },
        { label: "SmartEye – eQMS", href: `${SITE}/smarteye-eqms/` },
      ],
    },
  ],
];

type MainMenuItem = {
  label: string;
  href: string;
  megaMenu?: MegaMenuItem[];
  serviceColumns?: ServiceGroup[][];
  width?: string;
  gridCols?: string;
};

const mainSiteMenu: MainMenuItem[] = [
  { label: "Services", href: "https://easymedicaldevice.com/services/", serviceColumns: servicesMenuColumns, width: "w-[960px]" },
  { label: "Expertise", href: "https://easymedicaldevice.com/expertise/", megaMenu: expertiseMenuItems, width: "w-[700px]", gridCols: "grid-cols-2" },
  { label: "Learn", href: "https://easymedicaldevice.com/blog/", megaMenu: learnMenuItems, width: "w-[750px]", gridCols: "grid-cols-2" },
  { label: "About", href: "https://easymedicaldevice.com/about/", megaMenu: aboutMenuItems, width: "w-[390px]", gridCols: "grid-cols-1" },
];

/* ── AcademyHeader ──────────────────────────── */
export function AcademyHeader({
  activePage = "home",
}: {
  activePage?: "home" | "my-learning" | "auth" | "profile";
} = {}) {
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);
  const [session, setSession] = useState<AcademySession | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openServiceGroups, setOpenServiceGroups] = useState<string[]>([]);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSession(getStoredAcademySession());
    const handler = () => {
      setSession(getStoredAcademySession());
    };
    window.addEventListener("academy-auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("academy-auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    clearAcademySession();
    setProfileOpen(false);
    window.location.assign("/academy");
  };

  const displayName = getAcademyDisplayName(session);
  const avatarUrl = getAcademyAvatarUrl(session);
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const toggleServiceGroup = (title: string) =>
    setOpenServiceGroups((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title],
    );

  const handleMouseEnter = (label: string) => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    setActiveMegaMenu(label);
  };

  const handleMouseLeave = () => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    menuTimeoutRef.current = setTimeout(() => setActiveMegaMenu(null), 150);
  };

  return (
    <>
      <header className="relative z-50 border-b border-[#ded6f3]/60 bg-[#f8f6ff]">
      <div className="mx-auto grid min-h-[92px] max-w-[1380px] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:min-h-[112px] lg:grid-cols-[150px_1fr_260px] lg:px-8">
        <a href="https://easymedicaldevice.com/" aria-label="Easy Medical Device home" className="flex w-fit items-center">
          <img src="/easy-medical-device-logo.png" alt="Easy Medical Device" className="size-[76px] object-contain lg:size-[92px]" />
        </a>

        {/* Desktop nav */}
        <nav aria-label="Easy Medical Device main menu" className="hidden items-center gap-8 justify-self-start text-[17px] font-medium text-black lg:flex">
          {mainSiteMenu.map((item) => (
            <div
              key={item.label}
              className="relative flex items-center h-14"
              onMouseEnter={() => (item.megaMenu || item.serviceColumns) ? handleMouseEnter(item.label) : setActiveMegaMenu(null)}
              onMouseLeave={handleMouseLeave}
            >
              <a
                href={item.href}
                className={`relative inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-[17px] font-medium transition ${activeMegaMenu === item.label ? "text-[#6b34e9]" : "text-black hover:text-[#6b34e9]"}`}
                onClick={(e) => { if (item.megaMenu || item.serviceColumns) setActiveMegaMenu((prev) => prev === item.label ? null : item.label); }}
              >
                <span>{item.label}</span>
                {(item.megaMenu || item.serviceColumns) && (
                  <ChevronDown className={`size-4 stroke-[2.2] transition-transform duration-200 ${activeMegaMenu === item.label ? "rotate-180 text-[#6b34e9]" : ""}`} aria-hidden="true" />
                )}
                {activeMegaMenu === item.label && (
                  <span className="absolute bottom-1 left-1 right-1 h-[3px] rounded-full bg-[#6b34e9]" />
                )}
              </a>

              {item.serviceColumns && activeMegaMenu === item.label && (
                <div
                  className={`absolute left-0 top-[calc(100%+2px)] z-50 max-h-[80vh] overflow-y-auto rounded-3xl border border-[#ded6f3] bg-white p-8 shadow-[0_20px_60px_rgba(25,22,37,0.16)] ${item.width}`}
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="grid grid-cols-2 gap-x-12">
                    {item.serviceColumns.map((column, columnIndex) => (
                      <div key={columnIndex} className="space-y-7">
                        {column.map((group) => {
                          const GroupIcon = group.icon;
                          return (
                            <div key={group.title}>
                              <button
                                type="button"
                                onClick={() => toggleServiceGroup(group.title)}
                                aria-expanded={openServiceGroups.includes(group.title)}
                                className="group flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#191625] text-[#191625] transition group-hover:border-[#6b34e9] group-hover:text-[#6b34e9]">
                                    <GroupIcon className="size-[18px] stroke-[1.8]" />
                                  </span>
                                  <span className="text-[15px] font-bold leading-tight text-[#191625] transition group-hover:text-[#6b34e9]">{group.title}</span>
                                </span>
                                <ChevronDown
                                  className={`size-4 shrink-0 text-[#191625] transition-transform duration-200 ${openServiceGroups.includes(group.title) ? "rotate-180" : ""}`}
                                  aria-hidden="true"
                                />
                              </button>
                              {openServiceGroups.includes(group.title) ? (
                                <ul className="mt-3 list-[circle] space-y-1.5 pl-[3.25rem] marker:text-[#514b63]">
                                  {group.links.map((link) => (
                                    <li key={link.href} className="text-[15px] leading-6 text-[#3b3650]">
                                      <a href={link.href} className="underline decoration-[#8b849a] underline-offset-2 transition hover:text-[#6b34e9] hover:decoration-[#6b34e9]">
                                        {link.label}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.megaMenu && activeMegaMenu === item.label && (
                <div
                  className={`absolute top-[calc(100%+2px)] ${item.label === "About" ? "left-0" : item.label === "Learn" ? "left-1/2 -translate-x-1/3" : "left-0"} z-50 rounded-3xl border border-[#ded6f3] bg-white p-6 shadow-[0_20px_60px_rgba(25,22,37,0.16)] ${item.width}`}
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className={`grid ${item.gridCols} gap-x-8 gap-y-4`}>
                    {item.megaMenu.map((subItem) => {
                      const Icon = subItem.icon;
                      return (
                        <a key={subItem.title} href={subItem.href} {...(subItem.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group flex items-start gap-4 rounded-2xl p-3 transition hover:bg-[#f8f6ff]">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#191625] bg-white text-[#191625] transition group-hover:border-[#6b34e9] group-hover:text-[#6b34e9]">
                            <Icon className="size-5 stroke-[1.8]" />
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold leading-tight text-[#191625] transition group-hover:text-[#6b34e9]">{subItem.title}</h4>
                            <p className="mt-1 text-[13px] leading-relaxed text-[#514b63]">{subItem.description}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <a href="https://easymedicaldevice.com/contact/" className="inline-flex h-[52px] min-w-[148px] items-center justify-center rounded-lg bg-[#eee8fb] px-6 text-base font-medium text-[#6b34e9] transition hover:bg-[#e6dcfb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b34e9]/20 sm:min-w-[190px] lg:h-[54px] lg:min-w-[260px]">
          Let&apos;s Talk
        </a>

        {/* Mobile accordion */}
        <div className="col-span-2 flex flex-col gap-2 pb-3 lg:hidden">
          <nav aria-label="Easy Medical Device mobile main menu" className="flex items-center gap-3 overflow-x-auto text-sm font-medium text-black">
            {mainSiteMenu.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setMobileMenuOpen((prev) => prev === item.label ? null : item.label)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${mobileMenuOpen === item.label ? "bg-[#7c3aed] text-white" : "bg-white text-[#201b31] border border-[#ded6f3]"}`}
              >
                <span>{item.label}</span>
                {(item.megaMenu || item.serviceColumns) && (
                  <ChevronDown className={`size-3.5 transition-transform ${mobileMenuOpen === item.label ? "rotate-180" : ""}`} aria-hidden="true" />
                )}
              </button>
            ))}
          </nav>
          {mobileMenuOpen === "Services" && (
            <div className="mt-2 max-h-[70vh] space-y-5 overflow-y-auto rounded-2xl border border-[#ded6f3] bg-white p-4 shadow-lg">
              {servicesMenuColumns.flat().map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => toggleServiceGroup(group.title)}
                      aria-expanded={openServiceGroups.includes(group.title)}
                      className="flex w-full items-center justify-between gap-2.5 text-left text-sm font-bold text-[#191625]"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#191625]">
                          <GroupIcon className="size-4" />
                        </span>
                        {group.title}
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 transition-transform ${openServiceGroups.includes(group.title) ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {openServiceGroups.includes(group.title) ? (
                      <ul className="mt-2 list-[circle] space-y-1 pl-12 text-sm text-[#3b3650]">
                        {group.links.map((link) => (
                          <li key={link.href}>
                            <a href={link.href} className="underline underline-offset-2">{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {mobileMenuOpen && mobileMenuOpen !== "Services" && (
            <div className="mt-2 rounded-2xl border border-[#ded6f3] bg-white p-4 shadow-lg">
              {mainSiteMenu.find((m) => m.label === mobileMenuOpen)?.megaMenu?.map((subItem) => {
                const Icon = subItem.icon;
                return (
                  <a key={subItem.title} href={subItem.href} {...(subItem.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-[#f8f6ff]">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#191625] text-[#191625]">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#191625]">{subItem.title}</p>
                      <p className="text-xs text-[#625b75]">{subItem.description}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </header>

    {/* Academy sticky sub-nav */}
    <section className="sticky top-0 z-40 border-b border-[#ded6f3]/60 bg-[#f8f6ff]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/academy" className="group flex flex-col justify-center transition">
          <span className="text-[11px] sm:text-xs font-semibold text-[#6e687e] group-hover:text-[#171321] leading-none transition-colors">
            Easy Medical Device
          </span>
          <span className="text-xl sm:text-2xl font-black tracking-tight text-[#7c3aed] group-hover:text-[#6d31dc] leading-none mt-1 transition-colors">
            Academy
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[#514b63] md:flex">
          <Link href="/academy#courses" className="transition hover:text-[#6b34e9]">Courses</Link>
          <Link href="/academy#certificate" className="transition hover:text-[#6b34e9]">Certificate</Link>
          <Link href="/academy#instructor" className="transition hover:text-[#6b34e9]">Instructor</Link>
          <Link href="/academy#community" className="transition hover:text-[#6b34e9]">Community</Link>
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link
                href="/academy/my-learning"
                className={`hidden rounded-lg px-3 py-2 text-sm transition sm:inline-flex ${
                  activePage === "my-learning"
                    ? "font-bold text-[#7c3aed] bg-white border border-[#ded6f3]"
                    : "font-semibold text-[#514b63] hover:bg-white hover:text-[#6b34e9]"
                }`}
              >
                My Learning
              </Link>

              {/* Profile Avatar Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-[#7c3aed]/40 focus:outline-none"
                  aria-label="User profile menu"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="size-9 rounded-full object-cover ring-2 ring-[#7c3aed]/30"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-bold text-white ring-2 ring-[#7c3aed]/30">
                      {initials}
                    </div>
                  )}
                  <ChevronDown
                    className={`size-3.5 text-[#6e687e] transition-transform duration-200 ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-[#ded6f3] bg-white p-2 shadow-[0_16px_40px_rgba(25,22,37,0.12)]">
                    {/* User info header */}
                    <div className="flex items-center gap-3 border-b border-[#ede8fb] px-3 py-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="size-10 rounded-full object-cover ring-1 ring-[#7c3aed]/20"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-bold text-white">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#171321]">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-[#6e687d]">
                          {session.user.email}
                        </p>
                      </div>
                    </div>

                    {/* Navigation links */}
                    <div className="py-1">
                      <Link
                        href="/academy/profile"
                        onClick={() => setProfileOpen(false)}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          activePage === "profile"
                            ? "bg-[#f4f0ff] font-bold text-[#7c3aed]"
                            : "text-[#302945] hover:bg-[#f8f6ff] hover:text-[#6b34e9]"
                        }`}
                      >
                        <User className="size-4 text-[#7c3aed]" />
                        <span>My Profile</span>
                      </Link>

                      <Link
                        href="/academy/my-learning"
                        onClick={() => setProfileOpen(false)}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          activePage === "my-learning"
                            ? "bg-[#f4f0ff] font-bold text-[#7c3aed]"
                            : "text-[#302945] hover:bg-[#f8f6ff] hover:text-[#6b34e9]"
                        }`}
                      >
                        <GraduationCap className="size-4 text-[#7c3aed]" />
                        <span>My Learning</span>
                      </Link>
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-[#ede8fb] pt-1">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#b42318] transition hover:bg-[#fff5f5]"
                      >
                        <LogOut className="size-4 text-[#b42318]" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/academy/login"
                className={`hidden rounded-lg px-3 py-2 text-sm transition sm:inline-flex ${
                  activePage === "auth"
                    ? "font-bold text-[#7c3aed] bg-white border border-[#ded6f3]"
                    : "font-semibold text-[#514b63] hover:bg-white hover:text-[#6b34e9]"
                }`}
              >
                Log in
              </Link>
              <Link
                href="/academy/my-learning"
                className={`hidden rounded-lg px-3 py-2 text-sm transition sm:inline-flex ${
                  activePage === "my-learning"
                    ? "font-bold text-[#7c3aed] bg-white border border-[#ded6f3]"
                    : "font-semibold text-[#514b63] hover:bg-white hover:text-[#6b34e9]"
                }`}
              >
                My Learning
              </Link>
              {activePage === "my-learning" ? (
                <Link
                  href="/academy#courses"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-3.5 text-sm font-semibold text-white transition hover:bg-[#6d31dc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7c3aed]/20"
                >
                  Browse catalog
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  href="/academy/learn"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-3.5 text-sm font-semibold text-white transition hover:bg-[#6d31dc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7c3aed]/20"
                >
                  Start learning
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  </>
  );
}

/* ── AcademyFooter ──────────────────────────── */
const MAIN_SITE = "https://easymedicaldevice.com";

const footerColumns: {
  title: string;
  links: { label: string; href: string }[];
}[][] = [
  [
    {
      title: "Services",
      links: [
        { label: "Market Access", href: `${MAIN_SITE}/services/market-access/` },
        {
          label: "MDR & IVDR Technical Documentation",
          href: `${MAIN_SITE}/services/mdr-ivdr-technical-documentation/`,
        },
        {
          label: "Quality & Risk Management Systems",
          href: `${MAIN_SITE}/services/quality-risk-management-systems/`,
        },
        {
          label: "Software & Digital Health Compliance",
          href: `${MAIN_SITE}/services/software-digital-health-compliance/`,
        },
        {
          label: "Packaging & Labeling Compliance",
          href: `${MAIN_SITE}/services/packaging-labeling-compliance/`,
        },
        {
          label: "Audit & Inspection Readiness",
          href: `${MAIN_SITE}/services/audit-inspection-readiness/`,
        },
      ],
    },
  ],
  [
    {
      title: "Platforms",
      links: [
        { label: "EasyIFU", href: `${MAIN_SITE}/easyifu/` },
        { label: "SmartEye – eQMS", href: `${MAIN_SITE}/smarteye-eqms/` },
      ],
    },
    {
      title: "Expertise",
      links: [
        { label: "Medical Devices", href: `${MAIN_SITE}/expertise/medical-devices/` },
        { label: "IVD", href: `${MAIN_SITE}/expertise/ivd/` },
        {
          label: "Software as Medical Device",
          href: `${MAIN_SITE}/expertise/software-as-medical-device/`,
        },
        { label: "AI / Digital Health", href: `${MAIN_SITE}/expertise/ai-digital-health/` },
      ],
    },
  ],
  [
    {
      title: "Learn",
      links: [
        { label: "Blog", href: `${MAIN_SITE}/blog/` },
        { label: "Magazines", href: `${MAIN_SITE}/emd-mag/` },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Company Overview", href: `${MAIN_SITE}/about/` },
        { label: "Our Team", href: `${MAIN_SITE}/team/` },
      ],
    },
  ],
];

// Check these point to the right Easy Medical Device profiles.
const socialLinks: { label: string; href: string; path: string }[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/easymedicaldevice",
    path: "M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z",
  },
  {
    label: "X",
    href: "https://x.com/easymedicaldev",
    path: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/easymedicaldevice",
    path: "M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@easymedicaldevice",
    path: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/easy-medical-device",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3V9.5zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.700V21h-4V9.5z",
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/show/easymedicaldevice",
    path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.62.62 0 0 1-.86.2c-2.36-1.44-5.32-1.77-8.8-.97a.62.62 0 1 1-.28-1.2c3.82-.87 7.1-.5 9.74 1.11.3.18.4.57.2.86zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.7-1.66-6.8-2.14-9.99-1.17a.78.78 0 1 1-.45-1.5c3.64-1.1 8.17-.57 11.25 1.34.37.22.48.7.26 1.07zm.1-2.83C14.7 8.9 9.4 8.7 6.3 9.65a.93.93 0 1 1-.54-1.78c3.55-1.08 9.4-.87 13.1 1.32a.93.93 0 0 1-.94 1.6z",
  },
];

export function AcademyFooter() {
  return (
    <footer className="border-t border-[#e5def2] bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <a href="/academy" aria-label="Easy Medical Device Academy">
              <img
                src="/easy-medical-device-logo.png"
                alt="Easy Medical Device"
                className="size-20 object-contain"
              />
            </a>
            <p className="mt-2 text-xl font-black tracking-tight text-[#7c3aed]">Academy</p>
            <div className="mt-5 flex items-center gap-4 text-[#3b3650]">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="transition hover:text-[#7c3aed]"
                >
                  <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {footerColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="space-y-8">
                {column.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-lg font-bold text-[#171321]">{group.title}</h3>
                    <ul className="mt-4 space-y-3">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            className="text-[15px] leading-6 text-[#3b3650] transition hover:text-[#7c3aed]"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[#ece8f6] py-6 text-sm text-[#4b4660] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-8">
            <a href={`${MAIN_SITE}/privacy-policy/`} className="underline hover:text-[#7c3aed]">
              Privacy Policy
            </a>
            <a href={`${MAIN_SITE}/terms-of-service/`} className="underline hover:text-[#7c3aed]">
              Terms of Service
            </a>
          </div>
          <p>© 2017 - {new Date().getFullYear()} • Easy Medical Device GmbH • All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
