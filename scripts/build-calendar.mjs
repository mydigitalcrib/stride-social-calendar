// Builds site/calendar.json for the creator calendar from Michelle's private workspace file.
//
//   node scripts/build-calendar.mjs <path to workspace-data/workspace.json>
//
// What's copied: each item's title, type, date, time and length. Notes, niches, statuses and links never are.
// Michelle's rule (16 Nov 2026): everything can be public EXCEPT calls with a creator. Those show as
// "Creator call", with no name. A title is hidden when it names a creator in the workspace, names a person in
// brackets ("… (Diana Tejada)"), looks like a one-on-one ("Let's Connect", "call with", "1:1"), or the item is
// linked to a creator or brand (creator outreach, brand pitches, brand outreach). Items marked private are skipped.
// Follow-ups due on the same day from creator profiles become one "Follow-ups" entry.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TYPES = ['task', 'meeting', 'creator-outreach', 'brand-pitch', 'follow-up', 'brand-outreach'];
const FINISHED = ['Contract signed', 'Signed', 'Closed']; // same as FINISHED_STAGES in the workspace's src/data.js
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^\d{2}:\d{2}$/.test(String(v || ''));
const ONE_ON_ONE = /let['’]?s connect|\bcall with\b|\bmeeting with\b|\bchat with\b|\bcatch ?up with\b|\b1[:\-]1\b|\bone[- ]on[- ]one\b|\bintro call\b|\bdiscovery call\b/i;
const PERSON_IN_BRACKETS = /\(([A-ZÀ-Ý][\p{L}'’.-]+(?:\s+[A-ZÀ-Ý][\p{L}'’.-]+)+)\)/u;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Names to look for in titles: every creator's full name, and first names of 4+ letters. */
function creatorNames(creators) {
  const names = new Set();
  for (const c of creators || []) {
    const first = norm(c.firstName).trim();
    const full = norm(`${c.firstName || ''} ${c.lastName || ''}`).trim();
    if (full.includes(' ')) names.add(full);
    if (first.length >= 4 && !first.includes(' ')) names.add(first);
  }
  return [...names];
}
const mentions = (title, names) => {
  const t = ` ${norm(title).replace(/[^a-z0-9]+/g, ' ')} `;
  return names.some((n) => t.includes(` ${n.replace(/[^a-z0-9]+/g, ' ').trim()} `));
};

/** The title creators may see, or '' to show only the kind of work. */
export function publicTitle(e, names) {
  const title = String(e.title || '').trim();
  if (!title) return '';
  const linked = e.creatorId || e.creatorName || e.brand || ['creator-outreach', 'brand-pitch', 'brand-outreach'].includes(e.type);
  if (ONE_ON_ONE.test(title) || PERSON_IN_BRACKETS.test(title) || mentions(title, names)) return e.type === 'meeting' ? 'Creator call' : '';
  if (linked) return '';
  // Michelle's preferred public names (her own calendar keeps the full title).
  if (/\bteam meeting\b/i.test(title)) return 'Weekly team meeting';
  return title.slice(0, 80);
}

/** Turns the saved workspace into the public calendar data. Pure, so it can be tested. */
export function buildCalendar(workspaceFile, { now = new Date(), focus = {} } = {}) {
  if (workspaceFile?.format !== 'browser-storage' || !workspaceFile.data) throw new Error('This is not a workspace.json file.');
  const raw = workspaceFile.data['stride-talent-workspace:v1'];
  if (!raw) return { updatedAt: now.toISOString(), ...ZONE, focus, items: [] };
  let workspace;
  try {
    workspace = JSON.parse(raw);
  } catch {
    throw new Error('The workspace is password-protected or unreadable. Unlock it (or turn the password off) first.');
  }

  const items = [];
  const names = creatorNames(workspace.creators);
  for (const e of workspace.events || []) {
    if (!e || e.private || !isDate(e.date)) continue;
    const type = TYPES.includes(e.type) ? e.type : 'task';
    items.push({
      date: e.date,
      time: isTime(e.time) ? e.time : '',
      duration: isTime(e.time) ? Math.max(15, Math.min(720, Number(e.duration) || 30)) : 0,
      type,
      title: publicTitle({ ...e, type }, names),
    });
  }
  for (const c of workspace.creators || []) {
    // Booked calls with creators: shown as "Creator call" at that time.
    const start = String(c.calendarStart || '');
    if (c.bookingStatus === 'Call booked' && isDate(start.slice(0, 10)) && isTime(start.slice(11, 16))) {
      items.push({ date: start.slice(0, 10), time: start.slice(11, 16), duration: 30, type: 'meeting', title: 'Creator call' });
    }
    // Follow-up dates: one all-day "Follow-ups" entry per day, however many there are.
    if (isDate(c.followUp) && !FINISHED.includes(c.outreach)) items.push({ date: c.followUp, time: '', duration: 0, type: 'follow-up' });
  }

  // All-day entries of the same type on the same day become one.
  const seen = new Set();
  const merged = items.filter((i) => {
    if (i.time) return true;
    const key = `${i.date}|${i.type}|${i.title || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  merged.sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));
  return { updatedAt: now.toISOString(), ...ZONE, focus, items: merged };
}

// The workspace keeps times in Buenos Aires time (TEAM_TIMEZONE in the workspace's src/data.js).
const ZONE = { timezone: 'America/Argentina/Buenos_Aires', offset: '-03:00', zoneName: 'Buenos Aires' };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: node scripts/build-calendar.mjs <path to workspace.json>');
    process.exit(1);
  }
  const out = fileURLToPath(new URL('../site/calendar.json', import.meta.url));
  let focus = {};
  try {
    focus = JSON.parse(readFileSync(fileURLToPath(new URL('../week.json', import.meta.url)), 'utf8'));
  } catch {
    // no weekly rhythm set yet
  }
  const calendar = buildCalendar(JSON.parse(readFileSync(source, 'utf8')), { focus });
  writeFileSync(out, `${JSON.stringify(calendar, null, 2)}\n`);
  console.log(`Wrote ${calendar.items.length} items to site/calendar.json`);
}
