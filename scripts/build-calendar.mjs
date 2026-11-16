// Builds site/calendar.json for the creator calendar from Michelle's private workspace file.
//
//   node scripts/build-calendar.mjs <path to workspace-data/workspace.json>
//
// Only general information leaves the workspace: the item's type, date, time and length.
// Titles, notes, creator names, brands, niches, statuses and links are never copied.
// Items marked private (private: true) are skipped. Follow-ups due on the same day become one "Follow-ups" entry.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TYPES = ['task', 'meeting', 'creator-outreach', 'brand-pitch', 'follow-up', 'brand-outreach'];
const FINISHED = ['Contract signed', 'Signed', 'Closed']; // same as FINISHED_STAGES in the workspace's src/data.js
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^\d{2}:\d{2}$/.test(String(v || ''));

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
  for (const e of workspace.events || []) {
    if (!e || e.private || !isDate(e.date)) continue;
    items.push({
      date: e.date,
      time: isTime(e.time) ? e.time : '',
      duration: isTime(e.time) ? Math.max(15, Math.min(600, Number(e.duration) || 30)) : 0,
      type: TYPES.includes(e.type) ? e.type : 'task',
    });
  }
  for (const c of workspace.creators || []) {
    // Booked calls: shown as a call at that time.
    const start = String(c.calendarStart || '');
    if (c.bookingStatus === 'Call booked' && isDate(start.slice(0, 10)) && isTime(start.slice(11, 16))) {
      items.push({ date: start.slice(0, 10), time: start.slice(11, 16), duration: 30, type: 'meeting' });
    }
    // Follow-up dates: one all-day "Follow-ups" entry per day, however many there are.
    if (isDate(c.followUp) && !FINISHED.includes(c.outreach)) items.push({ date: c.followUp, time: '', duration: 0, type: 'follow-up' });
  }

  // All-day entries of the same type on the same day become one.
  const seen = new Set();
  const merged = items.filter((i) => {
    if (i.time) return true;
    const key = `${i.date}|${i.type}`;
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
