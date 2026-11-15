# npgolf UI review (November 2026)

This review covers the React frontend (`frontend/src/`) on `main` at `a6b31ac`, after PR #14. It was checked against the local app at `http://localhost:3000/paradise/...`, signed in as a Paradise admin, at desktop width and at phone width (375 × 812). This was a review only: no code or data was changed. In the browser I only picked tournaments and foursomes from dropdowns, and saved nothing.

It builds on the earlier audit in `ux_audit/` (May 2026). Several of that audit's items are now done: the skip link, the mobile off-canvas sidebar, the toast system, `ConfirmModal` (on Tournaments, Users and Dashboard), the Admin divider in the sidebar, numeric keypads on score entry, and table header labels on Users. Earlier items that are still open are marked **(carry-over)** below.

**Effort key:** S = under 1 hour · M = half a day · L = 1–3 days.
**Evidence key:** *seen* = reproduced in the running app · *code* = found by reading the code.

---

## Top 10 (do these first)

| # | Finding | Where | Effort |
|---|---|---|---|
| 1 | The leaderboard shows every player's email address to every signed-in player | `Leaderboard.jsx:769` | S |
| 2 | Score Entry's "existing group" list only shows foursomes that already have scores, so the foursomes set up in Tournament Players can't be picked before the first save | `ScoreEntry.jsx:219`, `src/routes/scores.js:86` | S–M |
| 3 | Scores of 10 or more can't be entered | `ScoreEntry.jsx:977,988` | S |
| 4 | Previous and the hole buttons move without saving, and nothing warns about unsaved scores; a reload or a dropped phone tab loses them | `ScoreEntry.jsx:1066,1097` | M |
| 5 | "Hole 10 of 9" on back-nine rounds | `ScoreEntry.jsx:928` | S |
| 6 | Login links lose the league prefix (`/register` instead of `/paradise/register`) | `Login.jsx:93,131,145` | S |
| 7 | On phones, the leaderboard shows only Rank and Player; points and over/under are off-screen | `Leaderboard.jsx:716` | M |
| 8 | The "NPGOLF" text in the logo is invisible on the dark sidebar and mobile header | `public/npgolf-logo.svg`, `MainLayout.jsx:97,235` | S |
| 9 | Non-admins can still edit scores after they are posted, even though the banner says "Contact an admin" | `ScoreEntry.jsx:764-776, 972-1014` | S |
| 10 | One 531 kB JS bundle (137 kB gzipped) holds all 27 pages | `main.jsx` | S–M |

---

## Quick wins (S effort, each one on its own)

### Score entry

**QW-1. Allow scores of 10 or more.** *code*. `ScoreEntry.jsx:977` sets `max="9"`, and the `onChange` at line 988 rejects anything over 9. A 10 on a par 5 can't be recorded, so gross totals come out wrong. (Quota points don't change, because any double bogey or worse already scores 0.) Single-digit input also auto-advances focus (`focusNext`), so a two-digit score can't be typed at all.
*Fix:* allow 1–15. Auto-advance only when the first digit is 2–9, or when two digits have been typed. Do the same for the CTP inches field.

**QW-2. "Hole 10 of 9".** *seen* on the 9/16 back-nine round. Line 928 prints `currentHole` against `playableHoles.length`.
*Fix:* `Hole {currentHole} · {getCurrentHoleIndex()+1} of {playableHoles.length}`.

**QW-3. Lock score inputs once posted, for non-admins.** *code*. When `isPosted && !isAdmin`, the banner says to contact an admin, but the inputs and Save still work. If the server rejects the save, the golfer gets a raw `alert`. If it accepts, posting doesn't really lock anything.
*Fix:* add `disabled={isPosted && !isAdmin}` to the score and quota inputs and the CTP and Save buttons.

**QW-4. Hide the 333/666 side-game box until it's needed.** *seen*. The side-game box shows before a tournament is chosen and before the player list. Its dollar fields take up most of the first screen on a phone.
*Fix:* collapse it into a "Side game (optional)" disclosure below the player picker, and only render it once a tournament is chosen.

**QW-5. Warn when Save & Next skips a player.** *code*. `saveCurrentHole` drops players with no score (`.filter(Boolean)`, line 562) and moves on silently. A missed player only shows up on the final scorecard.
*Fix:* if some of the selected players have no score, ask "Save without Fred Bailey's score?", or highlight the empty box and stay on the hole.

**QW-6. The CTP modal's Cancel doesn't cancel.** *code*. Feet, inches and photo are written straight into state as you type (`handleCtpChange`). "Save" only closes the modal (line 525), and "Cancel" keeps the edits too. A feet value of `0` shows as blank (`|| ''`, line 1251).
*Fix:* edit a local draft and commit it on Save. Use `?? ''` for the value.

**QW-7. Replace the 8 `alert()` calls in Score Entry with the existing toast.** *code*. The calls are at lines 247, 263, 266, 531, 537, 565, 591 and 611. On iOS, alerts block the page and look like system errors. `ToastContext` already exists but isn't used here. `loading` is never set to `true`, so `renderSkeleton()` never shows (line 961). Fetch failures only go to `console.error`, which leaves empty dropdowns with no explanation.
*Fix:* use `addToast(..., 'error')`, set `loading` around the fetches, and show an inline "Couldn't load tournaments, retry" message.

**QW-8. Remove dead code.** *code*. `assignGroupToSelectedPlayers`, `autoPairSelected` and `clearPairs` (lines 245-286) have no UI. "✓ Group name set" (line 845) appears after typing a single character, which suggests something was validated when nothing was.

### Leaderboard and player data

**QW-9. Stop showing emails on the leaderboard.** *seen*. Every player's address appears under their name for all signed-in users (`Leaderboard.jsx:769`).
*Fix:* remove the line, or show it only when `isAdmin`. Also check `League.jsx:223` (Players tab), which shows emails too, and the `(email)` suffixes in the dropdowns at `Quota.jsx:214` and `TournamentPlayers.jsx:811`.

**QW-10. Show ties, and keep rank badges consistent.** *seen*. Tied players show a bare "5 / 5 / 5". On the dashboard standings, ranks 1–3 show as "1, 2, 3" but 4+ as "#4".
*Fix:* show `T5` when the next or previous row has the same rank, and use one style everywhere. Give the medal emoji an `aria-label="1st"`.

**QW-11. Format prize money.** *code*. `${player.quota_prize_money}` (`Leaderboard.jsx:795,822,835`) can show `$12.5`.
*Fix:* use `.toFixed(2)` or `Intl.NumberFormat`, matching the dashboard's `$213.00`.

**QW-12. Fix the back link.** *seen*. The leaderboard is usually reached from Tournaments, but its back link says "← Back to Dashboard" (line 619).
*Fix:* use `navigate(-1)` with a dashboard fallback, or link to Tournaments.

### Tournament Players

**QW-13. Show the course name, not "Course ID: 3".** *seen* (`TournamentPlayers.jsx:338`). The leaderboard already uses `tournament.course_name`.

**QW-14. Rows jump while typing a foursome number.** *code*. `confirmedPlayers` sorts by the live edit values (`getEffectiveGrouping`, lines 269-310). Typing "1" in a row moves that row before blur, so the next tap lands on the wrong player.
*Fix:* sort by saved values only (`player.foursome` and `player.pair`).

**QW-15. Show save state for the foursome and pair fields.** *code*. The fields save on blur with no feedback (`editValues[id].saving` is set but never rendered). They also have no labels: the placeholders "e.g. 1" and "-" are their only names.
*Fix:* show a small spinner or ✓ next to the field, and add `aria-label="Foursome for {name}"`.

**QW-16. Fix "Mark All Paid" so it doesn't mark unconfirmed players.** *code*. `handleMarkAllPaid` (line 219) sets `paid: true` on **all** players in local state, not just the confirmed unpaid ones it sends to the API, so the screen can disagree with the server until reload.

**QW-17. The Status column is always "✓ Yes".** *seen*. The table only lists confirmed players (line 312), so the column carries no information. Admins have no way to see who is pending or declined.
*Fix:* drop the column, or better, add a "Pending / Declined (n)" section below the table (that part is M effort).

**QW-18. "Add Player" shows for non-admins.** *code*. Line 374 isn't gated by `isAdmin`, unlike the other header buttons. If players are meant to add themselves, rename it "Add me". Otherwise gate it.

### Layout, navigation and wording

**QW-19. The logo text is invisible on dark backgrounds.** *seen*. The wordmark fill is `#0F172A`, the same colour as `bg-slate-900`, so the sidebar and the mobile header show only the icon.
*Fix:* add a light variant of the logo (`npgolf-logo-dark.svg` with white text) for `MainLayout`.

**QW-20. Login links drop the league.** *code + seen*. "Join a League", "Request Access" and "Forgot password?" are plain `<a href="/register">` and `<a href="/forgot-password">` tags, so on `/paradise/login` they go to `/register`, losing the league and doing a full page reload. The `disabled` attribute on the forgot-password `<a>` (line 93) does nothing.
*Fix:* use `<Link to="/register">`, which honours the router `basename`.

**QW-21. Icon-only "Add Tournament" on phones has no name.** *seen*. The text is `hidden sm:inline` (`Tournaments.jsx:241`), so screen readers get an unnamed button, and sighted users get a bare trophy.
*Fix:* add `aria-label="Add tournament"`, or keep a short visible label ("+ Add").

**QW-22. Small tap targets.** *seen*. The mobile menu button is `p-1.5` around a 20 px icon, about 32 px (`MainLayout.jsx:228`). Others are the foursome and pair inputs (`py-1`), the pay-status pills (`py-1 text-xs`), the "Clear All" link in Score Entry, and the Edit / Invite / Delete links on Players.
*Fix:* give interactive elements on phone pages `min-h-[44px] min-w-[44px]`.

**QW-23. The closed mobile drawer is still keyboard-focusable.** *code*. The off-screen `<aside>` stays in the tab order, and Escape doesn't close it.
*Fix:* add `inert={!mobileOpen}` below `md` (or `aria-hidden` plus `tabIndex=-1`), close on Escape, and focus the first link when it opens.

**QW-24. Toasts aren't announced and can cover buttons.** *code*. The toast container (`ToastContext.jsx`) has no `role="status"` or `aria-live`. At the bottom right of a phone it sits over Score Entry's Save & Next.
*Fix:* add `role="status" aria-live="polite"`, and position it `top-4 inset-x-4` below `sm`.

**QW-25. Every page is titled "NPGOLF".** *code*. Browser tabs, history and screen readers can't tell pages apart **(carry-over M-7)**.
*Fix:* add a tiny `useTitle('Score Entry · Paradise')` hook.

**QW-26. Disabled buttons are unreadable.** *seen*. "Mark All Quota Paid" is white on `gray-400` when disabled (about 2.5:1 contrast) and looks like any other button.
*Fix:* use `disabled:bg-gray-200 disabled:text-gray-500` and a tooltip: "Everyone is already marked paid".

**QW-27. Inactive players are shown at `opacity-50`** (`Users.jsx:316`). This puts their text below 4.5:1 contrast.
*Fix:* use full-opacity text plus an "Inactive" badge.

**QW-28. Unknown URLs go to /login** (`main.jsx`, `path="*"`). A mistyped league URL silently shows a login page **(carry-over N-06)**.
*Fix:* add a small 404 page that links to "Find my league".

**QW-29. Clean up `index.html`.** It has a leftover `console.log`, a static "Loading..." text, no `theme-color` and no `apple-touch-icon`. Golfers who add the app to their home screen get a generic icon **(carry-over V-04)**.

**QW-30. `ProtectedRoute` renders `null` while auth loads**, which leaves a blank screen on slow Pi responses.
*Fix:* render the same skeleton the pages use.

---

## Larger changes

### L-1. Rework the Score Entry flow for phones (L) — highest value

*seen + code.* Today on a phone you scroll through: the posted banner, the tournament select, the group select **and** a free-text group box, the side-game box, the quota summary, the hole card, the quick-nav grid, and finally the player picker at the very bottom. The player picker is required before the hole card appears, so a new user has to find it below everything else. Typing a group name creates a new group on any typo ("10" vs "10 "), and those mismatched groups later show up separately in Tournament Players and the cart tags.

Suggested flow (keep it all on one route so the QR deep link still works):
1. **Pick the round.** Default to today's tournament when there is one (currently it lists newest first, and stale uncompleted rounds such as 7/1/2026 still appear).
2. **Pick your foursome** from the foursomes assigned in Tournament Players (`tournament_players.foursome`). Selecting one fills the four players automatically. Keep "Enter players manually" as a secondary option. This needs `GET /scores/tournament/:id/groups` to union in the assigned foursomes, or a call to the existing `tournamentsAPI.getFoursome`. That backend change on its own is S effort and fixes Top-10 #2.
3. **Hole screen:** a sticky header ("Hole 12 · Par 4 · 3 of 9") with ◀ ▶, one row per player (name, score stepper or keypad, points shown read-only), and a sticky Save & Next bar at the bottom. Scroll to the top of the hole card after each save.
4. Put the side game behind an optional toggle (QW-4).

### L-2. Don't lose unsaved scores (M)

*code.* Scores live only in React state. Previous and the quick-nav buttons don't save, and a reload, a phone lock or an iOS tab discard loses everything since the last Save & Next.
*Fix:* (a) save on any hole change, not just Save & Next. (b) Mirror unsaved scores to `localStorage` keyed by `tid + foursome`, restore them on load, and clear them after a successful save. (c) Mark unsaved holes in the quick-nav grid (for example an amber dot), and add a `beforeunload` guard while anything is unsaved.

Two related race conditions (*code*, plausible rather than reproduced):
- `loadExistingScores` maps scores by `holes`, but its effect (line 112) doesn't depend on `holes`. On a QR deep link, the foursome can load before the course holes, and saved scores then show as empty.
- `loadCtpLeader` (line 119) runs before `holes` load. If the first hole is a par 3, it shows "No CTP recorded yet – be the first!" even when a leader exists.
*Fix:* add `holes` to both effects' dependencies.

### L-3. Resize CTP photos before upload (S–M)

*code.* The photo is read with `FileReader.readAsDataURL` and sent as `ctp_image_url` inside the JSON for every score row (`ScoreEntry.jsx:557,560`). A 4–8 MB phone photo becomes 5–11 MB of base64, sent on cellular from the course to a Raspberry Pi. This risks timeouts, request-size limits and database bloat.
*Fix:* shrink the photo on the device (canvas to about 1280 px wide, JPEG quality 0.7, roughly 150 kB). Better still, upload it once to an image endpoint and store only the URL.

### L-4. Phone layout for wide tables (M per table)

*seen.* These tables only scroll sideways on phones:

| Table | Width |
|---|---|
| Leaderboard | 1200 px |
| Tournament Players | 980 px |
| Dashboard results | 920 px |
| Leaderboard admin tables | 820 / 760 px |
| Tournaments | 600 px |
| Users | 600 px |

All use `px-6` cells, and none has a sticky first column. On the leaderboard at 375 px you see Rank and Player (with email) and nothing else. On Tournaments, all nine action buttons are off-screen, and on Players the **Actions** column comes first while the name is second.

*Fix, in order of value:*
- **Leaderboard:** below `md`, show a card or compact row per player: rank, name, points vs quota, +/-, and $ won. Tap a row to expand skins, CTP and strokes.
- **Tournaments:** use a card per round, with the 2–3 main actions (Players, Leaderboard, Scores) visible and the rest under a "⋯" menu. Split the list into Upcoming and Past. Right now nine buttons repeat on every row (Players, Leaderboard, Hole Scores, Invitations, Cart Tags, Send Tags, Edit, Results, Complete, Delete), which is a lot even on desktop.
- **Tournament Players:** add a "By foursome" view (one card per group, with drag or select to assign) for setting up foursomes. Keep the table for payments.
- **Generally:** use `px-3 md:px-6`, a `sticky left-0` name column, and move Actions to the last column on Players.

### L-5. Shared form and modal building blocks (M–L)

*code.* Only 9 of the 139 `<label>`s have `htmlFor`, so screen readers mostly announce placeholders ("#", "Choose a tournament...", "name@company.com"). There are 17 hand-built `fixed inset-0` modals, and only `ConfirmModal` has `role="dialog"`, focus trapping and Escape. None returns focus to the button that opened it. `confirm()` remains on 6 pages (BillingEntities, Courses, EditCourse, Inbox, Quota and TournamentPlayers ×2) **(carry-over C-8, partly done)**. The Send Invitations modal sends to everyone on the first click, with no recipient count.
*Fix:*
- Add a `<Field label=... >` component that generates the id/htmlFor pair, and a `<Modal>` built on `ConfirmModal`'s focus logic (plus focus return). Migrate page by page, starting with Score Entry, Login and EditPlayerModal.
- Replace the remaining `confirm()` calls with `ConfirmModal` and name the item ("Remove Fred Bailey from 9/16?").
- Show "Send to 31 players (24 SMS, 29 email)" before the invitation buttons.

### L-6. Make primary buttons and colours consistent (M)

*seen + code.* Primary buttons use `bg-blue-600` 29 times, `bg-green-600` 11 times, `bg-fairway-600` 10 times and `bg-emerald-600` 5 times. The new pages (Dashboard, Tournaments, Users header) use `btn-primary` / fairway green, while Score Entry, Leaderboard and Tournament Players use blue, and the leaderboard header is a blue gradient. Rounded corners (`rounded`, `rounded-lg`, `rounded-xl`) and page padding (`p-4`, `p-6`, `max-w-2xl`, `max-w-6xl`, `w-full`) also vary by page. The dashboard repeats its own logo bar and quick-action buttons inside `MainLayout`, so signed-in users see two headers.
*Fix:* define `btn-primary`, `btn-secondary`, `btn-danger` and a `PageHeader` (title, subtitle, back link, actions) in `index.css` and components, then apply them page by page. Drop the dashboard's inner logo bar when it's rendered inside the layout.

### L-7. Code splitting (S–M)

*Measured:* `vite build` produces one `index-*.js` of **531.53 kB (137.45 kB gzipped)** and CSS of 49 kB (8.4 kB gzipped). The only dependencies are React, React Router, axios and lucide-react, so the size is the app itself: every admin page (BillingEntities 828 lines, RulesManager, ScorecardUpload, Settings, Quota and so on) loads on a golfer's phone before Login renders **(carry-over P-03)**.
*Fix:* `React.lazy(() => import('./pages/X'))` for every route except Login, LeagueSelect and Dashboard, wrapped in `<Suspense fallback={<PageSkeleton/>}>`, plus `manualChunks: { vendor: ['react','react-dom','react-router-dom','axios'] }`. Score Entry should end up loading well under 200 kB. Also add `font-display`-friendly preloads or self-host Inter, because the Google Fonts stylesheet blocks rendering on slow course signal.

### L-8. Live leaderboard refresh (S–M)

*code.* The leaderboard loads once (`Leaderboard.jsx:43`). During a round, players have to pull to refresh.
*Fix:* poll every 60 s while the tab is visible (`document.visibilityState`) and the tournament isn't completed, and show "Updated 12:41 pm".

### L-9. Consistent loading, empty and error states (M)

*seen + code.* Loading looks different on almost every page:

| Page | Loading state |
|---|---|
| Dashboard, Users | Skeletons |
| Leaderboard, TournamentPlayers, Settings, Inbox | Plain "Loading..." text |
| League | Centred text |
| ProtectedRoute | Blank screen |
| Score Entry | Nothing |

Errors are red boxes on some pages, `alert()` on others, and only `console.error` on others (Score Entry fetches, Inbox player list `.catch(() => {})`). There's no retry anywhere.
*Fix:* add `<PageSkeleton/>`, `<EmptyState icon title action/>` and `<ErrorState onRetry/>` components, and use them for every top-level fetch.

---

## Smaller notes

- `TournamentPlayers.jsx:692` uses `new Date(registration_date).toLocaleDateString()` while the rest of the app uses `formatDateOnly`, so dates can show a day early in US time zones.
- `TournamentPlayers.jsx:687` and other places use `quota || '-'`, which hides a real quota of 0. Use `??`.
- `Leaderboard.jsx:811` calls `player.skin_holes.sort(...)` during render, which sorts the array in place in state. Use `[...arr].sort`.
- `MainLayout`: the "Admin" label checks `sidebarOpen` without the `md:` prefix. If the sidebar was collapsed on desktop, the phone drawer shows a divider instead of the label. The nav items are `<button onClick={navigate}>`, so they can't be opened in a new tab and lack `aria-current="page"`. Use `<NavLink>`.
- The collapsed-sidebar state isn't remembered between visits. Store it in `localStorage`.
- Score Entry has no `<label htmlFor>`, so the per-player Score and Quota inputs are both announced as "#". Use `aria-label="Score, {name}"`.
- The completion modal's 18-hole scorecard is squeezed into `max-w-lg`. On phones, show front and back nine as two rows, or totals only with a "View card" option.
- The Players page subtitle says "Active league members", but the list includes inactive players.

---

## Already in good shape

- The QR deep link from the cart tags (`/scores?tid=..&foursome=..`) survives login: `ProtectedRoute` stores `from` and `Login` uses it.
- Score Entry's coloured score boxes (birdie, par, bogey and so on), the 44 px hole grid and CTP buttons, and the numeric keypads all work well on a phone.
- The read-only points, tournaments-played and prize fields in `EditPlayerModal` (from PR #14) are clearly styled and explain where the values come from (`title`).
- Prize reconciliation on Tournament Players is clear about why amounts are hidden on the leaderboard.
- There were no console errors on any page visited.
