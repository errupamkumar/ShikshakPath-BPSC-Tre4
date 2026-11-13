import type { TKey } from "@/lib/i18n";

// Serializable menu data passed from the server header to the client menus.
export type MenuSubject = { key: string; name: string; short: string; tone: string; live: boolean; tests: number };
export type MenuExam = { key: string; short: string; name: string; posts: string; logo?: string; subjects: MenuSubject[] };
export type NavLink = { href: string; label: TKey; wide?: boolean };

/** Main portal links (header + mobile menu), after the Exams menu. `wide` = only on extra-wide screens. */
export const NAV_LINKS: NavLink[] = [
  { href: "/tests", label: "nav.testSeries" },
  { href: "/pyq", label: "nav.pyq" },
];
/** Shown after the eBooks menu. */
export const NAV_LINKS_END: NavLink[] = [
  { href: "/#pricing", label: "nav.pricing", wide: true },
  { href: "/about", label: "nav.about", wide: true },
];
