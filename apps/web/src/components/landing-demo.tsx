import * as stylex from '@stylexjs/stylex';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Button, StatusDot, Tabs } from './ui';
import { fonts, tokens } from '../theme.stylex';

type DemoJob = {
  id: string;
  title: string;
  company: string;
  companyMark: string;
  companyTone: 'violet' | 'mint' | 'sun' | 'coral';
  location: string;
  posted: string;
  salary: string;
  score: number;
  reason: string;
  skills: string[];
  source: string;
  url: string;
  fresh?: boolean;
};

const DEMO_JOBS: DemoJob[] = [
  {
    id: 'linear-staff-product-designer',
    title: 'Staff Product Designer',
    company: 'Linear',
    companyMark: 'L',
    companyTone: 'violet',
    location: 'Remote · EU time zones',
    posted: '2h ago',
    salary: '€95k–€125k',
    score: 94,
    reason: 'Your product systems experience maps directly to this role.',
    skills: ['Product strategy', 'Figma', 'Design systems'],
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/jobs/view/linear-staff-product-designer',
    fresh: true,
  },
  {
    id: 'wise-senior-product-designer',
    title: 'Senior Product Designer',
    company: 'Wise',
    companyMark: 'W',
    companyTone: 'mint',
    location: 'Amsterdam · Hybrid',
    posted: '5h ago',
    salary: '€88k–€112k',
    score: 87,
    reason: 'Strong overlap in research, systems thinking, and cross-functional work.',
    skills: ['User research', 'Fintech', 'Prototyping'],
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/jobs/view/wise-senior-product-designer',
  },
  {
    id: 'deel-product-designer',
    title: 'Product Designer',
    company: 'Deel',
    companyMark: 'D',
    companyTone: 'sun',
    location: 'Remote · Worldwide',
    posted: 'Yesterday',
    salary: '$120k–$155k',
    score: 81,
    reason: 'A good fit for your remote-first and product-led experience.',
    skills: ['Remote work', 'B2B SaaS', 'Interaction'],
    source: 'Glints',
    url: 'https://www.glints.com/jobs/product-designer-deel',
  },
  {
    id: 'monzo-design-lead',
    title: 'Design Lead, Growth',
    company: 'Monzo',
    companyMark: 'M',
    companyTone: 'coral',
    location: 'London · Hybrid',
    posted: '2d ago',
    salary: '£105k–£130k',
    score: 76,
    reason: 'Your growth experimentation background is a useful differentiator.',
    skills: ['Growth', 'Experimentation', 'Leadership'],
    source: 'Indeed',
    url: 'https://uk.indeed.com/viewjob?jk=monzo-design-lead',
  },
];

const PROFILE = {
  name: 'Mara Chen',
  role: 'Senior product designer',
  location: 'Berlin, Germany',
  cvName: 'mara-chen-product-design.pdf',
  cvUpdated: 'Updated 2 days ago',
  activeAlerts: 4,
  newToday: 12,
  averageMatch: 86,
};

const DISCORD_CHANNEL = {
  guild: 'Mara’s job search',
  channel: 'design-leads',
  time: 'Today at 09:42',
};

const FILTERS = [
  { value: 'for-you', label: 'For you' },
  { value: 'new', label: 'New today' },
  { value: 'saved', label: 'Saved' },
];

const COMPANY_COLORS: Record<DemoJob['companyTone'], { backgroundColor: string; color: string }> = {
  violet: { backgroundColor: '#ece8fb', color: '#6652a4' },
  mint: { backgroundColor: '#e0f0e7', color: '#277454' },
  sun: { backgroundColor: '#f6ecd5', color: '#94691f' },
  coral: { backgroundColor: '#f5e3dc', color: '#a3543d' },
};

type IconProps = { size?: number; className?: string; filled?: boolean };

function BookmarkIcon({ size = 15, className, filled = false }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
      <path d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75v16l-5.5-3.3-5.5 3.3v-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m5 12.5 4.25 4.25L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ size = 13, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ size = 12, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3.25 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiscordIcon({ size = 18, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 5.3A16 16 0 0 0 15 4.1l-.2.4a12.7 12.7 0 0 1 3.4 1.7 14.8 14.8 0 0 0-12.4 0 12.7 12.7 0 0 1 3.4-1.7l-.2-.4a16 16 0 0 0-3.9 1.2C2.3 9.1 1.6 12.8 2 16.4a16.1 16.1 0 0 0 4.9 2.5l1.1-1.5c-.9-.3-1.7-.8-2.5-1.4l.6-.5a11.4 11.4 0 0 0 9.8 0l.6.5c-.8.6-1.6 1.1-2.5 1.4l1.1 1.5a16.1 16.1 0 0 0 4.9-2.5c.5-4.2-.7-7.8-3.1-11.1ZM8.7 14.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

function HashIcon({ size = 14, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ size = 14, className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="10.75" cy="10.75" r="6.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const styles = stylex.create({
  page: {
    width: '100%',
    maxWidth: 1120,
    marginLeft: 'auto',
    marginRight: 'auto',
    fontFamily: fonts.sans,
    color: tokens.ink,
  },
  utilityBar: {
    minHeight: 31,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
    color: tokens.muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  utilityStatus: { display: 'flex', alignItems: 'center', gap: 13 },
  utilityStatusText: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  pageHeader: {
    minHeight: 68,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
  },
  pageNav: { display: 'flex', alignItems: 'center', gap: 22, marginLeft: 'auto', marginRight: 8 },
  pageNavLink: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: 650,
    textDecoration: 'none',
    ':hover': { color: tokens.ink },
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) 310px',
      '@media (max-width: 760px)': '1fr',
    },
    alignItems: 'center',
    gap: {
      default: 64,
      '@media (max-width: 760px)': 36,
    },
    paddingTop: {
      default: 58,
      '@media (max-width: 760px)': 42,
    },
    paddingBottom: {
      default: 64,
      '@media (max-width: 760px)': 48,
    },
  },
  eyebrow: {
    color: tokens.accent,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.12em',
    lineHeight: 1.25,
    textTransform: 'uppercase',
  },
  heroTitle: {
    maxWidth: 650,
    marginTop: 16,
    color: tokens.ink,
    fontSize: 'clamp(43px, 5.7vw, 70px)',
    fontWeight: 800,
    letterSpacing: '-0.065em',
    lineHeight: 0.98,
  },
  heroLede: { maxWidth: 540, marginTop: 21, color: tokens.muted, fontSize: 16, lineHeight: '26px' },
  heroActions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 27 },
  assurances: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 13, marginTop: 25, color: tokens.muted, fontSize: 10, fontWeight: 650 },
  assurance: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  profileCard: { padding: 20, borderWidth: 1, borderStyle: 'solid', borderColor: tokens.line, borderRadius: tokens.radiusMd, backgroundColor: tokens.surface },
  profileHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  profileName: { marginTop: 6, color: tokens.ink, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: '20px' },
  profileRole: { marginTop: 2, color: tokens.muted, fontSize: 11, lineHeight: '16px' },
  profileScore: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 27 },
  profileScoreValue: { color: tokens.accent, fontSize: 34, fontWeight: 800, letterSpacing: '-0.07em', lineHeight: 1 },
  profileScoreLabel: { color: tokens.muted, fontSize: 10, fontWeight: 700 },
  profileTrack: { height: 5, marginTop: 10, overflow: 'hidden', borderRadius: 3, backgroundColor: tokens.accentSoft },
  profileTrackFill: { display: 'block', height: '100%', borderRadius: 3, backgroundColor: tokens.accent },
  profileFile: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: tokens.line, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: tokens.line, color: tokens.accent },
  profileFileCopy: { display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', gap: 2 },
  profileFileName: { overflow: 'hidden', color: tokens.ink, fontSize: 10, fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  profileFileMeta: { color: tokens.muted, fontSize: 9 },
  profileStats: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, color: tokens.muted, fontSize: 9, fontWeight: 650 },
  profileStatValue: { color: tokens.ink, fontSize: 12 },
  workspace: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)',
      '@media (max-width: 760px)': '1fr',
    },
    alignItems: 'start',
    gap: {
      default: 24,
      '@media (max-width: 760px)': 38,
    },
    paddingBottom: 68,
  },
  panel: { minWidth: 0, padding: { default: 23, '@media (max-width: 760px)': 17 }, borderWidth: 1, borderStyle: 'solid', borderColor: tokens.line, borderRadius: tokens.radiusMd, backgroundColor: tokens.surface },
  panelHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  panelTitle: { marginTop: 7, color: tokens.ink, fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: '25px' },
  panelCount: { color: tokens.muted, fontSize: 10, fontWeight: 700 },
  controls: { display: 'flex', alignItems: 'center', flexWrap: { default: 'nowrap', '@media (max-width: 760px)': 'wrap' }, gap: 9, marginTop: 21, paddingBottom: 14, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: tokens.line },
  tabsWrap: { minWidth: 0, overflowX: { default: 'visible', '@media (max-width: 760px)': 'auto' } },
  search: { display: 'flex', alignItems: 'center', gap: 7, minWidth: { default: 120, '@media (max-width: 760px)': 0 }, flex: 1, height: 31, marginLeft: { default: 'auto', '@media (max-width: 760px)': 0 }, paddingLeft: 8, paddingRight: 8, borderWidth: 1, borderStyle: 'solid', borderColor: tokens.line, borderRadius: tokens.radiusSm, color: tokens.muted, ':focus-within': { borderColor: tokens.accent, boxShadow: `0 0 0 3px ${tokens.accentSoft}` } },
  searchInput: { width: '100%', minWidth: 0, padding: 0, borderWidth: 0, outlineWidth: 0, backgroundColor: 'transparent', color: tokens.ink, fontSize: 10, '::placeholder': { color: tokens.muted } },
  filterButton: { display: 'inline-grid', flex: '0 0 31px', width: 31, height: 31, placeItems: 'center', padding: 0, borderWidth: 1, borderStyle: 'solid', borderColor: tokens.line, borderRadius: tokens.radiusSm, backgroundColor: 'transparent', color: tokens.muted, ':hover': { backgroundColor: tokens.surfaceSunken, color: tokens.ink } },
  rankingNote: { marginTop: 12, padding: 9, borderRadius: tokens.radiusSm, backgroundColor: tokens.accentSoft, color: tokens.accentHover, fontSize: 10, lineHeight: '14px' },
  jobList: { display: 'flex', flexDirection: 'column' },
  job: { borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: tokens.line, ':last-child': { borderBottomWidth: 0 } },
  jobMain: { display: 'flex', alignItems: 'center', flexWrap: { default: 'nowrap', '@media (max-width: 760px)': 'wrap' }, minWidth: 0, gap: 11, paddingTop: 18, paddingBottom: 18 },
  companyMark: { display: 'inline-grid', flex: '0 0 30px', width: 30, height: 30, placeItems: 'center', borderRadius: 7, fontSize: 12, fontWeight: 850 },
  jobCopy: { minWidth: 0, flex: 1 },
  jobTitleLine: { display: 'flex', alignItems: 'center', minWidth: 0, gap: 7 },
  jobTitle: { overflow: 'hidden', color: tokens.ink, fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', textDecoration: 'none', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ':hover': { color: tokens.accent } },
  newPill: { flex: '0 0 auto', padding: '3px 5px', borderRadius: 4, backgroundColor: tokens.accentSoft, color: tokens.accent, fontSize: 8, fontWeight: 800, textTransform: 'uppercase' },
  jobSubline: { overflow: 'hidden', marginTop: 4, color: tokens.muted, fontSize: 10, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  jobMeta: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9, marginTop: 8, color: tokens.muted, fontSize: 9 },
  jobMetaItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  match: { display: 'flex', flex: { default: '0 0 88px', '@media (max-width: 760px)': '0 0 80px' }, flexDirection: 'column', gap: 5, marginLeft: { default: 0, '@media (max-width: 760px)': 41 } },
  matchTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 },
  matchValue: { color: tokens.accent, fontSize: 15, fontWeight: 800, letterSpacing: '-0.05em' },
  matchLabel: { color: tokens.muted, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' },
  matchTrack: { display: 'block', height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: tokens.accentSoft },
  matchFill: { display: 'block', height: '100%', borderRadius: 2, backgroundColor: tokens.accent },
  jobActions: { display: 'flex', flex: { default: '0 0 104px', '@media (max-width: 760px)': '0 0 auto' }, alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginLeft: { default: 0, '@media (max-width: 760px)': 'auto' } },
  jobAction: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0, borderWidth: 0, backgroundColor: 'transparent', color: tokens.muted, fontSize: 9, fontWeight: 700, ':hover': { color: tokens.accent } },
  chevron: { display: 'inline-flex', transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)' },
  chevronOpen: { transform: 'rotate(180deg)' },
  saveButton: { display: 'inline-grid', width: 25, height: 25, placeItems: 'center', padding: 0, borderWidth: 0, backgroundColor: 'transparent', color: tokens.muted, ':hover': { color: tokens.accent } },
  reason: { marginTop: -2, marginBottom: 15, marginLeft: { default: 41, '@media (max-width: 760px)': 0 }, padding: 10, borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: tokens.accent, backgroundColor: tokens.accentSoft },
  reasonLabel: { display: 'inline-flex', alignItems: 'center', gap: 5, color: tokens.accent, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' },
  reasonText: { marginTop: 6, marginBottom: 8, color: tokens.accentHover, fontSize: 10, lineHeight: '15px' },
  reasonTags: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  reasonTag: { padding: '4px 6px', borderRadius: 4, backgroundColor: tokens.surface, color: tokens.muted, fontSize: 8, fontWeight: 700 },
  empty: { display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 6, padding: 44, color: tokens.muted, textAlign: 'center' },
  emptyTitle: { color: tokens.ink, fontSize: 12, fontWeight: 800 },
  discord: { minWidth: 0 },
  discordHeading: { marginBottom: 15 },
  discordIcon: { display: 'inline-grid', width: 33, height: 33, placeItems: 'center', borderWidth: 1, borderStyle: 'solid', borderColor: tokens.line, borderRadius: 8, backgroundColor: tokens.surface, color: '#5865f2' },
  discordWindow: { overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: tokens.lineStrong, borderRadius: 9, backgroundColor: tokens.surface },
  channelBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 49, paddingLeft: 13, paddingRight: 13, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: tokens.line, backgroundColor: tokens.surfaceSunken },
  channel: { display: 'flex', alignItems: 'center', gap: 6, color: tokens.muted },
  channelCopy: { display: 'flex', flexDirection: 'column', gap: 1 },
  channelName: { color: tokens.ink, fontSize: 10, fontWeight: 800 },
  channelMeta: { color: tokens.muted, fontSize: 8 },
  message: { padding: 17, paddingTop: 17, paddingBottom: 14 },
  messageAuthor: { display: 'flex', alignItems: 'center', gap: 7 },
  avatar: { display: 'inline-grid', width: 25, height: 25, placeItems: 'center', borderRadius: '50%', backgroundColor: tokens.accent, color: tokens.accentInk, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 16 },
  authorCopy: { display: 'flex', flexDirection: 'column', gap: 1 },
  authorName: { color: tokens.ink, fontSize: 10, fontWeight: 800 },
  authorMeta: { color: tokens.muted, fontSize: 8 },
  messageIntro: { marginTop: 11, marginBottom: 10, marginLeft: 32, color: tokens.muted, fontSize: 10 },
  embed: { marginLeft: 32, padding: 11, paddingTop: 11, paddingBottom: 10, borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: tokens.accent, backgroundColor: tokens.surfaceSunken },
  embedHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  embedTitle: { color: tokens.ink, fontSize: 11, fontWeight: 800, lineHeight: '15px', textDecoration: 'none', ':hover': { color: tokens.accent } },
  embedScore: { flex: '0 0 auto', color: tokens.accent, fontSize: 9, fontWeight: 800 },
  embedBody: { marginTop: 8, color: tokens.muted, fontSize: 9, lineHeight: '14px' },
  embedFields: { display: 'grid', gridTemplateColumns: { default: '1.1fr 1fr 0.8fr 0.7fr', '@media (max-width: 760px)': '1fr 1fr' }, gap: 7, marginTop: 12 },
  embedField: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 3, overflow: 'hidden', color: tokens.ink, fontSize: 8, fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: { default: 'nowrap', '@media (max-width: 760px)': 'normal' } },
  embedFieldLabel: { color: tokens.muted, fontSize: 7, fontWeight: 700, textTransform: 'uppercase' },
  embedFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, color: tokens.muted, fontSize: 8 },
  messageButton: { marginTop: 12, marginLeft: 32 },
  discordNote: { display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 13, color: tokens.muted, fontSize: 9, lineHeight: '14px' },
  how: { display: 'grid', gridTemplateColumns: { default: '0.8fr 1.2fr', '@media (max-width: 760px)': '1fr' }, gap: { default: 45, '@media (max-width: 760px)': 28 }, paddingTop: 55, paddingBottom: 68, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: tokens.line },
  howTitle: { maxWidth: 260, marginTop: 9, color: tokens.ink, fontSize: 27, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: '28px' },
  howList: { display: 'flex', alignItems: 'stretch', flexDirection: { default: 'row', '@media (max-width: 760px)': 'column' }, justifyContent: 'space-between', gap: 22, margin: 0, padding: 0, listStyle: 'none' },
  howItem: { display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 7, paddingLeft: 14, borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: tokens.accentSoft },
  howItemFirst: { borderLeftColor: tokens.accent },
  howIndex: { color: tokens.accent, fontFamily: fonts.mono, fontSize: 9, fontWeight: 800 },
  howTitleSmall: { color: tokens.ink, fontSize: 11, fontWeight: 800 },
  howBody: { color: tokens.muted, fontSize: 10, lineHeight: '14px' },
});

function CompanyMark({ job }: { job: DemoJob }) {
  return <span {...stylex.props(styles.companyMark)} style={COMPANY_COLORS[job.companyTone]}>{job.companyMark}</span>;
}

function MatchValue({ job }: { job: DemoJob }) {
  return (
    <div {...stylex.props(styles.match)} aria-label={`${job.score}% CV match`}>
      <div {...stylex.props(styles.matchTop)}><strong {...stylex.props(styles.matchValue)}>{job.score}%</strong><span {...stylex.props(styles.matchLabel)}>match</span></div>
      <span {...stylex.props(styles.matchTrack)}><i {...stylex.props(styles.matchFill)} style={{ width: `${job.score}%` }} /></span>
    </div>
  );
}

function JobRow({
  job,
  saved,
  expanded,
  onSave,
  onExplain,
}: {
  job: DemoJob;
  saved: boolean;
  expanded: boolean;
  onSave: () => void;
  onExplain: () => void;
}) {
  return (
    <article {...stylex.props(styles.job)}>
      <div {...stylex.props(styles.jobMain)}>
        <CompanyMark job={job} />
        <div {...stylex.props(styles.jobCopy)}>
          <div {...stylex.props(styles.jobTitleLine)}>
            <a {...stylex.props(styles.jobTitle)} href={job.url} target="_blank" rel="noreferrer">{job.title}</a>
            {job.fresh ? <span {...stylex.props(styles.newPill)}>New</span> : null}
          </div>
          <p {...stylex.props(styles.jobSubline)}>{job.company} · {job.location}</p>
          <div {...stylex.props(styles.jobMeta)}>
            <span {...stylex.props(styles.jobMetaItem)}><ClockIcon /> {job.posted}</span>
            <span>{job.salary}</span>
            <Badge>{job.source}</Badge>
          </div>
        </div>
        <MatchValue job={job} />
        <div {...stylex.props(styles.jobActions)}>
          <button {...stylex.props(styles.jobAction)} type="button" onClick={onExplain} aria-expanded={expanded}>
            {expanded ? 'Hide reason' : 'Why this match'}
            <span {...stylex.props(styles.chevron, expanded && styles.chevronOpen)}><ChevronDown /></span>
          </button>
          <button {...stylex.props(styles.saveButton, saved && styles.jobAction)} type="button" onClick={onSave} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Save'} ${job.title}`}>
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>
      {expanded ? (
        <div {...stylex.props(styles.reason)}>
          <span {...stylex.props(styles.reasonLabel)}><CheckIcon /> CV overlap</span>
          <p {...stylex.props(styles.reasonText)}>{job.reason}</p>
          <div {...stylex.props(styles.reasonTags)}>{job.skills.map((skill) => <span {...stylex.props(styles.reasonTag)} key={skill}>{skill}</span>)}</div>
        </div>
      ) : null}
    </article>
  );
}

function DiscordPreview({ job, delivered, onDeliver }: { job: DemoJob; delivered: boolean; onDeliver: () => void }) {
  return (
    <aside {...stylex.props(styles.discord)} aria-label="Example Discord delivery">
      <div {...stylex.props(styles.panelHeading, styles.discordHeading)}>
        <div><span {...stylex.props(styles.eyebrow)}>Example delivery</span><h2 {...stylex.props(styles.panelTitle)}>Discord message</h2></div>
        <span {...stylex.props(styles.discordIcon)}><DiscordIcon /></span>
      </div>
      <div {...stylex.props(styles.discordWindow)}>
        <div {...stylex.props(styles.channelBar)}>
          <div {...stylex.props(styles.channel)}><HashIcon /><span {...stylex.props(styles.channelCopy)}><strong {...stylex.props(styles.channelName)}>{DISCORD_CHANNEL.channel}</strong><small {...stylex.props(styles.channelMeta)}>{DISCORD_CHANNEL.guild}</small></span></div>
          <StatusDot on={delivered} label={delivered ? 'Delivered' : 'Ready'} />
        </div>
        <div {...stylex.props(styles.message)}>
          <div {...stylex.props(styles.messageAuthor)}><span {...stylex.props(styles.avatar)}>κ</span><span {...stylex.props(styles.authorCopy)}><strong {...stylex.props(styles.authorName)}>Kappa</strong><small {...stylex.props(styles.authorMeta)}>{DISCORD_CHANNEL.time}</small></span></div>
          <p {...stylex.props(styles.messageIntro)}>A new role cleared your match threshold.</p>
          <div {...stylex.props(styles.embed)}>
            <div {...stylex.props(styles.embedHead)}><a {...stylex.props(styles.embedTitle)} href={job.url} target="_blank" rel="noreferrer">{job.title} @ {job.company}</a><span {...stylex.props(styles.embedScore)}>{job.score}%</span></div>
            <p {...stylex.props(styles.embedBody)}>{job.reason}</p>
            <div {...stylex.props(styles.embedFields)}><span {...stylex.props(styles.embedField)}><small {...stylex.props(styles.embedFieldLabel)}>Match</small>{job.score}% match</span><span {...stylex.props(styles.embedField)}><small {...stylex.props(styles.embedFieldLabel)}>Location</small>{job.location}</span><span {...stylex.props(styles.embedField)}><small {...stylex.props(styles.embedFieldLabel)}>Salary</small>{job.salary}</span><span {...stylex.props(styles.embedField)}><small {...stylex.props(styles.embedFieldLabel)}>Posted</small>{job.posted}</span></div>
            <div {...stylex.props(styles.embedFooter)}><span>{job.source}</span><span>Reply 1 for summary</span></div>
          </div>
          <div {...stylex.props(styles.messageButton)}><Button variant={delivered ? 'subtle' : 'brand'} small onClick={onDeliver}>{delivered ? 'Delivered' : 'Deliver to Discord'}</Button></div>
        </div>
      </div>
      <p {...stylex.props(styles.discordNote)}><CheckIcon /> One message per match. No duplicate posts.</p>
    </aside>
  );
}

export function LandingDemo({ authAction }: { authAction: ReactNode }) {
  const [filter, setFilter] = useState('for-you');
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>(['wise-senior-product-designer']);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [checkedAt, setCheckedAt] = useState('2 min ago');
  const [delivered, setDelivered] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const visibleJobs = useMemo(() => {
    let jobs = DEMO_JOBS;
    if (filter === 'new') jobs = jobs.slice(0, 3);
    if (filter === 'saved') jobs = jobs.filter((job) => savedIds.includes(job.id));
    const value = query.trim().toLowerCase();
    if (value) jobs = jobs.filter((job) => `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(value));
    return jobs;
  }, [filter, query, savedIds]);

  const emptyTitle = filter === 'saved' ? 'No saved matches' : query.trim() ? 'No matches found' : 'No matches yet';
  const emptyBody = filter === 'saved' ? 'Save a role to keep it in this view.' : 'Try another search or filter.';

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.utilityBar)}>
        <span>Preview workspace · sample data</span>
        <div {...stylex.props(styles.utilityStatus)}><StatusDot on={!paused} label={paused ? 'Alerts paused' : 'Signal active'} /><span {...stylex.props(styles.utilityStatusText)}>Last checked {checkedAt}</span></div>
      </div>
      <header {...stylex.props(styles.pageHeader)}>
        <nav {...stylex.props(styles.pageNav)} aria-label="Landing sections"><a {...stylex.props(styles.pageNavLink)} href="#matches">Matches</a><a {...stylex.props(styles.pageNavLink)} href="#how-it-works">How it works</a></nav>
        <Button variant="subtle" small onClick={() => setPaused((value) => !value)}>{paused ? 'Resume alerts' : 'Pause alerts'}</Button>
      </header>

      <section {...stylex.props(styles.hero)}>
        <div>
          <span {...stylex.props(styles.eyebrow)}>One CV. A focused feed.</span>
          <h1 {...stylex.props(styles.heroTitle)}>See only the roles worth your time.</h1>
          <p {...stylex.props(styles.heroLede)}>Kappa reads your CV, ranks fresh JobPostings against it, and sends the strongest matches to Discord.</p>
          <div {...stylex.props(styles.heroActions)}><Button onClick={() => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{`Review ${PROFILE.newToday} matches`}</Button><Button variant="subtle" small onClick={() => setCheckedAt('just now')}>Scan now</Button>{authAction}</div>
          <div {...stylex.props(styles.assurances)}><span {...stylex.props(styles.assurance)}><CheckIcon /> Private by default</span><span {...stylex.props(styles.assurance)}><CheckIcon /> Match reasons included</span><span {...stylex.props(styles.assurance)}><CheckIcon /> No duplicate posts</span></div>
        </div>
        <aside {...stylex.props(styles.profileCard)} aria-label="Example CV match profile">
          <div {...stylex.props(styles.profileHead)}><div><span {...stylex.props(styles.eyebrow)}>Match profile</span><h2 {...stylex.props(styles.profileName)}>{PROFILE.name}</h2><p {...stylex.props(styles.profileRole)}>{PROFILE.role}</p></div><StatusDot on label="CV ready" /></div>
          <div {...stylex.props(styles.profileScore)}><strong {...stylex.props(styles.profileScoreValue)}>{PROFILE.averageMatch}%</strong><span {...stylex.props(styles.profileScoreLabel)}>average CV match</span></div>
          <span {...stylex.props(styles.profileTrack)}><i {...stylex.props(styles.profileTrackFill)} style={{ width: `${PROFILE.averageMatch}%` }} /></span>
          <div {...stylex.props(styles.profileFile)}><span>▤</span><span {...stylex.props(styles.profileFileCopy)}><strong {...stylex.props(styles.profileFileName)}>{PROFILE.cvName}</strong><span {...stylex.props(styles.profileFileMeta)}>{PROFILE.cvUpdated}</span></span><CheckIcon size={14} /></div>
          <div {...stylex.props(styles.profileStats)}><span><strong {...stylex.props(styles.profileStatValue)}>{PROFILE.activeAlerts}</strong> active alerts</span><span><strong {...stylex.props(styles.profileStatValue)}>{PROFILE.newToday}</strong> new today</span></div>
        </aside>
      </section>

      <section {...stylex.props(styles.workspace)}>
        <div {...stylex.props(styles.panel)} id="matches" ref={feedRef}>
          <div {...stylex.props(styles.panelHeading)}><div><span {...stylex.props(styles.eyebrow)}>Ranked for you</span><h2 {...stylex.props(styles.panelTitle)}>Today’s sample matches</h2></div><span {...stylex.props(styles.panelCount)}>{visibleJobs.length} shown</span></div>
          <div {...stylex.props(styles.controls)}><div {...stylex.props(styles.tabsWrap)}><Tabs value={filter} onChange={setFilter} tabs={FILTERS} /></div><label {...stylex.props(styles.search)}><SearchIcon /><input {...stylex.props(styles.searchInput)} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or company" aria-label="Search title or company" /></label><button {...stylex.props(styles.filterButton)} type="button" onClick={() => setExpandedId(expandedId ? null : 'ranking')} aria-label="Explain ranking" aria-expanded={expandedId === 'ranking'}><span aria-hidden="true">☷</span></button></div>
          {expandedId === 'ranking' ? <p {...stylex.props(styles.rankingNote)}>Scores combine role requirements with your CV. Every result keeps a short, editable reason.</p> : null}
          <div {...stylex.props(styles.jobList)}>{visibleJobs.length > 0 ? visibleJobs.map((job) => <JobRow key={job.id} job={job} saved={savedIds.includes(job.id)} expanded={expandedId === job.id} onSave={() => setSavedIds((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])} onExplain={() => setExpandedId(expandedId === job.id ? null : job.id)} />) : <div {...stylex.props(styles.empty)}><BookmarkIcon size={17} /><strong {...stylex.props(styles.emptyTitle)}>{emptyTitle}</strong><span>{emptyBody}</span></div>}</div>
        </div>
        <DiscordPreview job={DEMO_JOBS[0]} delivered={delivered} onDeliver={() => setDelivered((value) => !value)} />
      </section>

      <section {...stylex.props(styles.how)} id="how-it-works"><div><span {...stylex.props(styles.eyebrow)}>How it works</span><h2 {...stylex.props(styles.howTitle)}>Set the signal once. Review only what clears it.</h2></div><ol {...stylex.props(styles.howList)}><li {...stylex.props(styles.howItem, styles.howItemFirst)}><span {...stylex.props(styles.howIndex)}>01</span><strong {...stylex.props(styles.howTitleSmall)}>Parse your CV</strong><p {...stylex.props(styles.howBody)}>Extract role, skills, and experience signals.</p></li><li {...stylex.props(styles.howItem)}><span {...stylex.props(styles.howIndex)}>02</span><strong {...stylex.props(styles.howTitleSmall)}>Rank new roles</strong><p {...stylex.props(styles.howBody)}>Score each fresh JobPosting against your profile.</p></li><li {...stylex.props(styles.howItem)}><span {...stylex.props(styles.howIndex)}>03</span><strong {...stylex.props(styles.howTitleSmall)}>Deliver to Discord</strong><p {...stylex.props(styles.howBody)}>Post the match with its reason and summary.</p></li></ol></section>
    </div>
  );
}
