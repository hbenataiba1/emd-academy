"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  Globe,
  GraduationCap,
  Laptop,
  LogOut,
  Mic,
  Microscope,
  Network,
  Newspaper,
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
};

const expertiseMenuItems: MegaMenuItem[] = [
  { title: "Medical Devices", description: "Support every device class with expert guidance toward regulatory approval.", href: "https://easymedicaldevice.com/medical-devices/", icon: Stethoscope },
  { title: "Software as Medical Device", description: "Guide medical software to compliance and successful market entry.", href: "https://easymedicaldevice.com/software-as-a-medical-device/", icon: Laptop },
  { title: "IVD", description: "Help diagnostic manufacturers achieve compliance and faster global market approvals.", href: "https://easymedicaldevice.com/in-vitro-diagnostic/", icon: Microscope },
  { title: "AI / Digital Health", description: "Navigate AI regulation confidently and bring innovation safely to market.", href: "https://easymedicaldevice.com/ai-digital-health/", icon: Network },
];

const learnMenuItems: MegaMenuItem[] = [
  { title: "Blog", description: "Stay informed with clear regulatory insights that simplify complex compliance decisions.", href: "https://easymedicaldevice.com/blog/", icon: Newspaper },
  { title: "Medical Device Events", description: "Discover upcoming MedTech conferences, regulatory webinars, healthcare events, and industry meetings worldwide.", href: "https://easymedicaldevice.com/events/", icon: Calendar },
  { title: "Podcast", description: "Learn directly from experts simplifying medical device compliance and regulation.", href: "https://easymedicaldevice.com/podcast/", icon: Mic },
  { title: "Magazines", description: "Explore in-depth regulatory trends and practical guidance for medical device success.", href: "https://easymedicaldevice.com/magazines/", icon: BookOpen },
  { title: "Medical Device Regulations", description: "Explore country-specific medical device regulations, registration requirements, and market access guidance.", href: "https://easymedicaldevice.com/regulations/", icon: Globe },
  { title: "School", description: "Build regulatory skills through practical training designed for real-world success.", href: "/academy", icon: GraduationCap },
];

const aboutMenuItems: MegaMenuItem[] = [
  { title: "Company Overview", description: "Discover who we are and how we help you succeed.", href: "https://easymedicaldevice.com/about/", icon: Building2 },
  { title: "Our Team", description: "Meet experts dedicated to guiding your products safely to market.", href: "https://easymedicaldevice.com/team/", icon: Users },
];

const mainSiteMenu = [
  { label: "Services", href: "https://easymedicaldevice.com/services/" },
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
              onMouseEnter={() => item.megaMenu ? handleMouseEnter(item.label) : setActiveMegaMenu(null)}
              onMouseLeave={handleMouseLeave}
            >
              <a
                href={item.href}
                className={`relative inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-[17px] font-medium transition ${activeMegaMenu === item.label ? "text-[#6b34e9]" : "text-black hover:text-[#6b34e9]"}`}
                onClick={(e) => { if (item.megaMenu) setActiveMegaMenu((prev) => prev === item.label ? null : item.label); }}
              >
                <span>{item.label}</span>
                {item.megaMenu && (
                  <ChevronDown className={`size-4 stroke-[2.2] transition-transform duration-200 ${activeMegaMenu === item.label ? "rotate-180 text-[#6b34e9]" : ""}`} aria-hidden="true" />
                )}
                {activeMegaMenu === item.label && (
                  <span className="absolute bottom-1 left-1 right-1 h-[3px] rounded-full bg-[#6b34e9]" />
                )}
              </a>

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
                        <a key={subItem.title} href={subItem.href} className="group flex items-start gap-4 rounded-2xl p-3 transition hover:bg-[#f8f6ff]">
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
                {item.megaMenu && (
                  <ChevronDown className={`size-3.5 transition-transform ${mobileMenuOpen === item.label ? "rotate-180" : ""}`} aria-hidden="true" />
                )}
              </button>
            ))}
          </nav>
          {mobileMenuOpen && (
            <div className="mt-2 rounded-2xl border border-[#ded6f3] bg-white p-4 shadow-lg">
              {mainSiteMenu.find((m) => m.label === mobileMenuOpen)?.megaMenu?.map((subItem) => {
                const Icon = subItem.icon;
                return (
                  <a key={subItem.title} href={subItem.href} className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-[#f8f6ff]">
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
export function AcademyFooter() {
  return (
    <footer className="border-t border-[#e5def2] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-[#625b75] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex flex-col">
          <span className="text-[11px] sm:text-xs font-semibold text-[#8b849a] leading-none">
            Easy Medical Device
          </span>
          <p className="text-xl font-black tracking-tight text-[#7c3aed] leading-none mt-1">Academy</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/academy#courses" className="hover:text-[#7c3aed]">Courses</a>
          <a href="/academy#certificate" className="hover:text-[#7c3aed]">Certificate</a>
          <a href="/academy#instructor" className="hover:text-[#7c3aed]">Instructor</a>
          <a href="/academy#community" className="hover:text-[#7c3aed]">Community</a>
          <a href="https://easymedicaldevice.com" className="hover:text-[#7c3aed]">Main website</a>
        </div>
        <p className="text-xs text-[#a09ab5]">
          © {new Date().getFullYear()} Easy Medical Device Academy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
