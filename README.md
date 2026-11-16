# Stride creator calendar

A shared, read-only view of Michelle's week for her creators:
**https://mydigitalcrib.github.io/stride-social-calendar/**

It shows Michelle's real schedule, with one rule: **calls with a creator never show the creator's name**.
They appear as "Creator call". A title is hidden when it names a creator from her workspace, names a person in
brackets ("… (Diana Tejada)"), looks like a one-on-one ("Let's Connect", "call with", "1:1"), or the item is a
creator/brand item (creator outreach, brand pitches, brand outreach). Notes, niches, statuses and links are never
copied.

## Updating it

`site/calendar.json` is built from the private workspace file, then pushed (every push to `main` republishes):

```bash
node scripts/build-calendar.mjs "<path to>/workspace-data/workspace.json"
npm test
git add site/calendar.json week.json && git commit -m "Update calendar" && git push
```

- Items marked private (`private: true`) in the workspace are skipped.
- Follow-ups due on the same day appear once, as "Follow-ups".
- `week.json` holds the weekly rhythm shown on each day, by weekday number (0 = Sunday … 6 = Saturday), e.g.
  `{ "1": { "label": "Brand outreach" }, "2": { "label": "Emails & screening · no calls", "noCalls": true } }`.
  It's empty until Michelle settles her schedule.

## Files

| File | What it is |
| --- | --- |
| `site/` | The website (plain HTML, CSS and JavaScript; the Geist font is bundled) |
| `site/calendar.json` | The published calendar data (general information only) |
| `scripts/build-calendar.mjs` | Makes `calendar.json` from the workspace file |
| `tests/build.test.mjs` | Checks that no names, brands or notes can get through |
| `week.json` | The weekly rhythm (day labels) |
