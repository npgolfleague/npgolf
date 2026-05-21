# NPGOLF UX Audit — AI Remediation Prompts
**Based on:** NPGOLF UX Audit Report, May 7, 2026  
**Purpose:** One ready-to-paste AI prompt per finding, ordered Critical → High → Medium → Low.  
**Notation:** `⚠️ DECISION POINT` = human judgment required before or during execution.

---

## TIER 1 — CRITICAL (Must Fix Before Launch)

---

### PROMPT C-1 · Finding N-01 — Fix 'Join' Button Route

**Model:** Gemini Flash Latest  
**Justification:** Single-file, single-line routing fix with no architectural complexity.

**Role:** You are a senior React front-end developer working on a Vite + React Router v6 single-page application.

**Task:**  
In the NPGOLF frontend (`frontend/src/`), the public navigation header contains a "Join" button that currently navigates to `/` (the home route), creating a dead loop for new users. Fix it to navigate to `/register`.

1. Search all files under `frontend/src/` for the "Join" button or link rendered in the public (unauthenticated) header. It will likely be in a layout component or on `Dashboard.jsx` / `main.jsx`.
2. Change the destination from `/` (or whatever it currently resolves to) to `/register`.
3. While you are in that component, also verify the "Sign In" link routes to `/login`. If it does not, fix it.
4. Do not change any other logic, styling, or components.

**Acceptance criteria:** Clicking "Join" on any public page navigates the user to `/register`. Clicking "Sign In" navigates to `/login`.

---

### PROMPT C-2 · Finding H-05 — Resolve Disabled Forgot Password Link

**Model:** Gemini Pro Latest  
**Justification:** Requires a decision between two implementation paths (full feature vs. removal), then either a multi-file feature build or a surgical deletion — both paths need context-aware reasoning.

**Role:** You are a senior React front-end developer and Node.js back-end developer familiar with JWT-based authentication flows.

> ⚠️ **DECISION POINT — Choose one option before running this prompt:**  
> **Option A:** Implement the forgot-password flow end-to-end.  
> **Option B:** Remove the link entirely and add a "Contact your administrator to reset your password" note in its place.  
> The `/forgot-password` route and `ForgotPassword.jsx` / `ResetPassword.jsx` page components already exist in the codebase. Option A requires verifying that the back-end email-sending route (`/api/auth/forgot-password`) is fully implemented and tested. Check `src/routes/` before choosing.

**Task (Option A — implement the flow):**  
In `frontend/src/pages/Login.jsx`, the "Forgot password?" anchor element has an HTML `disabled` attribute, which is invalid on `<a>` elements and silently prevents navigation.

1. Remove the `disabled` attribute from the anchor element.
2. Verify the `href` (or `to` if using `<Link>`) points to `/forgot-password`.
3. Open `frontend/src/pages/ForgotPassword.jsx` and ensure the form calls the correct API endpoint (`authAPI.forgotPassword(email)` or equivalent). Wire it up if it is stubbed.
4. Open `frontend/src/pages/ResetPassword.jsx` and verify the token-based reset form is complete.
5. In `src/routes/` (back end), verify the POST `/api/auth/forgot-password` route sends an email via the existing `email.js` utility and returns an appropriate response. Implement if missing.
6. Test the happy path: submit email → receive link → reset password → login.

**Task (Option B — remove the link):**  
In `frontend/src/pages/Login.jsx`, delete the "Forgot password?" anchor element entirely. Replace it with the static text: `"Forgot your password? Contact your league administrator."` Ensure this text is styled consistently (small, slate-500, same position).

---

### PROMPT C-3 · Finding H-06 / V-01 — Restyle Register Page to Match Login Visual System

**Model:** Gemini Pro Latest  
**Justification:** Multi-element visual redesign of a full page component; requires understanding of the existing Tailwind design tokens, component patterns from Login.jsx, and careful preservation of all form logic.

**Role:** You are a senior React front-end developer and UI designer specializing in Tailwind CSS design systems.

**Task:**  
`frontend/src/pages/Register.jsx` uses a generic `bg-gradient-to-br from-blue-500 to-purple-600` background, gray-300 input borders, no NPGOLF logo, and no fairway color tokens. It must be restyled to match `frontend/src/pages/Login.jsx` exactly in visual language while preserving all existing form fields, state, validation, and submission logic.

1. Read `Login.jsx` in full to understand the exact structure: outer div (slate-900 bg, min-h-screen, flex, relative overflow-hidden), decorative blur circles (absolute divs with fairway-500 and blue-500, opacity-10, blur-3xl), white card (bg-white, rounded-2xl, shadow-2xl, p-10, max-w-md, border border-slate-100).
2. Apply the identical outer wrapper and card structure to `Register.jsx`.
3. Add the NPGOLF logo (`<img src="/npgolf-logo.svg" alt="NPGOLF" className="h-16 w-auto mb-2" />`) above the form title, centered.
4. Change the form title from `"NPGOLF Sign Up"` to `"Create Your Account"` with a subtitle `"Join the Paradise Cup league"`.
5. Update all input field classes to match Login.jsx: `px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fairway-500/20 focus:border-fairway-500`.
6. Update all `<label>` classes to `block text-slate-700 text-sm font-bold mb-1.5 ml-1`.
7. Change the submit button to use the existing `btn-primary` class (already defined in `index.css`) with a loading spinner matching Login.jsx's pattern (Disc3 animate-spin from lucide-react).
8. Do not modify any state variables, form submission logic, API calls, or the SMS consent checkbox behavior.

**Acceptance criteria:** Register page is visually indistinguishable in layout/color/typography from the Login page. All form fields remain functional.

---

### PROMPT C-4 · Finding M-01 — Mobile-Responsive Sidebar (Off-Canvas Drawer)

**Model:** Gemini Pro Latest  
**Justification:** Architecture-level layout change affecting the root `MainLayout.jsx` component; requires breakpoint logic, overlay state management, and careful handling of the existing collapse toggle.

**Role:** You are a senior React front-end developer expert in Tailwind CSS responsive design and mobile UX patterns.

**Task:**  
`frontend/src/components/MainLayout.jsx` renders a fixed-width sidebar (`w-64` expanded, `w-16` collapsed) with no mobile breakpoint. On viewports narrower than 768px (Tailwind `md`), the sidebar must transform into an off-canvas drawer that slides in over the content with a backdrop overlay.

1. Add a new state variable: `const [mobileOpen, setMobileOpen] = useState(false)`.
2. On screens **≥ md**: keep the existing inline sidebar behavior (collapsible to `w-16`). No change to current logic.
3. On screens **< md** (`below md breakpoint`):
   - The sidebar should be hidden by default (`-translate-x-full`) and slide in (`translate-x-0`) when `mobileOpen` is true.
   - Position it as `fixed inset-y-0 left-0 z-50` with full `w-64` width (no icon-only collapse on mobile).
   - Add a semi-transparent backdrop overlay (`fixed inset-0 bg-black/40 z-40`) that appears behind the sidebar when open; clicking it closes the drawer.
   - Add a hamburger menu button (`Menu` icon from lucide-react) in the top-left of the main content area, visible only on `< md`, that toggles `mobileOpen`.
4. When a navigation item is clicked on mobile, close the drawer (`setMobileOpen(false)`).
5. Use Tailwind's `md:` prefix variants throughout. Do not remove or break the existing desktop collapse toggle behavior.
6. Ensure the main content `<main>` element does not shift on mobile (it should remain full-width; the sidebar overlays it).

---

### PROMPT C-5 · Finding H-01 / N-02 — Replace "Failed to Load Data" with Member-Gated Messages

**Model:** Gemini Pro Latest  
**Justification:** Touches multiple components and requires understanding of the auth context, route architecture, and error-vs-auth distinction to implement correctly.

**Role:** You are a senior React front-end developer with expertise in React Router v6 route guards and authentication-aware UI patterns.

**Task:**  
The public dashboard and several routes (`/schedule`, `/scores`, `/players`, `/join`, `/admin`, `/league`) render "Failed to load data" when API calls fail for unauthenticated users. This error is inappropriate — the data is intentionally gated, not broken.

1. In `frontend/src/pages/Dashboard.jsx`, find the error handling block in `fetchData()`. Currently it sets `setError('Failed to load data')` on any error.
   - Inspect the error response: if `err.response?.status === 401` or `err.response?.status === 403`, do NOT set a generic error. Instead, set a new state flag `const [isGated, setIsGated] = useState(false)` and set `setIsGated(true)`.
2. In the JSX render, replace the "Failed to load data" error display with:
   - If `isGated` is true: render a card with the message **"League standings are available to members. Sign in to view full standings and tournament history."** Include a `<button onClick={() => navigate('/login')} className="btn-primary mt-3">Sign In</button>`.
   - If a genuine `error` state exists (non-auth error): keep a generic "Unable to load data. Please try again." message.
3. Apply the same 401/403 distinction to the standings table "Failed to load data" fallback rendered from the public-facing API call.
4. For the orphaned routes (`/schedule`, `/scores`, `/players`, `/join`) that currently render the default dashboard content: add a catch-all redirect in `main.jsx` (or wherever routes are defined) so any unrecognized public route redirects to `/` with a `replace` flag.

> ⚠️ **DECISION POINT:** Confirm whether `/admin` and `/league` should redirect to `/login` (for authenticated-only routes) or to `/` (home). Typically authenticated-only routes should redirect unauthenticated users to login with `state={{ from: location }}` so they are returned after sign-in.

---

### PROMPT C-6 · Finding A-02 — Add Table Headers to Standings Table

**Model:** Gemini Flash Latest  
**Justification:** Targeted, well-defined HTML structure change with clear acceptance criteria and no logic changes required.

**Role:** You are a front-end accessibility specialist with expertise in WCAG 2.1 and semantic HTML table structure.

**Task:**  
The standings table in `frontend/src/pages/Dashboard.jsx` renders all cells as `<td>` elements with no `<thead>` or `<th>` elements. Screen readers cannot associate column data with labels. Add proper semantic headers.

1. Locate the standings table render in `Dashboard.jsx`.
2. Add a `<thead>` row as the first child of the `<table>` with the following `<th scope="col">` columns (match the column order currently rendered):
   - `Rank` | `Player` | `Pts` | `Hdcp` | `Rounds` | `Wins` | `Prize`
3. Each `<th>` should also include an `aria-label` with the full word: `aria-label="Points"`, `aria-label="Handicap"`, etc.
4. Style the `<th>` cells consistently with the table's existing design (use the same text color and font weight as existing header-like elements, or `text-xs font-semibold uppercase text-slate-500`).
5. Wrap the existing data rows in `<tbody>`.
6. Make the same change to any other data tables in the application that are missing `<thead>`/`<th>` structure (check `Tournaments.jsx`, `Users.jsx`, `Quota.jsx`, `ScoreEntry.jsx`).

---

### PROMPT C-7 · Finding A-03 — Add Skip-Navigation Link

**Model:** Gemini Flash Latest  
**Justification:** Self-contained, well-understood accessibility pattern; single addition to the root layout.

**Role:** You are a front-end accessibility specialist implementing WCAG 2.1 AA compliance improvements.

**Task:**  
There is no "Skip to main content" link on any page. Keyboard users must tab through the entire sidebar navigation on every page load. Add a visually-hidden skip link that becomes visible on focus.

1. In `frontend/src/components/MainLayout.jsx`, add the following as the **very first child element** inside the outermost `<div>`:
```jsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-fairway-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
>
  Skip to main content
</a>
```
2. Add `id="main-content"` to the `<main>` element in `MainLayout.jsx`.
3. Also add the same skip link to the public (unauthenticated) layout if one exists, or directly to `Dashboard.jsx`'s outermost wrapper if no shared public layout component exists.
4. Verify with keyboard-only navigation that pressing Tab on page load highlights the skip link, and pressing Enter jumps focus to the main content region.

---

### PROMPT C-8 · Finding I-01 — Replace All window.confirm() with In-App Confirmation Modal

**Model:** Gemini Pro Latest  
**Justification:** Requires creating a reusable modal component and refactoring multiple call sites across different page components; architectural scope warrants Pro.

**Role:** You are a senior React front-end developer specializing in component architecture and accessible modal patterns.

**Task:**  
`window.confirm()` is used in at least three places in the application (tournament delete, tournament complete, quota refresh). This native dialog is not stylable, is blocked by some mobile browsers, and is inaccessible. Replace all instances with a reusable in-app `ConfirmModal` component.

1. Create `frontend/src/components/ConfirmModal.jsx`:
   - Props: `isOpen` (bool), `title` (string), `message` (string), `confirmLabel` (string, default `"Confirm"`), `cancelLabel` (string, default `"Cancel"`), `onConfirm` (function), `onCancel` (function), `danger` (bool, default false).
   - Render as a centered modal overlay (`fixed inset-0 bg-black/50 z-50 flex items-center justify-center`).
   - The modal card should use `bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4`.
   - The confirm button: `btn-danger` if `danger` is true, otherwise `btn-primary`.
   - Trap focus within the modal while open. Close on Escape key press. Include `role="dialog"` and `aria-modal="true"` with `aria-labelledby` pointing to the title.
2. In `frontend/src/pages/Tournaments.jsx`, replace every `window.confirm(...)` call:
   - Add state: `const [confirmModal, setConfirmModal] = useState(null)` where the value is `{ title, message, onConfirm }` or `null`.
   - Replace each `if (!confirm('...')) return` block with `setConfirmModal({ title: '...', message: 'Tournament: [name]', onConfirm: () => { /* original logic */ setConfirmModal(null) } })` and `return` early. The actual action fires from `onConfirm`.
   - Render `<ConfirmModal isOpen={!!confirmModal} {...confirmModal} onCancel={() => setConfirmModal(null)} danger />` at the bottom of the JSX.
   - Ensure the tournament **name** is included in the confirmation message (e.g., `"Delete 'Eagles - Lakes (May 13)'? This cannot be undone."`).
3. Apply the same pattern to quota refresh in `Dashboard.jsx` and any other `window.confirm()` usage found in the codebase (`grep -r "window.confirm" frontend/src`).

---

## TIER 2 — HIGH PRIORITY (Pre-Launch Sprint)

---

### PROMPT H-1 · Findings H-03 / C-01 — Label All Standings Table Columns

> *Covered by Prompt C-6 above. If C-6 was executed, verify column labels are also visible in the public (unauthenticated) standings view and that ARIA labels use full words. No separate execution needed unless C-6 was skipped.*

---

### PROMPT H-2 · Finding A-04 — ARIA Labels for Collapsed Sidebar Icon Buttons

**Model:** Gemini Flash Latest  
**Justification:** Targeted attribute addition across a single component; no logic changes.

**Role:** You are a front-end accessibility specialist implementing WCAG 2.1 AA compliance (Success Criterion 4.1.2 — Name, Role, Value).

**Task:**  
In `frontend/src/components/MainLayout.jsx`, all sidebar navigation `<button>` elements render only an icon (`<Icon className="w-5 h-5 shrink-0" />`) when the sidebar is collapsed. These buttons have no accessible name.

1. In the `menuItems` and `adminMenuItems` arrays, each item already has a `label` property (e.g., `"Dashboard"`, `"Players"`).
2. On each sidebar navigation `<button>`, add `aria-label={item.label}` unconditionally (it is useful even when expanded, as it provides a programmatic label).
3. Also add `title={item.label}` so that sighted mouse users see a native tooltip on hover in collapsed mode (this is the quick fix for finding H-10; address both simultaneously).
4. On the collapse-toggle button (`<ChevronLeft>` / `<ChevronRight>`), add: `aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}`.
5. On the logout `<button>`, add `aria-label="Log out"`.

---

### PROMPT H-3 · Finding A-06 — Fix htmlFor/id Pairing on Register Form

**Model:** Gemini Flash Latest  
**Justification:** Mechanical attribute addition; all field labels and inputs are already known from the source.

**Role:** You are a front-end accessibility specialist implementing WCAG 2.1 AA compliance (Success Criterion 3.3.2 — Labels or Instructions).

**Task:**  
In `frontend/src/pages/Register.jsx`, all `<label>` elements lack `htmlFor` attributes and their corresponding `<input>`/`<select>` elements lack `id` attributes. Clicking a label does not focus its field, breaking keyboard and assistive technology usability.

Add matching `htmlFor` / `id` pairs for every form field:

| Field | htmlFor / id value |
|---|---|
| Name | `reg-name` |
| Email | `reg-email` |
| Phone | `reg-phone` |
| Gender | `reg-gender` |
| Password | `reg-password` |
| SMS Consent checkbox | `reg-sms-consent` |

Apply the attribute to the `<label>` (`htmlFor="reg-name"`) and to the corresponding `<input>` or `<select>` (`id="reg-name"`). Do not change any other attributes, classes, or logic.

---

### PROMPT H-4 · Finding M-02 — Optimize Score Entry Inputs for Touch/Mobile

**Model:** Gemini Flash Latest  
**Justification:** Attribute additions to existing input elements; no logic changes.

**Role:** You are a senior React front-end developer specializing in mobile web UX and touch-optimized form design.

**Task:**  
Score entry is performed by players in the field on mobile devices. Numeric input fields must trigger the numeric keyboard on iOS/Android and have touch targets of at least 44×44px.

1. Open `frontend/src/pages/ScoreEntry.jsx` and `frontend/src/pages/TournamentHoleScores.jsx`.
2. For every `<input>` field that accepts a numeric score value:
   - Set `type="number"` (if not already set).
   - Add `inputMode="numeric"` to trigger the numeric keypad on mobile.
   - Add `pattern="[0-9]*"` for iOS Safari compatibility.
   - Add `min="1"` and `max="15"` (or whatever the reasonable upper bound for a single hole score is) to prevent obviously invalid values.
3. Ensure all interactive elements (inputs, buttons) have a minimum computed height and width of `44px`. Use `min-h-[44px] min-w-[44px]` Tailwind classes where tap targets are too small.
4. For the CTP feet/inches fields, apply the same `inputMode="numeric"` treatment.
5. Do not change the data model, state management, or submission logic.

---

### PROMPT H-5 · Finding H-08 — Named Confirmation Modal for Tournament Delete

> *Covered by Prompt C-8 (I-01) above. The `ConfirmModal` component built in C-8 must include the tournament name in its message. Verify that the Tournaments.jsx implementation passes the tournament name (e.g., course name + date) into the modal message string. No separate execution needed if C-8 was fully implemented.*

---

### PROMPT H-6 · Finding C-02 — Add League Context to Login Page

**Model:** Gemini Flash Latest  
**Justification:** Single-line copy change in one component.

**Role:** You are a UX copywriter and front-end developer.

**Task:**  
In `frontend/src/pages/Login.jsx`, the subtitle beneath the NPGOLF logo reads `"Please enter your details to sign in"` with no reference to the league or its name. A member who bookmarks the login URL loses all context.

1. Change the `<h1>` text from `"Welcome Back"` to `"Welcome Back to NPGOLF"`.
2. Change the subtitle `<p>` text from `"Please enter your details to sign in"` to `"Sign in to access the Paradise Cup league portal"`.
3. Do not change any styling, layout, or logic.

---

### PROMPT H-7 · Finding N-02 — Implement Route Guards for Orphaned Routes

**Model:** Gemini Pro Latest  
**Justification:** Requires understanding the full React Router v6 route tree, the AuthContext, and making architecture decisions about which routes are public vs. private.

**Role:** You are a senior React front-end developer expert in React Router v6 route protection patterns.

> ⚠️ **DECISION POINT:** Decide which routes should be: (a) public-only (redirect logged-in users to dashboard), (b) auth-required (redirect unauthenticated users to login), or (c) removed entirely. Recommended classification:
> - `/schedule`, `/players`, `/scores` → redirect to `/login` (auth-required; shouldn't exist as separate public routes)
> - `/join` → redirect to `/register`
> - `/admin` → redirect to `/login` (auth-required)
> - `/league` → redirect to `/app/dashboard` or implement `League.jsx` page
> Confirm this classification before running.

**Task:**  
In `frontend/src/main.jsx` (or wherever the React Router route tree is defined):

1. Audit every route definition. Identify all routes that currently resolve to the public dashboard component but should not exist or should redirect.
2. For auth-required routes that are not yet implemented, add explicit `<Navigate to="/login" replace state={{ from: location }} />` redirects using the `ProtectedRoute` component pattern already in `frontend/src/components/ProtectedRoute.jsx`.
3. For `/join`, add `<Route path="/join" element={<Navigate to="/register" replace />} />`.
4. Add a wildcard catch-all route at the end of the route tree: `<Route path="*" element={<Navigate to="/" replace />} />` for now (a proper 404 page is a Low priority item; this prevents silent broken routes).
5. Audit the sidebar path inconsistency (Finding N-03): ensure all sidebar items in `MainLayout.jsx` use consistent paths. If `/app/dashboard` and `/app/about` are prefixed, either add the `/app` prefix to all routes or remove it from those two. Do not leave mixed prefixes.

---

## TIER 3 — MEDIUM PRIORITY (Post-Launch Backlog)

---

### PROMPT M-1 · Finding H-10 — Tooltips on Collapsed Sidebar Icons

> *Covered by Prompt H-2 above (the `title={item.label}` addition). If H-2 was fully executed, this is complete. For a more polished CSS tooltip (visible without browser title delay), see the optional extension below.*

**Optional Enhancement (Gemini Flash Latest):**  
Replace the `title` attribute tooltips with a Tailwind CSS tooltip using `group` and `peer` utilities:
- Wrap each icon button content in a `relative group` span.
- Add a sibling `<span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">` containing the label text.
- This provides an instant, styled tooltip on hover in collapsed mode only.

---

### PROMPT M-2 · Finding H-09 — Inline Password Validation on Register Form

**Model:** Gemini Flash Latest  
**Justification:** Self-contained client-side validation addition to a single form field.

**Role:** You are a senior React front-end developer implementing accessible form validation patterns.

**Task:**  
In `frontend/src/pages/Register.jsx`, the password field has a hint text ("Min 8 chars, letters + numbers") but no inline validation. Users only learn of violations after a failed API call.

1. Add a new state variable: `const [passwordError, setPasswordError] = useState('')`.
2. Add an `onBlur` handler to the password `<input>` that validates:
   - Length ≥ 8 characters.
   - Contains at least one letter (`/[a-zA-Z]/`).
   - Contains at least one number (`/[0-9]/`).
   - If any condition fails, set a descriptive `passwordError` message (e.g., `"Password must be at least 8 characters and include both letters and numbers"`).
   - If all pass, clear the error (`setPasswordError('')`).
3. Render the error below the password field: `{passwordError && <p className="text-red-600 text-sm mt-1" role="alert">{passwordError}</p>}`.
4. In `handleSubmit`, prevent submission if `passwordError` is non-empty or if the password doesn't meet requirements.
5. The `role="alert"` on the error paragraph ensures screen readers announce it without requiring focus.

---

### PROMPT M-3 · Finding M-03 — Wrap Standings Table for Mobile Overflow

**Model:** Gemini Flash Latest  
**Justification:** Single Tailwind class addition around an existing element.

**Role:** You are a front-end developer specializing in responsive CSS.

**Task:**  
The standings table in `frontend/src/pages/Dashboard.jsx` overflows horizontally on mobile viewports. Wrap it in a scrollable container.

1. Find the `<table>` element rendering the standings data.
2. Wrap it in: `<div className="overflow-x-auto -mx-4 sm:mx-0">` (the negative margin allows the table to use full bleed on mobile while respecting padding on larger screens).
3. Add `min-w-[600px]` to the `<table>` element itself so it does not compress below a readable width.
4. Apply the same treatment to any other multi-column tables in the application (check `Tournaments.jsx`, `Users.jsx`).

---

### PROMPT M-4 · Finding V-03 — Color-Differentiate Dashboard Stat Cards

**Model:** Gemini Flash Latest  
**Justification:** Targeted Tailwind class changes to a known set of four components.

**Role:** You are a UI designer and front-end developer working with a Tailwind CSS design system.

**Task:**  
The four stat cards on the `Dashboard.jsx` public view (Next Event, Registered Players, Points Leader, Season Status) use identical styling, making them hard to scan at a glance.

Apply the following color scheme to the icon or accent element of each card (use the card's existing icon or add one from lucide-react if absent):

| Card | Accent Color | Icon (lucide-react) |
|---|---|---|
| Next Event | `text-blue-600 bg-blue-50` | `CalendarDays` |
| Registered Players | `text-fairway-600 bg-fairway-50` | `Users` |
| Points Leader | `text-amber-600 bg-amber-50` | `Trophy` |
| Season Status | `text-purple-600 bg-purple-50` | `Activity` |

Each card should have a small icon badge in the top-right or top-left corner using the accent colors above. Do not change the card's text content, data binding, or layout. Only add the icon badge and apply accent colors.

---

### PROMPT M-5 · Finding I-02 — Implement Toast Notification System

**Model:** Gemini Pro Latest  
**Justification:** Requires a reusable context-based notification system with auto-dismiss logic, usable across multiple components.

**Role:** You are a senior React front-end developer designing a reusable UI notification system.

**Task:**  
Key actions in the app (complete tournament, refresh quotas, delete tournament, send invitations) currently communicate success via inline state text that is easy to miss. Implement a toast notification system.

1. Create `frontend/src/context/ToastContext.jsx`:
   - Provides `addToast(message, type)` where `type` is `'success' | 'error' | 'info'`.
   - Maintains a list of toasts, each with a unique id, message, type, and auto-dismiss after 4 seconds.
   - Renders a fixed toast container: `fixed bottom-4 right-4 z-50 flex flex-col gap-2`.
   - Each toast: `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium` with color variants:
     - success: `bg-fairway-600 text-white`
     - error: `bg-red-600 text-white`
     - info: `bg-slate-700 text-white`
   - Include a close button (`X` from lucide-react) on each toast.
   - Animate in with a `translate-y` or `opacity` transition.
2. Wrap the app in `<ToastProvider>` in `main.jsx`.
3. In `Tournaments.jsx`, `Dashboard.jsx`, and any other component that currently sets a success/error string in local state for user feedback: replace those with `addToast('Tournament completed successfully', 'success')` calls using `const { addToast } = useContext(ToastContext)`.
4. Preserve existing error handling — toasts supplement rather than replace inline form errors.

---

### PROMPT M-6 · Finding P-02 — Add Browser Caching for Standings Data

**Model:** Gemini Pro Latest  
**Justification:** Requires evaluating the API layer, choosing between a manual TTL cache and a library (SWR/React Query), and implementing without breaking real-time score updates.

**Role:** You are a senior React front-end developer with expertise in data fetching strategies and client-side caching.

> ⚠️ **DECISION POINT:** Choose a caching approach:
> - **Option A (Simple):** Manual `sessionStorage` cache with a 5-minute TTL. No new dependencies.
> - **Option B (Recommended):** Install `swr` (`npm install swr`) and replace the `useEffect`+`fetch` pattern for standings and tournament data with `useSWR` hooks. Provides automatic revalidation on window focus, deduplication, and configurable TTL.
> If the leaderboard needs real-time updates during active tournaments, set `refreshInterval: 30000` (30 seconds) in SWR config for that specific fetch. For the weekly-updated standings, `revalidateOnFocus: false` and `dedupingInterval: 300000` (5 minutes) is appropriate.

**Task (Option B — SWR):**
1. Install SWR: `npm install swr`.
2. In `frontend/src/pages/Dashboard.jsx`, replace the standings and upcoming tournaments `useEffect` fetch calls with `useSWR` hooks pointing to the same API endpoints via the existing `api.js` fetcher functions.
3. Configure `SWRConfig` in `main.jsx` with a global `dedupingInterval: 60000` (1 minute default dedup).
4. Ensure loading and error states in the component UI remain functional (SWR provides `isLoading` and `error` from each hook).

---

### PROMPT M-7 · Finding N-04 — Add Page-Level h1 Titles to Authenticated Views

**Model:** Gemini Flash Latest  
**Justification:** Repetitive, low-complexity addition across multiple page components with a clear pattern.

**Role:** You are a front-end accessibility specialist implementing WCAG 2.1 AA (Success Criterion 2.4.2 — Page Titled).

**Task:**  
All authenticated page components in `frontend/src/pages/` lack a top-level `<h1>` page title in their main content area. Add a consistent page title to each component listed below.

For each file, add a page header block as the **first element** inside the main content wrapper, using this pattern:
```jsx
<div className="mb-6">
  <h1 className="text-2xl font-bold text-slate-900">[Page Title]</h1>
  <p className="text-slate-500 text-sm mt-1">[Optional subtitle]</p>
</div>
```

Apply to the following pages with these titles:

| File | h1 Title | Subtitle |
|---|---|---|
| `Dashboard.jsx` | `Dashboard` | `Paradise Cup — 2026 Season` |
| `Tournaments.jsx` | `Tournaments` | `Schedule and results` |
| `Users.jsx` | `Players` | `Active league members` |
| `Courses.jsx` | `Courses` | `Registered golf courses` |
| `ScoreEntry.jsx` | `Score Entry` | `Enter tournament scores` |
| `Quota.jsx` | `Quota Management` | `Player quota history` |
| `Inbox.jsx` | `Inbox` | `Incoming league emails` |
| `Settings.jsx` | `Settings` | `League configuration` |
| `BillingEntities.jsx` | `Billing Entities` | *(omit subtitle)* |
| `Rules.jsx` | `League Rules` | *(omit subtitle)* |

Do not change any other content, layout, or logic in these files.

---

### PROMPT M-8 · Finding C-03 — Improve Empty-State Copy Across All Views

**Model:** Gemini Flash Latest  
**Justification:** Copy changes only; no logic modifications.

**Role:** You are a UX copywriter working on a golf league management application.

**Task:**  
Replace terse empty-state messages throughout the application with contextual, action-oriented copy.

Make the following targeted text replacements (search each file for the old string and replace):

| File | Old Text | New Text |
|---|---|---|
| `Dashboard.jsx` (public, unauthenticated state) | `'No upcoming events'` | `'No upcoming events scheduled. Sign in to see the full season calendar.'` |
| `Dashboard.jsx` | `'Failed to load data'` (standings fallback) | `'Standings are available to league members. Sign in to view.'` |
| `Tournaments.jsx` | Any `'Failed to load tournaments'` or empty list state | `'No tournaments found. Use "Add Tournament" to schedule the next event.'` |
| `Users.jsx` | Any empty player list state | `'No players registered yet.'` |
| `Leaderboard.jsx` | Any empty leaderboard state | `'No scores have been entered for this tournament yet.'` |

Additionally, for any component that displays a loading spinner or loading state with no text, add a visually hidden `<span className="sr-only">Loading...</span>` alongside the spinner for screen reader users.

---

## TIER 4 — LOW PRIORITY (Nice to Have / Post-Launch)

---

### PROMPT L-1 · Finding H-13 / C-05 — Expand the About Page

**Model:** Gemini Pro Latest  
**Justification:** Requires content creation, layout implementation, and applying the MainLayout wrapper — multiple concerns.

**Role:** You are a full-stack React developer and UX copywriter building a league information page.

> ⚠️ **DECISION POINT — Content required from the commissioner before execution:**
> 1. League founding year and brief origin story (1-2 sentences).
> 2. Commissioner's name and preferred contact email.
> 3. Whether to include a physical address (currently: 12302 Glenfield Ave, Tampa FL 33626) on this page.
> 4. Any season records or highlights to feature (optional).

**Task:**  
`frontend/src/pages/About.jsx` currently renders bare HTML outside the main layout. Rebuild it as a proper league information page.

1. Import and apply `MainLayout` as the parent wrapper so the page has consistent sidebar navigation (or apply the correct public layout if this page is public-facing).
2. Structure the page with the following sections using the app's card/panel visual language:
   - **League Overview:** NPGOLF name, founding year, location (Tampa FL), brief description ("A competitive 9-hole and 18-hole stroke-play league using Stableford quota scoring").
   - **Commissioner Contact:** Name, email as a `mailto:` link, and note that new members should contact the commissioner to register.
   - **Current Season:** Link to the Dashboard standings.
   - **Rules:** Link to `/rules`.
   - **Legal:** SMS Consent Policy link (`/sms-consent`), and the existing business address.
3. Apply consistent card styling (`bg-white rounded-xl shadow-sm p-6 border border-slate-100`) to each section.

---

### PROMPT L-2 · Finding N-06 — Add Custom 404 Page

**Model:** Gemini Flash Latest  
**Justification:** Simple new page component with a route addition.

**Role:** You are a senior React front-end developer.

**Task:**  
Create a custom 404 page component and wire it into the route tree.

1. Create `frontend/src/pages/NotFound.jsx`:
   - Centered layout (`min-h-screen flex flex-col items-center justify-center bg-slate-50`).
   - Display the NPGOLF logo (`/npgolf-logo.svg`).
   - Large `"404"` in fairway-600 (`text-7xl font-black`).
   - Message: `"Page Not Found"` (h2) + `"The page you're looking for doesn't exist or has been moved."` (p).
   - Two buttons: `"Go to Home"` (navigates to `/`) and `"Sign In"` (navigates to `/login`).
2. In `main.jsx`, replace the current catch-all `<Navigate to="/" />` wildcard with `<Route path="*" element={<NotFound />} />`.

---

### PROMPT L-3 · Finding P-03 — Route-Level Code Splitting

**Model:** Gemini Flash Latest  
**Justification:** Mechanical pattern application; React.lazy wrapping is repetitive and well-defined.

**Role:** You are a senior React front-end developer optimizing application bundle size.

**Task:**  
The application imports all 24 page components eagerly at the top of `main.jsx` (or the router file). Convert all page-level imports to `React.lazy()` dynamic imports for route-level code splitting.

1. In the router file, replace each static import:
```js
// Before:
import { Dashboard } from './pages/Dashboard'
// After:
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
```
2. Wrap the `<Routes>` tree in `<React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Disc3 className="w-8 h-8 animate-spin text-fairway-600" /></div>}>`.
3. Prioritize lazy-loading for admin-only pages first (Quota, Inbox, BillingEntities, Settings, AddCourse, EditCourse, AddTournament, EditTournament) as these are rarely visited by non-admin users.
4. Keep `Login.jsx` and `Register.jsx` as eager imports so the auth flow loads instantly.

---

### PROMPT L-4 · Finding V-04 — Verify Favicon and PWA Web Manifest

**Model:** Gemini Flash Latest  
**Justification:** Asset verification and configuration file creation; straightforward.

**Role:** You are a front-end developer handling web application production readiness.

**Task:**  
Verify and complete the favicon and PWA manifest setup in `frontend/public/`.

1. Check that `frontend/public/` contains:
   - `favicon.ico` (must include 16×16 and 32×32 sizes).
   - `favicon-192.png` and `favicon-512.png` for PWA icons.
   - `manifest.json` (or `site.webmanifest`).
2. If `manifest.json` is missing or incomplete, create it at `frontend/public/manifest.json`:
```json
{
  "name": "NPGOLF — Paradise Cup",
  "short_name": "NPGOLF",
  "description": "Paradise Cup golf league management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/favicon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/favicon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
3. Verify `frontend/index.html` has the correct `<link rel="manifest" href="/manifest.json">` and `<link rel="icon" ...>` tags.
4. If golf-themed icon files are missing, create placeholder 192×512px PNGs from the `/npgolf-logo.svg` using a build script or note this as a design team deliverable.

---

### PROMPT L-5 · Finding A-07 — Fix Heading Hierarchy on Dashboard Stat Cards

**Model:** Gemini Flash Latest  
**Justification:** HTML element tag changes only; no visual or logic impact.

**Role:** You are a front-end accessibility specialist implementing WCAG 2.1 AA (Success Criterion 1.3.1 — Info and Relationships).

**Task:**  
The dashboard stat cards render their value content (e.g., "May 13", "34", "Bill White", "Active") as `<h3>` elements. The heading hierarchy in the document jumps directly from `<h2>` section labels to these `<h3>` value elements, which does not form a logical document outline.

1. In `Dashboard.jsx`, find the JSX for the four stat cards.
2. Change the numeric/value content elements from `<h3>` to `<p>` with `className="text-2xl font-bold text-slate-900"` (or match the existing visual styling using non-heading elements).
3. If the card label (e.g., "NEXT EVENT") is currently an `<h3>`, change it to a `<p>` or `<span>` with `className="text-xs font-semibold uppercase tracking-wide text-slate-500"`.
4. The result should have no `<h3>` elements inside the stat cards — only styled `<p>` elements. The page's `<h1>` and `<h2>` section headings remain as the only semantic heading structure.

---

### PROMPT L-6 · Finding N-05 — Admin Section Divider in Sidebar

**Model:** Gemini Flash Latest  
**Justification:** Single-component UI addition; no logic changes.

**Role:** You are a front-end developer improving navigation scannability.

**Task:**  
In `frontend/src/components/MainLayout.jsx`, admin-only menu items (Quota, Inbox, Billing Entities, Settings) are appended to the navigation list without any visual separator. Add a labeled section divider.

1. In the sidebar `<nav>` section, between the last regular menu item and the first admin-only menu item, add the following JSX (render only if `user?.role === 'admin'`):
```jsx
{user?.role === 'admin' && (
  <li className="pt-3 pb-1">
    {sidebarOpen ? (
      <p className="px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Admin
      </p>
    ) : (
      <hr className="border-slate-700 mx-2" />
    )}
  </li>
)}
```
2. This shows the "Admin" label when expanded and a simple horizontal rule when collapsed.
3. Do not change the menu item logic, icon, or routing.

---

### PROMPT L-7 · Finding C-06 — Update SMS Consent Page Last-Updated Date

**Model:** Gemini Flash Latest  
**Justification:** Single-line text change.

**Role:** You are a front-end developer maintaining a legal compliance page.

**Task:**  
In `frontend/src/pages/SMSConsent.jsx`, the page displays `"Last Updated: December 2024"`. Update this to `"Last Updated: May 2026"`.

Additionally, add a comment in the component file:
```jsx
{/* TODO: Review and update this date whenever SMS consent language changes. Annual review recommended. */}
```
Place the comment directly above the "Last Updated" paragraph element.

---

### PROMPT L-8 · Finding H-04 — Update Phone Placeholder to Tampa-Area Example

**Model:** Gemini Flash Latest  
**Justification:** Trivial single-attribute change.

**Role:** You are a front-end developer.

**Task:**  
In `frontend/src/pages/Register.jsx`, the phone input field has `placeholder="+12025551234"` (a Washington DC area code) and helper text `"Include country code (e.g., +1 for US)"`.

1. Change `placeholder` to `"+18135550100"` (Tampa area code 813).
2. Change the helper text paragraph to: `"Include country code — e.g., +1 for US (+18135550100)"`.

---

### PROMPT L-9 · Findings A-01 / V-05 / P-04 — Logo Alt Text, SVG Context, and CLS Prevention

**Model:** Gemini Flash Latest  
**Justification:** Multiple small attribute fixes in a small number of files; efficient to batch.

**Role:** You are a front-end accessibility specialist and performance engineer.

**Task:**  
Three related logo issues across the codebase:

**A-01 — Alt text:**
Search all files in `frontend/src/` for `<img src="/npgolf-logo.svg"`. For each instance:
- If the `<img>` is wrapped in a `<Link>` or `<a>` tag (navigates home): change `alt` to `"NPGOLF — Go to home"`.
- If the `<img>` is purely decorative (not a link): change `alt` to `""` (empty string, which tells screen readers to skip it).

**V-05 / P-04 — Width, height, and CLS:**
On every `<img src="/npgolf-logo.svg">` instance, add explicit `width` and `height` attributes matching the actual rendered dimensions (inspect the `className` to determine: `h-8` = 32px, `h-16` = 64px). Add the matching numeric `width` attribute maintaining aspect ratio (the NPGOLF logo aspect ratio should be determined from the SVG viewBox). Setting these prevents Cumulative Layout Shift.

Example:
```jsx
// h-8 instance:
<img src="/npgolf-logo.svg" alt="NPGOLF — Go to home" height="32" width="120" className="h-8 w-auto" />
```

---

### PROMPT L-10 · Findings H-02 / P-01 — Loading States and Suppress Unauthenticated API Noise

**Model:** Gemini Pro Latest  
**Justification:** Requires understanding the auth context, component lifecycle, and the distinction between intentionally gated content and genuine loading states.

**Role:** You are a senior React front-end developer specializing in async data patterns and UX loading states.

**Task — Part 1 (H-02, loading indicators):**  
In `Dashboard.jsx`, `Tournaments.jsx`, `Users.jsx`, and `ScoreEntry.jsx`, each component has a `loading` boolean state but some views show a blank area with no feedback during the fetch.

For any component where `loading === true` but no visual indicator is shown, add a skeleton loader. Use this pattern for card-based content:
```jsx
{loading && (
  <div className="animate-pulse space-y-3">
    {[1,2,3].map(i => (
      <div key={i} className="h-12 bg-slate-200 rounded-lg" />
    ))}
  </div>
)}
```
For table-based content, replace with a 3-row skeleton table matching the table's column count.

**Task — Part 2 (P-01, suppress unauthenticated API noise):**  
In `Dashboard.jsx`, identify any `useEffect` that fires API calls regardless of authentication state. Import `AuthContext` and read the `user` value. Wrap API calls in a guard:
```js
if (!user) {
  // Don't fire authenticated API calls; set gated state instead
  setIsGated(true);
  setLoading(false);
  return;
}
```
This prevents 401 errors from flooding the server log when the public dashboard is viewed by unauthenticated visitors.

---

## Quick-Reference Summary Table

| Prompt | Finding(s) | Severity | Model | Decision Point? |
|---|---|---|---|---|
| C-1 | N-01 | Critical | Flash | No |
| C-2 | H-05 | Critical | Pro | **Yes** — implement or remove |
| C-3 | H-06, V-01 | Critical | Pro | No |
| C-4 | M-01 | Critical | Pro | No |
| C-5 | H-01, N-02 | Critical | Pro | **Yes** — route classification |
| C-6 | A-02 | Critical | Flash | No |
| C-7 | A-03 | Critical | Flash | No |
| C-8 | I-01, H-08 | Critical | Pro | No |
| H-2 | A-04, H-10 | High | Flash | No |
| H-3 | A-06 | High | Flash | No |
| H-4 | M-02 | High | Flash | No |
| H-6 | C-02 | High | Flash | No |
| H-7 | N-02, N-03 | High | Pro | **Yes** — route classification |
| M-2 | H-09 | Medium | Flash | No |
| M-3 | M-03 | Medium | Flash | No |
| M-4 | V-03 | Medium | Flash | No |
| M-5 | I-02 | Medium | Pro | No |
| M-6 | P-02 | Medium | Pro | **Yes** — SWR vs manual cache |
| M-7 | N-04 | Medium | Flash | No |
| M-8 | C-03 | Medium | Flash | No |
| L-1 | H-13, C-05 | Low | Pro | **Yes** — content from commissioner |
| L-2 | N-06 | Low | Flash | No |
| L-3 | P-03 | Low | Flash | No |
| L-4 | V-04 | Low | Flash | No |
| L-5 | A-07 | Low | Flash | No |
| L-6 | N-05 | Low | Flash | No |
| L-7 | C-06 | Low | Flash | No |
| L-8 | H-04 | Low | Flash | No |
| L-9 | A-01, V-05, P-04 | Low | Flash | No |
| L-10 | H-02, P-01 | Medium | Pro | No |

---

*NPGOLF AI Remediation Prompts — Generated May 7, 2026*  
*Total prompts: 28 · Decision Points: 6 · Gemini Pro: 10 · Gemini Flash: 18*
