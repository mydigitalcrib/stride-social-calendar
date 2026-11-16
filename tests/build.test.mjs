// Checks that only general information reaches the public calendar.  Run: npm test
import { buildCalendar } from '../scripts/build-calendar.mjs';

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

const workspace = {
  events: [
    { id: 'e1', type: 'meeting', title: 'Call with Janella about Lego', date: '2026-11-17', time: '15:00', duration: 45, notes: 'rate 5000', creatorName: 'Janella', brand: 'Lego' },
    { id: 'e2', type: 'brand-pitch', title: 'Pitch Dove for Andrea & Jeff', date: '2026-11-18', time: '', brand: 'Dove', creatorName: 'Andrea' },
    { id: 'e3', type: 'task', title: 'Secret thing', date: '2026-11-18', private: true },
    { id: 'e4', type: 'brand-outreach', title: 'Nike for Diana', date: '2026-11-20', brand: 'Nike', status: 'Requested' },
    { id: 'e5', type: 'weird', title: 'Unknown type', date: '2026-11-19', time: '09:00' },
    { id: 'e6', type: 'task', title: 'No date' },
  ],
  creators: [
    { id: 'c1', firstName: 'Ana', email: 'ana@private.example', followUp: '2026-11-19', outreach: 'Contacted' },
    { id: 'c2', firstName: 'Ben', followUp: '2026-11-19', outreach: 'Replied' },
    { id: 'c3', firstName: 'Cara', followUp: '2026-11-19', outreach: 'Contract signed' },
    { id: 'c4', firstName: 'Dee', bookingStatus: 'Call booked', calendarStart: '2026-11-17T11:30' },
  ],
};
const file = { app: 'x', format: 'browser-storage', version: 1, data: { 'stride-talent-workspace:v1': JSON.stringify(workspace) } };
const out = buildCalendar(file, { now: new Date('2026-11-16T12:00:00Z') });
const text = JSON.stringify(out);

check('no creator names, brands, notes or emails leak', /Janella|Lego|Dove|Andrea|Nike|Diana|Secret|rate|Ana|Ben|Cara|Dee|private\.example|Requested/.test(text), false);
check('items keep only date, time, length, type and a public title', [...new Set(out.items.flatMap((i) => Object.keys(i)))].sort(), ['date', 'duration', 'time', 'title', 'type']);
check('a call that names a creator shows as "Creator call"', out.items.find((i) => i.time === '15:00').title, 'Creator call');
check('brand pitches and brand outreach show no title', out.items.filter((i) => ['brand-pitch', 'brand-outreach'].includes(i.type)).map((i) => i.title), ['', '']);
check('other titles stay public', out.items.find((i) => i.time === '09:00').title, 'Unknown type');

// Michelle's real kinds of events: everything public except calls with a creator.
const { publicTitle } = await import('../scripts/build-calendar.mjs');
const names = ['diana tejada', 'diana', 'janella'];
const pt = (title, type = 'meeting') => publicTitle({ title, type }, names);
check('UNI study stays public', pt('UNI Studying - Computer Science', 'task'), 'UNI Studying - Computer Science');
check('lunch stays public', pt('Lunch / Break 🍎', 'task'), 'Lunch / Break 🍎');
check('email time stays public', pt('Email and Follow Ups', 'follow-up'), 'Email and Follow Ups');
check('team meetings stay public', [pt('Motherhood and Family Team Meeting'), pt('Stride Mentorship Call'), pt('Stride Talent optional drop-in')], ['Motherhood and Family Team Meeting', 'Stride Mentorship Call', 'Stride Talent optional drop-in']);
check("Let's Connect with a creator → Creator call", pt("Let's Connect! | Stride Social (Diana Tejada)"), 'Creator call');
check('a person in brackets → Creator call', pt('Weekly check-in (Maria Lopez)'), 'Creator call');
check('call with someone → Creator call', pt('Call with Sam'), 'Creator call');
check('a creator first name anywhere → Creator call', pt('Janella content review'), 'Creator call');
check('words that only contain a name stay public', pt('Dianalogue workshop'), 'Dianalogue workshop');
check('private items are skipped', out.items.some((i) => i.date === '2026-11-18' && i.type === 'task'), false);
check('items without a date are skipped', out.items.length, 6);
check('unknown types become admin', out.items.find((i) => i.date === '2026-11-19' && i.time === '09:00').type, 'task');
check('follow-ups on one day become one entry; signed creators drop out', out.items.filter((i) => i.type === 'follow-up').length, 1);
check('booked calls show as a creator call', out.items.find((i) => i.time === '11:30'), { date: '2026-11-17', time: '11:30', duration: 30, type: 'meeting', title: 'Creator call' });
check('sorted by date and time', out.items.map((i) => `${i.date} ${i.time}`), [
  '2026-11-17 11:30',
  '2026-11-17 15:00',
  '2026-11-18 ',
  '2026-11-19 ',
  '2026-11-19 09:00',
  '2026-11-20 ',
]);
check('time zone is Buenos Aires', [out.timezone, out.offset], ['America/Argentina/Buenos_Aires', '-03:00']);
check('empty workspace → empty calendar', buildCalendar({ format: 'browser-storage', data: {} }).items, []);
let error = '';
try {
  buildCalendar({ format: 'browser-storage', data: { 'stride-talent-workspace:v1': '{"iv":"x","data":"y"' } });
} catch (e) {
  error = e.message;
}
check('locked or broken workspace gives a clear message', error.includes('password'), true);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
