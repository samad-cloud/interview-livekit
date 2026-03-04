# Printerpix Recruitment Platform — UI Reference

Complete screen-by-screen documentation of every view, component, and UI state for mockup generation.

---

## Overview

The platform has two distinct sides:

- **Admin Side** — HR tools protected behind login: Dashboard, Jobs, CV Screener, Job Generator, Prompts Manager
- **Candidate Side** — Public interview pages: Round 1 voice interview, Round 2 technical interview

**Design System**: Dark mode, shadcn/ui (New York style), Tailwind CSS. Accent colour is emerald-green for primary actions, cyan for AI/interview interactions, red for rejections/errors.

---

## ADMIN SIDE

---

### 1. Login Page (`/login`)

**Purpose**: Email/password authentication gate for HR staff.

**Layout**: Full-screen dark background with a subtle radial gradient. Single centered card, vertically and horizontally centered.

**Card Contents** (top to bottom):
1. **Printerpix Logo** — 64×64px circular logo with a soft ring border, centered above the card
2. **Heading** — "Recruiter Login" in large bold white text, centered
3. **Email Field** — Full-width input, label "Email", placeholder "you@printerpix.com", h-11
4. **Password Field** — Full-width input, label "Password", type password, h-11
5. **Sign In Button** — Full-width, emerald-600 background, white text, "Sign In"
   - Loading state: spinner icon + "Signing in..." text, button disabled
6. **Error Alert** — Red-tinted box below the button, shows error text (e.g. "Invalid credentials")
7. **Security Badge** — Small gray text at the bottom: lock icon + "Secured by Supabase Auth"

---

### 2. Dashboard (`/dashboard`)

**Purpose**: Main HR hub. View all candidates, filter/search, manage interview pipeline, review scores, send invites, watch recordings.

**Layout**: Full-screen dark layout with a top navigation bar and a content area below.

---

#### 2a. Top Navigation Bar

Fixed bar across the top, dark background, slight border-bottom.

**Left side**:
- Printerpix logo (small, ~32px)
- "Printerpix Recruitment" text in white, semi-bold

**Right side**:
- Logged-in user email in muted gray text
- "Create Job" text link → navigates to `/gen-job`
- "Logout" button — ghost style, red text on hover

---

#### 2b. Quick Stats Row

Four stat cards displayed in a horizontal row below the nav bar.

Each card:
- Dark card background with border
- Large number in white (the metric)
- Label below in muted gray

| Card | Metric | Label |
|------|--------|-------|
| 1 | Count | Active Interviews |
| 2 | Count | Pending Invites |
| 3 | Count | Scheduled Today |
| 4 | Percentage % | Acceptance Rate |

---

#### 2c. Candidate Table Section

**Above the table — Controls row** (horizontal, space-between):
- **Search bar** (left): text input with search icon, placeholder "Search by name or email…", real-time filter
- **Filter dropdowns** (right): "Status" dropdown, "Job" dropdown, "Rating" dropdown — all multi-select or single-select
- **Sort**: clicking column headers toggles ascending/descending, with a small up/down arrow icon

**Table** — full width, dark rows with hover highlight:

| Column | Content |
|--------|---------|
| Candidate | Avatar circle (initials) + full name in white + email in muted gray below |
| Job Applied | Job title text |
| R1 Score | Numeric score (e.g. "72") or "—" if not yet interviewed |
| R2 Score | Numeric score or "—" |
| CV Match | Percentage badge (e.g. "84%") |
| Status | Colored badge (see Status Badges below) |
| Date | "Mar 3" style relative date |
| Actions | Three-dot menu icon, opens dropdown |

**Status Badges** (pill-shaped):
- `NEW_APPLICATION` — blue/slate
- `GRADED` — yellow
- `CV_REJECTED` — red/muted
- `INVITE_SENT` — purple
- `INTERVIEW_STARTED` — amber
- `INTERVIEWED` — teal
- `ROUND_2_APPROVED` — cyan
- `ROUND_2_INVITE_SENT` — indigo
- `ROUND_2_STARTED` — blue
- `COMPLETED` — emerald green
- `REJECTED_VISA` — red

**Actions Dropdown** (three-dot menu per row):
- View Profile
- Send Interview Invite
- Copy Interview Link
- Invite to Round 2
- View Recording
- Download Resume
- Delete Candidate

**Pagination** (below table):
- "Showing 1–20 of 143 candidates" text (muted)
- Previous / Next buttons
- Page number indicator

---

#### 2d. Candidate Detail Panel (Slide-in sidebar or Modal)

Triggered by clicking a row or "View Profile" from the actions menu. Opens as a large right-side drawer or centered modal overlay.

**Header**:
- Candidate full name (large, bold)
- Job title applied for (muted, below name)
- Status badge
- Close (✕) button top-right

**Tabs** across the top of the panel:
1. **Overview** — scores, CV summary, AI verdict
2. **Transcript** — Round 1 and Round 2 interview transcripts
3. **Recording** — embedded video player
4. **Resume** — resume text preview

---

**Overview Tab**:
- **Score Cards** row (similar to stats row):
  - CV Match Score (%)
  - Round 1 Score (/100)
  - Round 2 Score (/100)
- **Verdict Badge** — "Advanced" (emerald) or "Rejected" (red) or "—" if not final
- **AI Summary** — paragraph of AI-generated interview summary text
- **Top Strength** — short tag or line (e.g. "Strong ownership mindset")
- **Top Weakness** — short line (e.g. "Vague on technical depth")
- **HR Notes** — editable textarea for recruiter notes, with "Save Notes" button

**Action Buttons** (bottom of panel):
- "Send Interview Invite" — emerald button (only if not yet invited)
- "Copy Interview Link" — ghost button with clipboard icon
- "Invite to Round 2" — cyan button (only if Round 1 completed with passing score)
- "Download Resume" — ghost button with download icon

---

**Transcript Tab**:
- Toggle: "Round 1" | "Round 2"
- Scrollable transcript text in monospace-style with speaker labels:
  - `(Wayne):` or `(Atlas):` — interviewer lines, muted color
  - `(Candidate):` — candidate lines, white text
- Timestamps shown per exchange if available

---

**Recording Tab**:
- Video player (full width of panel)
- Playback controls: play/pause, scrubber/timeline, volume, fullscreen
- Playback speed selector: 0.75×, 1×, 1.25×, 1.5×, 2×
- Download button (top-right of video)
- If no recording: placeholder with camera-off icon + "No recording available"

---

**Resume Tab**:
- Raw resume text in a scrollable container
- Monospace or readable font
- "Download PDF" button at top-right (if resume file exists)

---

### 3. Jobs Page (`/jobs`)

**Purpose**: View and manage all job postings. Toggle active/inactive, edit details.

**Layout**: Same nav bar as dashboard. Content area with header + grid/list of job cards.

---

#### 3a. Header Row

- "Manage Jobs" heading (large, bold)
- Subtext: "X jobs total • Y active" (muted gray)
- "Create Job" button → links to `/gen-job` (emerald, top-right)

---

#### 3b. Controls Row

- **Search bar** — filter jobs by title or department
- **Filter dropdown** — "All Jobs" / "Active Only" / "Inactive Only"

---

#### 3c. Job Cards Grid

Cards displayed in a 2–3 column responsive grid.

**Each Job Card** (dark card, border, rounded):

**Card Header**:
- Job title (large, bold, white)
- Active/Inactive badge (emerald for active, muted for inactive)
- Toggle switch (right-aligned) — clicking toggles job status instantly

**Card Body** — metadata grid of icon+text pairs:
- Location icon + location text (e.g. "Dubai, UAE")
- Work arrangement badge (e.g. "On-site", "Hybrid", "Remote")
- Department tag (e.g. "Engineering")
- Urgency tag (e.g. "ASAP", "30 Days")
- Candidate count (person icon + "14 applicants")
- Salary range (e.g. "£40,000 – £60,000 / year")
- Visa sponsorship badge (green "Visa Sponsored" or gray "No Sponsorship")
- Education requirement (e.g. "Bachelor's Required")
- Experience range (e.g. "2–5 years")
- Created date (e.g. "Created Mar 1, 2026")

**Skills Section** (below metadata):
- "Must-Have Skills" — pill tags in green outline
- "Nice-to-Have Skills" — pill tags in default style

**Card Footer**:
- "Edit" button (ghost, opens edit modal)

---

#### 3d. Edit Job Modal

Large modal overlay with a tab bar at the top.

**Tab 1 — Details**:
- Job Title (text input)
- Department (select)
- Location (text input or select)
- Work Arrangement (select: On-site / Hybrid / Remote)
- Urgency (select: ASAP / Within 30 Days / etc.)

**Tab 2 — Compensation**:
- Currency (select: GBP, USD, AED, etc.)
- Period (select: per year / per month)
- Salary Min (number input)
- Salary Max (number input)
- Visa Sponsorship (toggle switch)

**Tab 3 — Requirements**:
- Education Level (select)
- Experience Min (number input, years)
- Experience Max (number input, years)
- Must-Have Skills (tag input — type + press Enter to add)
- Nice-to-Have Skills (tag input)

**Tab 4 — Description**:
- Full Job Description (large textarea, markdown-friendly)
- Project Context (textarea — "What will they work on?")
- Ideal Candidate (textarea — "Who are we looking for?")
- Red Flags (textarea — "What should disqualify someone?")

**Modal Footer**:
- "Cancel" (ghost button, closes modal)
- "Save Changes" (emerald button, submits form)

---

### 4. Job Generator (`/gen-job`)

**Purpose**: AI-powered form to generate a structured job description.

**Layout**: Single-column form, same nav bar, scrollable page.

---

#### 4a. Form Section (Left or top half)

Inputs in a two-column grid where applicable:

| Field | Type |
|-------|------|
| Company | Dropdown with search |
| Position Title | Text input |
| Location | Select (Dubai, London, etc.) |
| Department | Select |
| Work Arrangement | Select (On-site / Hybrid / Remote) |
| Urgency | Select |
| Salary Min | Number input |
| Salary Max | Number input |
| Currency | Select |
| Education Requirement | Select |
| Min Experience | Number input (years) |
| Max Experience | Number input (years) |
| Nice-to-Have Skills | Tag input (add/remove tags) |
| Existing Responsibilities | Large textarea |
| Desired Outcomes | Large textarea |

---

#### 4b. Generation Section

- "Generate Job Description" button (large, emerald, full-width or right-aligned)
- **Loading state**: spinner + "Generating…" text, button disabled
- **Generated Output**: Formatted markdown text in a scrollable read-only card with a white border
- "Refine" button — opens a refinement prompt textarea below the output
- Refinement textarea — "Tell the AI what to improve…" placeholder
- "Re-generate" button after refinement input
- "Generate Skills" button — auto-extracts must-have and nice-to-have skills from the description
- Skills output display — two columns of tag badges

---

#### 4c. Save Section

- "Save Job" button (emerald, bottom of page)
- Success toast: "Job saved successfully"
- Error alert: shown inline below button

---

### 5. CV Screener (`/screener`)

**Purpose**: Bulk AI resume screening against a selected job. Upload CSV (from BetterTeam) or PDF resumes, run AI screening, view ranked results.

**Layout**: Multi-step wizard with persistent header, step indicator at top.

---

#### 5a. Step 1 — Setup

- "Bulk CV Screener" heading
- Job selector dropdown (select which job to screen against)
- Upload Mode toggle — two buttons: "CSV (BetterTeam)" | "PDF Resumes"
- "Next" button (emerald, disabled until job selected)

---

#### 5b. Step 2 — File Upload

- Back button (←)
- Dashed-border drag-and-drop zone:
  - Upload cloud icon (large, centered)
  - "Drag & drop your file here" heading
  - "or click to browse" subtext
  - Accepted formats: ".csv" or ".pdf" depending on mode
  - Active (drag-over) state: border turns cyan, background lightens
- On file selected: filename badge + green checkmark
- "Continue" button (emerald, enabled once file is loaded)

---

#### 5c. Step 3 — CSV Filters (CSV mode only)

- Filename + match count displayed at top ("Found 247 candidates")
- **Filter Groups** (each as a labeled section):
  - **Status**: Multi-select colored tag buttons (yellow = selected by default)
  - **Source**: Multi-select colored tag buttons (blue)
  - **Campaign**: Scrollable multi-select tags (purple)
  - **Date Range**: "From" date input + "To" date input
  - **Has Resume URL**: Toggle switch (only include candidates with resume links)
  - **Skip Duplicates**: Toggle switch + "(X duplicates found)" subtext in muted gray
- **Preview Table** (below filters):
  - Heading: "Preview — first 50 candidates"
  - Columns: #, Name, Email, Source, Date Applied, Resume (✓ or ✗)
- Candidate count badge: "X candidates will be screened" (updates as filters change)
- "Start Screening" button (emerald, large)

---

#### 5d. Step 4 — Live Leaderboard (Results)

- "Screening in Progress…" heading (replaces with "Screening Complete" when done)
- Progress indicator: "Screened X of Y candidates"
- Sorted table (real-time updates, auto-sorted by score descending):

| Column | Content |
|--------|---------|
| Rank | # position |
| Name | Full name |
| Email | Email address |
| Score | Number (/100) + horizontal progress bar color-coded (green >70, yellow 50–70, red <50) |
| Status | Badge: "Interview" (green), "Rejected" (red), "Duplicate" (gray) |
| Reasoning | Short AI reasoning text (1–2 sentences) |

- **Loading state per row**: Spinner + "..." in score/status columns while that candidate is being processed
- "Export CSV" button (top-right, ghost, after completion)

---

### 6. Prompts Manager (`/prompts`)

**Purpose**: Edit AI scoring prompts and email templates that are stored in the database. Changes take effect immediately without a code deploy.

**Layout**: Same nav bar. Single-column scrollable list of prompt cards.

---

#### 6a. Header

- Back button (←) — returns to dashboard
- Settings icon + "AI Prompts & Templates" heading
- Subtext: "Changes take effect immediately — no deployment required"

---

#### 6b. Info Box

- Blue-tinted info card
- Icon: Info (ℹ)
- Text explaining available template variables: `{candidate_name}`, `{job_title}`, `{transcript}`, etc.

---

#### 6c. Warning Box

- Amber/yellow-tinted warning card
- Icon: AlertTriangle (⚠)
- Text: "Do not modify or remove variable placeholders — they are required for the AI to work correctly"

---

#### 6d. Prompt Cards

One card per prompt (e.g. "Round 1 Scoring", "Round 2 Scoring", "Interview Invite Email"):

**Each Card**:
- **Card Header**:
  - Prompt name (bold, e.g. "round_1_scoring")
  - Description in muted gray (e.g. "Used to score Round 1 personality interviews")
  - "Last updated: Mar 3, 2026" in small muted text
- **Prompt Textarea**:
  - Full-width, tall textarea (monospace font)
  - Contains the system prompt with variable placeholders
  - Resizable vertically
- **Card Footer**:
  - "Save" button (emerald, right-aligned)
  - Loading state: spinner + "Saving…"
  - Success: green checkmark + "Saved!" text (fades after 3s)
  - Error: red text with error message

---

## CANDIDATE SIDE

---

### 7. Round 1 Interview (`/interview/[token]`)

**Purpose**: Candidate-facing voice interview page. Wayne (AI interviewer) conducts a 15-minute personality and drive assessment.

**Layout**: Full-screen dark background. No navigation bar — isolated experience.

---

#### 7a. Mobile Block Screen

Shown if the user is on a mobile device.

- Centered content, vertically centered on page
- Large Monitor icon (blue-400)
- "Desktop Required" heading (white, large)
- Paragraph: "This interview requires a camera and microphone on a desktop or laptop computer. Please open this link on your desktop or laptop to continue."
- Printerpix logo at the bottom (small, muted)

---

#### 7b. Loading Screen

Shown while the page fetches candidate data.

- Centered spinner (cyan-500, medium size)
- "Loading your interview…" text below (muted gray)
- If multiple load attempts: subtext "This is taking longer than expected. Please wait…"

---

#### 7c. Error Screen

Shown if the token is invalid or expired.

- Centered card
- AlertCircle icon (red, large)
- "Interview Not Found" heading
- Error message text
- "Return to Printerpix" link → printerpix.com

---

#### 7d. Already Completed Screen

Shown if the candidate has already completed this interview.

- Centered card
- CheckCircle icon (emerald-green, large)
- "Interview Already Completed" heading
- "You've already completed this interview. Thank you for your time — we'll be in touch soon."
- Printerpix logo at bottom

---

#### 7e. Idle / Start Screen (Pre-interview)

The main start screen before the interview begins.

**Layout**: Full dark background, centered column layout.

**Top section**:
- Printerpix logo (centered, ~48px)
- "Welcome, [First Name]" heading (white, large)
- Subtitle: "to your interview for the [Job Title] role at Printerpix"

**Instructions Card** (centered, ~600px wide, dark card with border):
- "Before You Begin" heading
- Duration notice: "This is a 15-minute guided voice interview"
- Bulleted checklist (with checkmark icons):
  1. "Ensure you have a strong, stable internet connection"
  2. "Speak clearly and project your voice"
  3. "Be detailed and authentic in your answers"
  4. "Click the 'Done Speaking' button after each response"

**Camera & Mic Check Section** (appears after "Check Camera & Mic" is clicked):
- **Camera Preview**:
  - 256×192px video element, rounded corners, border
  - Live feed from candidate's webcam
  - Error state: gray box with CameraOff icon + "Camera is required to proceed"
- **Microphone Level**:
  - Mic icon on the left
  - Animated progress bar (shows live audio level)
  - Text feedback:
    - "Too quiet — speak up" (yellow-400) if level < 10%
    - "Good!" (green) if level 10–50%
    - "Great!" (green) if level > 50%
  - Error state: AlertCircle icon + "Microphone access required"

**Buttons** (centered, stacked):
1. "Check Camera & Mic" — cyan-to-blue gradient, rounded-full, bold text, scale-up on hover
2. "Start Interview" — emerald-500, rounded-full — disabled (grayed out) if camera or mic has errors; enabled once both are confirmed

---

#### 7f. Connecting Screen

Shown briefly while the Deepgram and Gemini connections are established.

- Centered on screen
- Cyan-500 spinner (large, animated)
- "Connecting…" heading (white)
- "Preparing your interview" subheading (muted gray)

---

#### 7g. Active Interview Screen (Main UI)

The core interview experience. No scrolling — everything is fixed/relative to viewport.

---

**Fixed: Exit Button** (top-left corner):
- Circular button (dark bg, border)
- X icon (muted color, turns white on hover)
- Hover reveals tooltip label: "Exit Interview"

---

**Fixed: Interview Timer** (top-right corner):
- Pill-shaped card
- Clock icon + MM:SS time display in monospace font
- **Normal state**: Muted card background, white text
- **Urgent state** (last 2 minutes): Red-tinted background, red-400 text, slow pulsing animation

---

**Exit Confirmation Modal** (appears when X is clicked):
- Dark overlay backdrop
- Centered modal card
- "Exit Interview?" heading (bold)
- Warning text: "Are you sure you want to exit without completing? Your progress will be lost."
- Two buttons side-by-side:
  - "Continue Interview" — muted/ghost style
  - "Exit" — red background, white text

---

**Main Content Area** (centered, fills screen):

**AI Avatar** (centered):
- Large circle, ~192×192px (w-48 h-48)
- **Idle**: Muted dark gradient background, Volume2 icon in muted-foreground color
- **AI Speaking**: Cyan-to-blue gradient background, white Volume2 icon, two concentric pulsing ring animations (cyan-500/20 and cyan-500/30, different pulse speeds)
- Below circle: Interviewer name ("Serena" for Round 1, "Nova" for Round 2) in bold white, large
- Below name: Interviewer title ("Talent Scout" for Round 1, "Technical Interviewer" for Round 2) in muted gray

---

**Subtitle / Transcript Area** (fixed to bottom, above controls):
- Semi-transparent dark card, rounded corners
- Width: ~60% of screen, centered
- Min-height: 96px, Max-height: 192px (scrollable if overflow)
- Content varies by state:
  - **AI speaking**: AI's current sentence in white, normal weight, centered
  - **Candidate speaking**: Candidate's real-time transcript in cyan-400, italic, quoted
  - **Waiting for candidate**: "Please begin speaking…" in muted-foreground
  - **Silence**: Empty

---

**Candidate Camera Preview** (fixed, bottom-right, above control bar):
- 144×112px video element (w-36 h-28)
- Rounded corners, border, drop shadow
- Shows candidate's own webcam feed (mirrored)
- Positioned above the control bar, right-aligned

---

**Control Bar** (fixed, bottom, full width):
- Height: ~96px
- Dark background, top border
- Centered content:
  - **"Done Speaking" Button**:
    - Only visible when the AI is NOT currently speaking
    - Enabled only when there is transcript text (candidate has said something)
    - Emerald-500 background, white bold text
    - Glow shadow effect (emerald-500/25)
    - Rounded-full, medium padding
    - **Silence Nudge Tooltip** (appears after 5s of candidate silence):
      - Green tooltip bubble above the button
      - Downward caret/arrow pointing to button
      - Text: "All finished? Click here to continue."
      - Fade-in animation

---

**Error Toast** (fixed, top-right):
- Red background, white text
- Error message content
- ✕ dismiss button (right-aligned)

---

#### 7h. Analyzing / Submission Screen

Shown after the interview ends while uploading and processing.

- Full-screen, centered column
- Large cyan-500 spinner
- "Submitting Your Interview" heading (white, large)
- "We're wrapping things up and submitting your responses…" subtext (muted gray)
- **Upload Progress Bar**:
  - Full-width progress bar (emerald fill, dark track)
  - Percentage shown numerically above bar (e.g. "67%")
  - "Uploading recording…" label below bar
  - Smooth animated fill as chunks upload

---

#### 7i. Completion Screen

Shown when the interview has been fully submitted.

- Centered card with border (~480px wide)
- **Icon circle**: Green gradient (emerald), large checkmark icon inside, ~80px circle
- "Interview Complete!" heading (white, bold, large)
- "Thank you for your time, [First Name]." paragraph
- "Your responses have been recorded and sent to our team. We'll be in touch soon!" paragraph (muted gray)
- Printerpix logo (small, at bottom of card)
- Support note: "Questions? Contact us at [email]" (small muted link)

---

### 8. Round 2 Interview (`/round2/[token]`)

**Purpose**: Technical interview with Atlas (AI interviewer). 40-minute session using probe questions generated from Round 1 performance.

**Differences from Round 1**:
- Interviewer name: **Atlas** (not Serena / Wayne)
- Interviewer title: **"Technical Interviewer"** (not "Talent Scout")
- Duration notice: **40 minutes** (not 15)
- Avatar label: "Nova" shown in UI (not "Serena")
- Has an extra access-denied screen:

---

#### 8a. Access Denied Screen

Shown if the candidate's status doesn't allow Round 2 access (e.g. Round 1 not complete, or not approved).

- Centered card
- Lock icon (muted color, large)
- "Round 2 Not Available" heading
- Message: "Round 2 access is by invitation only. If you believe this is an error, please contact us."
- Return link → printerpix.com

All other screens (idle, connecting, active, analyzing, complete) are identical to Round 1 with the names/duration changed.

---

## COMPONENT LIBRARY REFERENCE

---

### VoiceAvatar Component — State Machine

| State | Trigger | Visual |
|-------|---------|--------|
| `idle` | Page load | Welcome screen with instructions and media check |
| `connecting` | "Start Interview" clicked | Full-screen spinner |
| `active` | Deepgram + Gemini connected | Interview UI (avatar, subtitle, timer, controls) |
| `analyzing` | Final "Done Speaking" → AI wraps up → interview ends | Submission screen with progress bar |
| `ended` | Upload complete | Completion card |

### Avatar Pulse Animation

| AI State | Avatar Background | Icon Color | Rings |
|----------|-------------------|------------|-------|
| Idle / listening | Dark muted gradient | Muted gray | None |
| Speaking | Cyan-400 → Blue-600 gradient | White | Two concentric pulsing cyan rings |

### Timer Urgency States

| Time Remaining | Background | Text Color | Animation |
|----------------|------------|------------|-----------|
| > 2 minutes | Muted card | White | None |
| ≤ 2 minutes | Red-500/20 | Red-400 | Slow pulse |

---

## LAYOUT PATTERNS

### Admin Pages — Standard Shell

```
┌─────────────────────────────────────────────────┐
│  Logo  │  Printerpix Recruitment    [email] Logout│  ← Nav bar (fixed)
├─────────────────────────────────────────────────┤
│                                                 │
│              Page Content Area                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Candidate Pages — Immersive Shell

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           Full-screen dark background           │
│           (no nav, no distractions)             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Active Interview Layout

```
┌─────────────────────────────────────────────────┐
│ [✕ Exit]                           [⏱ 12:34]  │  ← Fixed top layer
│                                                 │
│                                                 │
│              ┌──────────┐                       │
│              │  Avatar  │                       │  ← Center area
│              │  Circle  │                       │
│              └──────────┘                       │
│               Serena / Nova                     │
│               Talent Scout                      │
│                                                 │
│         ┌──────────────────────┐   ┌────────┐  │
│         │   Subtitle / STT    │   │  Cam   │  │  ← Bottom layer
│         └──────────────────────┘   └────────┘  │
│                                                 │
│              [ Done Speaking ]                  │  ← Control bar
└─────────────────────────────────────────────────┘
```

---

## COLOUR REFERENCE

| Purpose | Token | Use |
|---------|-------|-----|
| Primary Action | emerald-500 / emerald-600 | Buttons, success states, "Advanced" badges |
| AI / Interview | cyan-400 / cyan-500 | Avatar, candidate transcript, connecting states |
| Danger / Rejection | red-500 / red-400 | Rejected badges, error states, exit button |
| Warning | amber-500 | Warning boxes, "too quiet" mic feedback |
| Neutral | muted-foreground | Labels, helper text, disabled states |
| Background | dark (hsl card) | All cards and surfaces |
| Accent rings | cyan-500/20, cyan-500/30 | Avatar pulse rings during AI speech |
