# Scooby

Campus utilities for SNU students — timetable planning, exam schedules, the
academic calendar, hostel room swaps — in one SvelteKit app.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Home grid linking to everything below |
| `/collision-checker` | Timetable Planner: pick your batch, add UWE/CCC/major electives, see clashes. Export as image or `.ics` |
| `/exam` | Search courses, build a personal mid-sem/end-sem schedule, export image or `.ics` |
| `/room-switch` | Post your hostel room, browse others, connect over WhatsApp (Google sign-in, MongoDB-backed) |
| `/academic-calendar` | Holidays, exam weeks and add/drop deadlines, parsed straight out of the calendar PDF |
| `/changes` | Every revision to the published timetable, diffed |
| `/clubs` | Cultural and technical clubs (hidden from home grid) |
| `/minors` | Undergraduate minors, new and old curriculum (hidden from home grid) |

## Running it

```sh
npm install
cp .env.example .env   # only needed for /room-switch
npm run dev
```

`npm run build` / `npm run preview` for production. Deploys via
`adapter-auto`.

## Data

Timetable data is bundled from `src/lib/data/`, not fetched at runtime:

- `tt.json` — the timetable, served by `/api/timetable`. If absent, the API
  falls back to the `.xlsx` in the same folder.
- `mid-sem-2026-spring/*.xlsx` — exam timetable, served by `/api/midsem`.
- `ttchanges.json` — baked revision history for `/changes`.
- `clubs.json` — generated from `static/data/Recruitment_Forms.xlsx`.
- `*calendar*.pdf` — the academic calendar. Parsed at build time (the page is
  prerendered), so nothing runs pdfjs in production.

To update the timetable, drop in a new `tt.json` (or spreadsheet) and rebuild.

For a new academic calendar, drop the PDF into the same folder — the newest
filename wins, and the month columns, row bands and colour legend all come out
of the sheet. The one hard-coded thing is the `OMIT` list at the top of
`src/lib/server/academicCalendar.ts`, for entries the PDF itself gets wrong;
comment a line out once a newer PDF prints it correctly.

## Scripts

```sh
npm run gen:clubs   # rebuild clubs.json + extract logos from the workbook
npm run gen:og      # regenerate static/og/*.png (needs `brew install librsvg`)
npm run check       # svelte-check
node scripts/ttChanges.ts   # rebuild ttchanges.json (needs ../dump/ttdiff.ts)
node scripts/academicCalendar.check.ts   # parse the calendar PDF and print every entry
```

The `scripts/*.check.ts` files are plain `assert` self-checks for the parsing
and validation logic — run one directly with `node scripts/<name>.check.ts`.

## Environment

Only `/room-switch` needs config. See `.env.example`: a MongoDB Atlas URI plus
a Google OAuth client ID (set both `GOOGLE_CLIENT_ID` and
`PUBLIC_GOOGLE_CLIENT_ID`). Set the same vars in your host's dashboard for
production. Every other page works with no env at all.
