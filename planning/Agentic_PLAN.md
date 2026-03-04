# System Architecture: The "Recruiter Brain"

The system is divided into three autonomous loops. Unlike a linear pipeline, these loops talk to each other.

1. **The Research Loop**: Defines what "Good" looks like.
2. **The Acquisition Loop**: Hunts for talent (Inbound + Outbound) and optimizes based on Resume Quality.
3. **The Interview Loop**: Validates talent using deep, forensic questioning and optimizes based on Interview Performance.

---

## System Overview

### Phases & Agents

| Phase | Name | Agents | Purpose |
|-------|------|--------|---------|
| **Phase 0** | Human Input Interface | — | HR fills kickoff form (only human input required) |
| **Phase 1** | Research & Strategy | Agent 1, Agent 2 | Research role, draft JD |
| **Phase 2** | Headhunter Engine | Agent 3, Agent 4 | Outbound sourcing, pipeline optimization |
| **Phase 3** | Forensic Screener | Agent 5 | Resume analysis, BS detection |
| **Phase 4** | Pre-Screening Gatekeeper | Agent 6 | Visa/logistics filtering before interview |
| **Phase 5** | The Interview | Agent 7, Agent 8, Agent 9, Agent 10 | Research-driven AI interviews |
| **Phase 6** | Human Handoff | — | Deliver finalist dossiers to hiring manager |

### Agent Directory

| Agent | Name | Role |
|-------|------|------|
| **Agent 1** | Domain Architect | Research market, trends, salary, target companies |
| **Agent 2** | Copywriter & SEO | Draft and publish job description |
| **Agent 3** | Outbound Hunter | Search databases, send personalized outreach |
| **Agent 4** | Acquisition Manager | Optimize pipeline based on conversion rates |
| **Agent 5** | Forensic Analyst | Parse resumes, detect red flags, score candidates |
| **Agent 6** | Gatekeeper | Pre-screen for visa, availability, logistics |
| **Agent 7** | Interview Architect | Generate personalized interview questions |
| **Agent 8** | Question Optimizer | Learn which questions predict successful hires |
| **Agent 9** | Voice Interrogator | Conduct AI voice interview |
| **Agent 10** | Adjudicator | Score interview, update learning loops |

---

## Phase 0: Human Input Interface (The "Kickoff" Form)

> The only human touchpoint. Everything after this is autonomous.

This is the single form HR fills out to launch the entire recruiting machine. Designed for minimal effort, maximum context.

**Post-Launch Editing:** The `Job_Input_Document` remains **editable after launch**. If requirements change (e.g., visa policy shifts, urgency changes, salary budget updates), HR can update them from the dashboard at any time. When requirements change:
- The system re-evaluates candidates in `REJECTED_PRESCREENING` status against new criteria
- HR is notified: "X previously rejected candidates now qualify under updated requirements. Review?"
- All downstream agents (screening, interview, scoring) pick up the new requirements automatically

---

### Step 1: Required Inputs (The Essentials)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| **Job Title** | Text | "AI Engineer (Entry Level)" | Core search term for research |
| **Location** | Dropdown + Multi-select | Dubai | Determines salary data, visa logic |
| **Company** | Auto-filled / Editable | "Printerpix" | For JD branding, competitor analysis |
| **Department** | Text | "Growth & AI Team" | Context for team fit |
| **Hiring Urgency** | Select | 🟡 30 days | Controls outbound aggressiveness |

---

### Step 2: System-Generated Suggestions (Human Reviews)

> After Step 1 is submitted, the system researches for ~60 seconds and returns suggestions.

#### 💰 Salary Range (Market-Calibrated)

The system scrapes current market data and suggests:

```
┌─────────────────────────────────────────────────────┐
│  Suggested Salary Range (Dubai, Entry-Level 2026)  │
│                                                     │
│  Low:     AED 4,000/month   (Fresh graduate)       │
│  Market:  AED 6,500/month   (Graduate + projects)  │
│  High:    AED 10,000/month  (Internship exp)       │
│                                                     │
│  [ ] Use Low Rate                                  │
│  [ ] Use Market Rate                               │
│  [x] Custom: AED 5,000 - 10,000/month             │
└─────────────────────────────────────────────────────┘
```

**Why this matters:** For entry-level, the range signals "we pay for proven potential." The system notes: *"Offering up to 10K attracts candidates with internship experience who might otherwise go to big tech."*

#### 🎯 Suggested Must-Have Skills (Editable)

Based on 2026 trends for "AI Engineer (Entry Level)":

```
Auto-detected (toggle on/off):
[x] Python
[x] JavaScript / TypeScript
[x] SQL / Databases (PostgreSQL, Supabase)
[x] API Integration (REST, working with AI APIs)
[ ] React / Next.js (nice-to-have)
[ ] Docker (nice-to-have for entry level)

+ Add custom skill: [Claude Code / Cursor IDE]
+ Add custom skill: [LLM Prompt Engineering]
```

#### 🏢 Target Companies (Internship Experience From)

```
Suggested hunting grounds (look for internships/projects at):
[x] Careem (exposed to scale, fast-paced)
[x] Talabat (delivery tech, data pipelines)
[x] Kitopi / Checkout.com (startup mentality)
[x] Any YC / Techstars startup (scrappy builders)
[ ] Big Tech internships (Google, Meta, Amazon)

Note: For entry-level, we're looking for internship experience
or significant personal projects at/with these companies.
```

---

### Step 3: Optional Requirements (Checkboxes)

> Legal/compliance filters that hard-reject candidates who don't qualify.

#### 📋 Work Authorization

| Option | Effect |
|--------|--------|
| [x] **Visa Sponsorship Available** | Expands pool to fresh graduates needing sponsorship |
| [ ] **Must Have Valid Work Visa** | Triggers visa gatekeeper flow |
| [ ] **UAE National Only** | Strict filter for Emiratization roles |
| [ ] **GCC National Preferred** | Soft preference, not a hard filter |

#### 🔒 Security & Compliance

| Option | Effect |
|--------|--------|
| [ ] **Security Clearance Required** | Adds screening question + background check flag |
| [ ] **NDA Required Before Interview** | Sends NDA for signature before interview link |
| [ ] **Background Check Consent** | Adds consent checkbox to interview flow |

#### 🎓 Education Requirements

| Option | Effect |
|--------|--------|
| [x] **Bachelor's Degree Required** | CS, Engineering, or related field |
| [ ] **Master's/PhD Preferred** | Not required for entry level |
| [ ] **Specific Certifications** | Text field: *(none required)* |

#### 📍 Work Arrangement

| Option | Effect |
|--------|--------|
| [x] **On-site Required** | Filters out remote-only candidates |
| [ ] **Hybrid OK** | Accepts candidates open to hybrid |
| [ ] **Fully Remote OK** | Broadest pool |
| [ ] **Relocation Package Available** | Mentioned in JD, expands geographic search |

#### 📋 Pre-Screening Questions (Auto-sent Before Interview)

> These questions are sent to inbound candidates via email. For outbound candidates, requirements are embedded in the personalized outreach (see Phase 4).

| Question | Include? | Auto-reject if... |
|----------|----------|-------------------|
| [x] **Visa/Work Authorization** | Yes | Needs sponsorship (when not offered) |
| [x] **Current Location** | Yes | Not in target location |
| [x] **Start Date Availability** | Yes | Can't start within urgency window |
| [x] **Minimum Commitment** | Yes | Won't commit to 12 months |
| [x] **On-site Confirmation** | Yes | Wants remote-only |
| [ ] **English Proficiency (1-5)** | Optional | Rating < 3 |
| [ ] **Graduation Status** | Optional | Not graduated (for entry-level) |
| [ ] **Salary Confirmation** | Optional | Hasn't reviewed posted range |

---

### Step 4: Company Context (The Secret Weapon)

> This is where you give the AI the "insider knowledge" to find truly relevant people.

**Note:** The **Ideal Candidate Profile** and **Red Flags** fields below are **auto-populated by the AI** based on market research from Step 2. The human can review, edit, or add to these suggestions based on insider knowledge the AI wouldn't have.

#### 🏗️ Project Context (Free Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tell us about the actual work this person will do:                 │
│                                                                     │
│ "Building internal dashboards and agentic AI systems to 100x       │
│  performance across marketing channels. They'll use Claude Code,   │
│  Python, JavaScript, and databases to build full-stack apps        │
│  (backend + frontend). The role is highly results-oriented —       │
│  we don't want someone who builds systems mindlessly. They need    │
│  to understand HOW to use AI to achieve specific business          │
│  outcomes, measure impact, and iterate. Will work on automating    │
│  recruiting pipelines, marketing automation, and data dashboards." │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**How this is used:**
- **JD Generation:** "You'll build AI-powered tools that 100x our marketing efficiency..."
- **Interview Questions:** "You have a marketing channel that converts at 2%. How would you approach using AI to improve this? What would you measure? Walk me through your thinking."
- **Resume Scoring:** Boosts candidates with project experience in automation, dashboards, AI integrations, or measurable outcomes.

#### 🎯 Ideal Candidate Profile *(AI-generated, editable)*

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🤖 AI-SUGGESTED (based on market research):              [✏️ Edit] │
│                                                                     │
│ "A hungry recent graduate (0-2 years) who has SHIPPED something    │
│  real — an internship project, a side project with users, or       │
│  freelance work. They use AI tools daily (ChatGPT, Claude,         │
│  Cursor) to accelerate their work. They understand that code       │
│  is a means to an end, not the goal. Looking for someone who       │
│  asks 'what business problem does this solve?' before writing      │
│  a single line. Bonus: has built something that made/saved money." │
│                                                                     │
│ ────────────────────────────────────────────────────────────────── │
│ ➕ ADD YOUR OWN CONTEXT:                                            │
│ [                                                                 ] │
│ (e.g., "Must be comfortable working in fast-paced environment      │
│  with ambiguous requirements")                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### ⚠️ Red Flags to Watch For *(AI-generated, editable)*

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🤖 AI-SUGGESTED (based on entry-level hiring patterns):  [✏️ Edit] │
│                                                                     │
│ "Pure academics with ZERO business experience. If their resume     │
│  only shows coursework, university projects, and GPA — but no      │
│  internships, freelance work, or personal projects with real       │
│  users — they're not ready. We need someone who has proven they    │
│  can perform in industry, not just pass exams.                     │
│                                                                     │
│  Also avoid: people who talk about AI in purely theoretical        │
│  terms but have never actually built anything with it. If they     │
│  can't demo something they made, that's a red flag."               │
│                                                                     │
│ ────────────────────────────────────────────────────────────────── │
│ ➕ ADD YOUR OWN RED FLAGS:                                          │
│ [                                                                 ] │
│ (e.g., "Avoid candidates from [specific company] — bad culture     │
│  fit historically" or "No job hoppers with <1 year tenures")       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**How this is used:**
- **Resume Screening:** Auto-flags resumes with only academic experience; adds note "No industry exposure detected - likely reject unless exceptional projects"
- **Interview Questions:** "Show me something you built that people actually used. What was the outcome? Did it work?" and "Walk me through a time you used AI to solve a real problem, not a homework assignment."

---

### Step 5: Review & Launch

> Human reviews the assembled `Job_Input_Document` before agents start.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      📋 REVIEW BEFORE LAUNCH                        │
├─────────────────────────────────────────────────────────────────────┤
│ Title:        AI Engineer (Entry Level)                            │
│ Location:     Dubai (On-site)                                      │
│ Salary:       AED 5,000 - 10,000/month                             │
│ Visa:         Sponsorship available                                │
│ Urgency:      🟡 30 days                                           │
├─────────────────────────────────────────────────────────────────────┤
│ Must-Have:    Python, JavaScript, SQL, API Integration             │
│ Nice-to-Have: React/Next.js, Claude Code, Prompt Engineering       │
│ Target Cos:   Careem, Talabat, Kitopi (internship exp)             │
├─────────────────────────────────────────────────────────────────────┤
│ Context:      AI dashboards, agentic systems, 100x marketing       │
│ Red Flags:    Pure academics, no shipped projects, theory-only     │
└─────────────────────────────────────────────────────────────────────┘

              [ Edit ]              [ 🚀 Launch Recruiting ]
```

**On Launch:**
1. `Job_Input_Document` is saved to database
2. Agent 1 (Domain Architect) is triggered
3. Human is notified when JD draft is ready for final approval
4. After JD approval → Agents 3-8 run autonomously

---

### Input Document Schema

For reference, here's the data structure passed to all agents:

```json
{
  "job_input": {
    "title": "AI Engineer (Entry Level)",
    "level": "entry",
    "location": ["Dubai"],
    "work_arrangement": "onsite",
    "company": "Printerpix",
    "department": "Growth & AI Team",
    "urgency": "30_days",
    
    "salary": {
      "min": 5000,
      "max": 10000,
      "currency": "AED",
      "period": "monthly"
    },
    
    "requirements": {
      "visa": "sponsorship_available",
      "security_clearance": false,
      "education": "bachelors_required",
      "certifications": []
    },
    
    "skills": {
      "must_have": ["Python", "JavaScript", "SQL", "API Integration"],
      "nice_to_have": ["React", "Next.js", "Claude Code", "Prompt Engineering"],
      "tools": ["Cursor IDE", "ChatGPT/Claude", "Supabase", "Vercel"]
    },
    
    "targeting": {
      "companies": ["Careem", "Talabat", "Kitopi", "Checkout.com", "YC startups"],
      "experience_years": { "min": 0, "max": 2 },
      "experience_type": "internship_or_projects"
    },
    
    "context": {
      "project_description": "Building AI dashboards and agentic systems to 100x marketing performance. Full-stack work with Python, JS, databases. Results-oriented — must understand how to use AI for business outcomes, not just build systems.",
      
      "ideal_candidate": {
        "ai_generated": "Hungry graduate who has SHIPPED something real. Uses AI tools daily. Asks 'what problem does this solve?' before coding.",
        "human_added": "Must be comfortable in fast-paced environment with ambiguous requirements.",
        "source": "ai+human"
      },
      
      "red_flags": {
        "ai_generated": ["pure_academic", "no_internship", "no_shipped_projects", "theory_only_ai_knowledge"],
        "human_added": ["job_hopper_under_1_year"],
        "source": "ai+human"
      }
    }
  }
}
```

---

## Phase 1: The Research & Strategy Engine (The Foundation)

> Before we look for people, we must master the domain.

### Agent 1: The Domain Architect (The "Professor")

**Trigger:** A new job title is input (e.g., "AI Engineer (Entry Level)").

**Action:** This agent performs deep web research to build a "Knowledge Graph" for this specific role.

- **Trend Analysis:** "What tools are entry-level AI engineers using in 2026?" (e.g., "Claude Code and Cursor IDE are becoming standard; prompt engineering is a must-have skill.")
- **Salary Calibration:** Scrapes salary data for Dubai entry-level roles to ensure competitive offers for top graduates.
- **Company Targeting:** Identifies which companies have strong internship programs producing quality talent (e.g., "Look for interns from Careem, Kitopi, or YC startups who shipped real features").

**Output:** A structured `Role_Strategy_Document` that guides all other agents.

---

### Agent 2: The Copywriter & SEO Specialist

**Action:** Drafts the Job Description (JD).

**Differentiation:** Instead of generic fluff, it injects "Filter Keywords" discovered by Agent 1. For entry-level roles, it emphasizes "Visa Sponsorship Available" and "Growth Opportunity" to attract ambitious graduates. It includes specific project context ("build AI systems that 100x marketing performance") to filter for results-oriented candidates.

**Output:** A published JD on Betterteam.

---

## Phase 2: The "Headhunter" Engine (Acquisition & Outbound)

> This is the aggressive top-of-funnel layer. It doesn't just wait for applicants; it goes to get them.

### Agent 3: The Outbound Hunter (The "Reed/LinkedIn" Bot)

**Goal:** Replicate your HR team's success on Reed.

**Action:**

1. **Search:** Uses the `Role_Strategy_Document` keywords to search resume databases (Reed, GitHub, specialized boards).
2. **Pre-Qualify:** It reads the profiles before contacting. If the match score is < 80%, it ignores them.
3. **Outreach:** It sends a hyper-personalized cold email with **screening requirements + interview link embedded** (see Phase 4 for details).
   - ❌ **Bad:** "We have a job."
   - ✅ **Good:** "I saw your repo on [Project X] and your work with [Tech Y]. We are building something similar..."
4. **Embedded Screening:** The email includes role requirements upfront (location, salary, visa, start date) so candidates self-filter before clicking.
5. **Direct CTA:** Interview link included in the email — **one click to interview** (no back-and-forth questionnaire for outbound candidates).

**Why One Email?** Outbound candidates are passive — every extra step loses ~30% of them. Embedding screening + interview in one email maximizes conversion.

#### Reputation Engine (Email Deliverability)

Agent 3 includes a built-in **Reputation Engine** to prevent emails from landing in spam:

- **Bounce Rate Monitoring:** Track bounce rate per sending domain. If bounces > 5%, auto-throttle send rate.
- **Domain Warming:** New sending domains start at 20 emails/day, gradually increasing (20 → 50 → 100 → 200) over 2-4 weeks.
- **Domain Rotation:** If one domain gets flagged, automatically rotate to a backup domain.
- **Send Timing:** Optimize send times based on open-rate data (avoid bulk-sending at the same time).
- **Auto-Throttle:** If deliverability metrics drop (open rate < 10%, bounce rate > 5%), Agent 3 automatically reduces volume and alerts Agent 4.

---

### Agent 4: The Acquisition Manager (The Optimization Brain)

**The "Quality" Feedback Loop:** This agent monitors the pipeline daily.

#### Scenario A: The "Noise" Trap

- **Input:** High CTR on Betterteam, but Agent 5 (Screener) is rejecting 90% of resumes.
- **Decision:** "The JD is too broad/clickbaity."
- **Action:** Automatically triggers Agent 2 to rewrite the JD to be stricter, adding "Knockout Questions" or emphasizing hard requirements to deter unqualified applicants.

#### Scenario B: The "Ghost Town"

- **Input:** Low CTR, low volume.
- **Decision:** "We are invisible."
- **Action:** Triggers Agent 3 to increase daily outbound email volume and broadens the search keywords in Agent 1's strategy.

#### Scenario C: The "Gold Mine"

- **Input:** Low volume, but 80% of resumes are passing to the interview stage.
- **Action:** Do nothing. This is the ideal state. High efficiency.

#### Scenario D: The "Leaky Bucket"

- **Input:** High volume, decent resume scores, but candidates drop off before completing the interview (high start rate, low completion rate).
- **Decision:** "The interview funnel has too much friction."
- **Action:** Analyze drop-off points. Suggest: shorter interview, send reminder emails to candidates who started but didn't finish, test different time-of-day outreach. This is a UX/friction problem, not a JD problem.

#### Scenario E: The "Misaligned Compass"

- **Input:** Resume scores are high, interview scores are high, but hiring manager keeps rejecting finalists in Phase 6.
- **Decision:** "The AI's definition of 'good' doesn't match the human's."
- **Action:** Triggers a recalibration workflow. Agent 4 analyzes the **rejection reasons** (free-text) provided by the human (see Phase 6) and identifies patterns. If 3+ rejections cite similar themes (e.g., "arrogant," "no humility," "bad culture fit"), Agent 4:
  1. Updates the `Role_Strategy_Document` with learned red flags from human feedback
  2. Tells Agent 9 (interviewer) to add probe questions targeting the identified gap (e.g., humility, collaboration)
  3. Tells Agent 10 (adjudicator) to upweight the relevant signals in scoring
  4. Optionally triggers Agent 2 to adjust the JD to better attract the right personality type

---

## Phase 3: The Forensic Screener (Resume Analysis)

> Deep analysis before the interview invites go out.

### Agent 5: The Forensic Analyst

**Action:** Parses incoming resumes (Inbound) or scraped profiles (Outbound).

**The "BS Detector":** It checks for:

- **Timeline Logic:** "Did they really become a Senior VP in 1 year?"
- **Skill Clustering:** "They list React and Angular, but their project descriptions only mention jQuery. Flag for interview."

**Output:** A `Resume_Score` (0-100) and a `Suspicion_Report`.

| Score | Action |
|-------|--------|
| < 70 | Auto-reject |
| ≥ 70 | Proceed to Pre-Screening |

---

## Phase 4: Pre-Screening Gatekeeper (The "Quick Filter")

> Before the AI interview, filter out candidates who don't meet basic logistical requirements.

This phase handles the **screening questionnaire** that filters candidates on non-negotiable criteria (visa, availability, commitment) before they enter the AI interview funnel.

### Why This Exists

Don't waste a 30-minute AI interview on someone who:
- Needs visa sponsorship when you can't provide it
- Can't start for 6 months when you need someone ASAP
- Wants remote when the role is on-site
- Has salary expectations 3x your budget

### Agent 6: The Gatekeeper

**Trigger:** Candidate passes resume screening (score ≥ 70).

**Action:** Sends a pre-screening questionnaire based on role requirements.

---

### Inbound Candidates (Applied via Job Board)

For candidates who applied through Betterteam/LinkedIn, send a **reply-based questionnaire email**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  QUESTIONNAIRE EMAIL (Auto-generated based on job requirements)    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Subject: Quick Questions regarding your application to Printerpix │
│                                                                     │
│  Hi {name},                                                         │
│                                                                     │
│  Thanks for applying! Your profile looks interesting.               │
│                                                                     │
│  Before we proceed, please reply with answers to:                   │
│                                                                     │
│  1. Are you currently residing in Dubai?                            │
│                                                                     │
│  2. What visa do you hold that allows you to work with a NEW        │
│     employer in the UAE? When does it expire?                       │
│                                                                     │
│  3. English skills (1-5 scale):                                     │
│     - Speaking: ___                                                 │
│     - Writing: ___                                                  │
│                                                                     │
│  4. Have you completed your studies/graduated?                      │
│                                                                     │
│  5. Can you commit to a minimum of 12 months?                       │
│                                                                     │
│  6. This is onsite (Mon-Fri, Downtown Dubai). Does this work?       │
│                                                                     │
│  7. What is your earliest start date if successful?                 │
│                                                                     │
│  Please also confirm you've reviewed the salary range in the        │
│  job posting — we don't want to waste your time.                    │
│                                                                     │
│  Best,                                                              │
│  Printerpix Recruiting                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Email sent → Status: `QUESTIONNAIRE_SENT`
2. AI monitors inbox for reply
3. When reply received → Agent 6 analyzes response with Gemini
4. **PASS:** Sends interview link → Status: `INVITE_SENT`
5. **FAIL:** Sends polite rejection → Status: `REJECTED_PRESCREENING`

**What Gets Auto-Rejected:**
- Employer/employment visa (needs sponsorship/labor transfer)
- Tourist/visit visa
- Can't commit to 12 months
- Remote-only when role is on-site
- Start date > 60 days when urgency is ASAP

---

### Outbound Candidates (Headhunted)

> For candidates YOU contacted first, **reduce friction** by embedding screening questions in the personalized outreach email.

**Key Insight:** When you cold-email someone, they're already skeptical. If you make them:
1. Reply to a screening email
2. Wait for another email with interview link
3. Then do the interview

...you'll lose 70% of them. Instead, **combine steps 1 + 2** into a single email.

```
┌─────────────────────────────────────────────────────────────────────┐
│  OUTBOUND EMAIL (Screening + Interview Link Combined)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Subject: Your FastAPI work caught our attention — quick Q         │
│                                                                     │
│  Hi Ahmed,                                                          │
│                                                                     │
│  I saw your work on [Project X] and your contributions to          │
│  [Tech Y]. We're building AI-powered automation systems at         │
│  Printerpix and your background looks like a great fit.            │
│                                                                     │
│  Before we chat, just need to confirm a few things:                 │
│                                                                     │
│  ✅ Role is on-site in Dubai (Downtown), Mon-Fri                    │
│  ✅ Salary range: AED 5,000 - 10,000/month                          │
│  ✅ Looking for someone to start within 30 days                     │
│  ✅ Visa sponsorship available for the right candidate              │
│                                                                     │
│  If that all works for you, skip straight to the interview:        │
│                                                                     │
│  👉 [START AI INTERVIEW] ← Click here (20-30 mins)                  │
│     {interview_link}                                                │
│                                                                     │
│  The interview covers your background skills.         │
│  Complete it at your convenience within 48 hours.                   │
│                                                                     │
│  If the above requirements don't match what you're looking for,     │
│  no worries — just ignore this email.                               │
│                                                                     │
│  Best,                                                              │
│  Wayne                                                              │
│  Talent Scout, Printerpix                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why This Works:**
- **Self-filtering:** Candidates who don't meet requirements simply don't click
- **Lower friction:** One email → interview (not email → reply → email → interview)
- **Higher conversion:** Passive candidates respond better to direct CTAs
- **Clear expectations:** Salary, location, timeline upfront = no surprises later

**Flow:**
1. Outbound email sent with interview link → Status: `OUTBOUND_SENT`
2. If candidate clicks and starts interview → Status: `INTERVIEW_STARTED`
3. If no action in 7 days → Auto follow-up email
4. If no action in 14 days → Mark as `NO_RESPONSE` (can retry in 90 days)

---

### Screening Questions Are Dynamic

The questionnaire adapts based on `Job_Input_Document`:

| If Job Requires... | Question Added |
|--------------------|----------------|
| On-site work | "Role is on-site at [location]. Does this work for you?" |
| Visa sponsorship NOT available | "Do you have valid work authorization for [country]?" |
| Security clearance | "Are you willing to undergo a background check?" |
| Specific start date | "Can you start by [date]?" |
| Minimum commitment | "Can you commit to at least [X] months?" |

**Non-Dubai roles** may skip most questions and go straight to interview (configurable in Phase 0).

---

## Phase 5: The Investigator (The "Intentional" Interview)

> Here is where the "Heavy Research" focus shines. Every question has a purpose.

**AI Consent Notice:** When a candidate opens their interview link, the first screen displays a brief consent notice: *"This interview is conducted by an AI assistant. Your responses will be recorded and reviewed by our hiring team. By proceeding, you consent to this process."* The candidate must acknowledge before the interview begins.

### Agent 7: The Interview Architect (The "Director")

**Trigger:** A candidate clicks their interview link (one-time use, available 24/7).

**Action:** This agent assembles a **personalized interview script** by pulling from 4 distinct sources:

---

#### Source 1: Role Research Questions (From Agent 1)

Questions based on market research and best practices for this specific role.

| Research Insight | Generated Question |
|------------------|-------------------|
| "Vector databases are trending for AI roles in 2026" | "What's your experience with vector databases like Pinecone or Weaviate? How would you decide when to use one?" |
| "Entry-level AI engineers often struggle with prompt engineering" | "Walk me through how you'd design a prompt for a complex task. What makes a prompt effective vs. ineffective?" |
| "Companies report that results-orientation is the #1 predictor of success" | "Tell me about a project where you had to measure success. What metrics did you choose and why?" |

**Source:** `Role_Strategy_Document` from Phase 1

---

#### Source 2: Company Context Questions (From Phase 0)

Questions tailored to the actual work they'll do at YOUR company.

| Company Context (Phase 0 Input) | Generated Question |
|---------------------------------|-------------------|
| "Building AI dashboards to 100x marketing performance" | "If I gave you a marketing funnel converting at 2%, how would you approach using AI to improve it? What would you measure first?" |
| "Will use Claude Code, Python, JS, databases" | "You need to build an internal tool that pulls data from an API, processes it, and displays it in a dashboard. Walk me through your approach — what stack would you use and why?" |
| "Results-oriented, not just building systems mindlessly" | "Tell me about a time you stopped mid-project because you realized the approach wasn't going to achieve the goal. What did you do?" |

**Source:** `project_description` from `Job_Input_Document`

---

#### Source 3: Resume-Specific Questions (Personalized Probes)

Questions that dig into THIS candidate's specific claims and experiences.

| Resume Claim | Generated Question | What We're Testing |
|--------------|-------------------|-------------------|
| "Built dashboard at Kitopi internship" | "Tell me about the Kitopi dashboard. How many users? What was the hardest technical challenge? How did you know it was successful?" | Did they actually build it, or just contribute? |
| "Proficient in Python" | "You list Python as a skill. What's the most complex thing you've built with it? Show me your thinking process." | Depth of knowledge vs. surface familiarity |
| "Reduced manual work by 4 hours/week" | "Walk me through exactly how you measured that 4-hour reduction. What was the before and after?" | Can they quantify impact or is it made up? |

**Source:** Parsed resume from Phase 3

---

#### Source 4: Red Flag Exploration Questions (From Suspicion Report)

Questions specifically designed to probe concerns identified during resume screening.

| Red Flag Detected | Exploration Question | Pass Signal | Fail Signal |
|-------------------|---------------------|-------------|-------------|
| "No internship/business experience" | "Your resume shows mostly academic projects. Tell me about a time you worked on something with real users or real stakes — not a class assignment." | Mentions freelance, open source, or personal project with users | Can only cite coursework |
| "Short tenure pattern" | "I see you had a few short stints. Walk me through what happened at [Company X] — why did you leave after 6 months?" | Clear explanation (company closed, contract ended, relocation) | Vague ("wasn't a good fit") or blames others |
| "Claims don't match timeline" | "You mention leading a team of 5 at [Startup], but LinkedIn shows you were there for 4 months as an intern. Help me understand that." | Clarifies (team lead for a sprint, not the whole time) | Doubles down on inflated claim |
| "AI skills listed but no projects shown" | "You mention AI/ML skills. Show me something you built with AI. Walk me through the prompt engineering or model selection." | Can demo or explain in detail | Theory only, no practical application |

**Source:** `Suspicion_Report` from Agent 5

---

#### The Interview Script: Assembled

Agent 7 combines all sources into a prioritized script:

```
┌─────────────────────────────────────────────────────────────────────┐
│  INTERVIEW SCRIPT: Ahmed Al-Rashid                                 │
│  Role: AI Engineer (Entry Level) — Dubai                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRIORITY 1: Red Flag Exploration (must ask)                       │
│  ──────────────────────────────────────────                        │
│  Q1: "Your resume shows mostly academic work. Tell me about        │
│       something you built with real users or real stakes."         │
│       → PASS IF: Mentions shipped project with measurable outcome  │
│       → FAIL IF: Only cites coursework or theory                   │
│                                                                     │
│  PRIORITY 2: Company Context (role-specific)                       │
│  ──────────────────────────────────────────                        │
│  Q2: "Marketing funnel at 2% conversion — how would you use AI     │
│       to improve it? What do you measure first?"                   │
│       → PASS IF: Starts with understanding the goal, mentions      │
│                  metrics, iterative approach                       │
│       → FAIL IF: Jumps to solution without asking questions        │
│                                                                     │
│  PRIORITY 3: Resume Verification                                   │
│  ──────────────────────────────────────────                        │
│  Q3: "Tell me about the Kitopi dashboard. Users? Challenges?       │
│       How did you know it worked?"                                 │
│       → PASS IF: Specific details, numbers, ownership language     │
│       → FAIL IF: Vague, "we" instead of "I", no metrics           │
│                                                                     │
│  PRIORITY 4: Role Best Practices                                   │
│  ──────────────────────────────────────────                        │
│  Q4: "Walk me through designing a prompt for a complex task.       │
│       What makes it effective?"                                    │
│       → PASS IF: Structured approach, mentions iteration/testing   │
│       → FAIL IF: "Just ask ChatGPT" with no depth                 │
│                                                                     │
│  FOLLOW-UP TRIGGERS:                                               │
│  • If vague answer → "Give me a specific example with numbers"    │
│  • If "we" language → "What was YOUR specific contribution?"      │
│  • If theory-only → "Show me something you actually built"        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Feature:** Each question includes **pass/fail signals** so the Voice AI (Agent 9) knows what to listen for.

---

### Agent 8: The Question Optimizer (The "Learner")

> Not all questions are equally insightful. This agent learns which questions best predict successful hires.

**Trigger:** Runs weekly, analyzing interview data.

**Action:** Correlates question responses with hiring outcomes.

---

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  QUESTION EFFECTIVENESS ANALYSIS                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Question: "Tell me about a project with real users"               │
│  Times Asked: 47                                                    │
│  Correlation with Hire: 0.82 ⭐ HIGH                               │
│  → INSIGHT: Strong pass on this Q → 4x more likely to be hired    │
│  → ACTION: Promote to PRIORITY 1 for all entry-level roles        │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Question: "Rate your Python skills 1-10"                          │
│  Times Asked: 52                                                    │
│  Correlation with Hire: 0.12 ❌ LOW                                │
│  → INSIGHT: Self-rating doesn't predict success                   │
│  → ACTION: Remove from script, replace with practical demo Q       │
│                                                                     │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Question: "Walk me through your prompt engineering approach"      │
│  Times Asked: 31                                                    │
│  Correlation with Hire: 0.67 ✓ MEDIUM-HIGH                        │
│  → INSIGHT: Good signal but could be sharper                       │
│  → ACTION: Test variant: "Show me a prompt you wrote and why"     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Optimization Actions

| Signal | Action |
|--------|--------|
| **High correlation (>0.7)** | Promote question to Priority 1; use for all similar roles |
| **Low correlation (<0.3)** | Demote or remove; log why (too easy? too vague? gaming-able?) |
| **Medium correlation** | Test variants; A/B test different phrasings |
| **New question type works** | Add to best practices for this role category |

---

#### Learning From Failures

When a hired candidate **fails within 90 days**, the Optimizer investigates:

```
┌─────────────────────────────────────────────────────────────────────┐
│  FAILURE ANALYSIS: John Smith (AI Engineer, hired 2026-01-15)      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Outcome: Terminated at Day 45 (couldn't work independently)       │
│                                                                     │
│  Interview Review:                                                  │
│  • Q: "Tell me about a project with real users"                    │
│    A: "I built a Discord bot with 50 users" ✓ PASSED               │
│                                                                     │
│  • Q: "How do you handle ambiguous requirements?"                  │
│    A: [NOT ASKED — wasn't in script]                               │
│                                                                     │
│  Gap Identified: We didn't test for independence/ambiguity         │
│                                                                     │
│  → ACTION: Add to script for all entry-level:                      │
│    "Tell me about a time you had to figure something out with      │
│     minimal guidance. What did you do?"                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Question Evolution Over Time

The system maintains a **Question Bank** that evolves:

| Version | Entry-Level AI Engineer Questions | Why Changed |
|---------|----------------------------------|-------------|
| v1.0 | "Rate your Python skills 1-10" | Initial |
| v1.1 | "What's the most complex Python project you've built?" | Self-rating was useless |
| v1.2 | "Show me a Python project and walk me through a tricky part" | Asking is better than showing |
| v2.0 | "Here's a broken function. Debug it live with me." | Practical demo beats storytelling |

---

#### Cold-Start Strategy (Before 90-Day Outcome Data)

The Question Optimizer needs hire outcome data to calculate correlations, but early in the system's life there are zero hires. Agent 8 uses **proxy signals** to start learning immediately:

| Proxy Signal | What It Measures | Available From Day 1 |
|---|---|---|
| **Probe Frequency** | How often the interviewer had to push for specifics (more probes = weaker answers) | ✅ Yes |
| **Score Variance** | High resume score + low interview score = potential BS | ✅ Yes |
| **Resume-vs-Interview Correlation** | Do claimed skills hold up under questioning? | ✅ Yes |
| **Human Advance Rate** | Which candidates do humans actually advance in Phase 6? | ✅ After first finalists |
| **Answer Specificity Score** | Concrete numbers/examples vs. vague/generic answers | ✅ Yes |
| **Follow-up Trigger Rate** | How many "give me a specific example" follow-ups were needed | ✅ Yes |

**Progression:**
1. **Week 1-4 (Cold Start):** Use proxy signals only. Weight questions by answer quality patterns.
2. **Month 2-3 (Warm Start):** Incorporate human advance/reject data from Phase 6 as early signal.
3. **Month 4+ (Full Loop):** 90-day hire outcomes become available. Switch to full correlation analysis.
4. **Ongoing:** Blend proxy signals (fast feedback) with outcome data (accurate but slow) using weighted average that shifts toward outcomes over time.

---

### Agent 9: The Voice Interrogator (Gemini 2.0 + Deepgram)

**Action:** Conducts the interview using the personalized script from Agent 7.

**Key Behaviors:**

1. **Follows the Script Priority:** Asks Priority 1 questions first, adapts based on time
2. **Listens for Pass/Fail Signals:** Uses the answer key from Agent 7 to score in real-time
3. **Triggers Follow-ups:** If candidate gives vague answer, pushes for specifics
4. **Behavioral Probing (Not Real-time Fact Checking):** Instead of trying to verify claims in real-time (unreliable for most candidates), the agent uses **behavioral probing techniques** to surface inconsistencies:
   - **Depth Drilling:** "Walk me through the exact steps you took" — liars struggle with specifics
   - **Timeline Pressure:** "What month was that? Who was your manager?" — fabricated stories have fuzzy timelines
   - **Reversal Questions:** "What would you do differently if you did it again?" — people who didn't do it can't critique it
   - **Claim Flagging:** Suspicious claims (e.g., "increased revenue 200%") are flagged for Agent 10 to include in the "Claims to Verify" section of the dossier, so humans can fact-check during their interview
5. **Adaptive Probing:** If a red flag answer is concerning, spends more time there before moving on

---

### Agent 10: The Adjudicator

**Action:** Reviews the recording and transcript after the interview.

**The "Truth" Feedback Loop:**

- **Input:** Candidate had a great Resume Score (90) but failed the Technical Interview (Score 20).
- **Diagnosis:** "Paper Tiger." The resume keywords were right, but the skill was fake.
- **Action:** It updates the Forensic Analyst (Agent 5) rules: "Downgrade the weight of [specific certification] because it is not correlating with success."

**Claims to Verify (Dossier Section)**

Agent 10 compiles a **"Claims to Verify"** section for every candidate dossier sent to Phase 6. This includes any claims flagged by Agent 9 during the interview that couldn't be verified through behavioral probing alone:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 CLAIMS TO VERIFY (for human interviewer)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. "Increased revenue by 200% at previous startup"                │
│     → AI Assessment: Could not verify. Candidate gave specific     │
│       steps but no external data available. ASK FOR PROOF.         │
│                                                                     │
│  2. "Led a team of 5 engineers"                                    │
│     → AI Assessment: Timeline suggests 4-month internship.         │
│       Candidate clarified "led a sprint team" — plausible but      │
│       worth confirming with reference.                              │
│                                                                     │
│  3. "Built a tool used by 500+ daily active users"                 │
│     → AI Assessment: Candidate provided specific metrics and       │
│       technical details. Likely accurate. LOW PRIORITY to verify.  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**New: Question Feedback**

After each interview, Agent 10 also sends data to Agent 8 (Question Optimizer):

```json
{
  "candidate_id": "12345",
  "questions_asked": [
    {
      "question": "Tell me about a project with real users",
      "response_quality": "strong",
      "pass_signals_detected": ["specific metrics", "ownership language"],
      "time_spent": "3 min"
    },
    {
      "question": "Rate your Python skills",
      "response_quality": "weak",
      "pass_signals_detected": [],
      "note": "Said '8/10' but couldn't explain anything complex"
    }
  ],
  "final_recommendation": "advance",
  "90_day_outcome": null  // Filled in later if hired
}
```

---

## Phase 6: Human Handoff (The "Decision Package")

> AI filters. Humans decide. This is where the hiring manager gets involved.

The AI's job is to **reduce the pile from 500 applicants to 5-10 finalists**. The human's job is to make the final call. This section defines exactly what HR/Hiring Manager receives and what actions they can take.

---

### What the Human Receives: The Candidate Dossier

After a candidate passes both AI interviews (Round 1: Behavioral, Round 2: Technical), the system generates a **Candidate Dossier** — a single-page summary designed for fast human decision-making.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🎯 CANDIDATE DOSSIER                                 │
│                    AI Engineer (Entry Level) — Dubai                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CANDIDATE: Ahmed Al-Rashid                                                 │
│  EMAIL: ahmed.rashid@email.com                                              │
│  LOCATION: Dubai (available immediately)                                    │
│  VISA STATUS: ✅ Golden Visa holder                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 SCORES                                                                  │
│  ┌─────────────────┬──────────────────┬──────────────────┐                 │
│  │ Resume Score    │ Round 1 (Wayne)  │ Round 2 (Atlas)  │                 │
│  │     82/100      │     78/100       │     85/100       │                 │
│  │ (Top 15%)       │ (Culture fit ✓)  │ (Technical ✓)    │                 │
│  └─────────────────┴──────────────────┴──────────────────┘                 │
│                                                                             │
│  OVERALL RECOMMENDATION: ⭐⭐⭐⭐ STRONG HIRE                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📝 AI SUMMARY (2 min read)                                                 │
│                                                                             │
│  "Ahmed is a recent CS graduate from AUS with a strong internship at        │
│   Kitopi where he built an internal dashboard that reduced manual           │
│   reporting time by 4 hours/week. He demonstrates clear results-oriented    │
│   thinking — when asked about his projects, he immediately talked about     │
│   impact metrics, not just technical implementation.                        │
│                                                                             │
│   STRENGTHS:                                                                │
│   • Shipped real code in production (Kitopi inventory dashboard)            │
│   • Uses Claude/ChatGPT daily for coding — comfortable with AI tools        │
│   • Asked 'what's the business goal?' before answering technical Qs         │
│   • Proactive: built a side project (expense tracker) with 200 users        │
│                                                                             │
│   CONCERNS:                                                                 │
│   • Limited experience with databases at scale (only worked with <10K rows) │
│   • No direct experience with agentic AI systems (but eager to learn)       │
│                                                                             │
│   CULTURE FIT: High. Hungry, humble, asks good questions."                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 EVIDENCE (click to expand)                                              │
│                                                                             │
│  [▶ Watch Round 1 Interview] (12 min)    [📄 Read Transcript]               │
│  [▶ Watch Round 2 Interview] (18 min)    [📄 Read Transcript]               │
│  [📎 Resume PDF]                         [🔗 LinkedIn] [🔗 GitHub]          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  💡 SUGGESTED NEXT STEPS                                                    │
│                                                                             │
│  Given his limited database experience, if you proceed:                     │
│  • Ask about: How he'd approach learning Supabase/PostgreSQL at scale       │
│  • Test with: A small take-home involving a real data transformation        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│         [ ✅ ADVANCE ]    [ ⏸️ HOLD ]    [ ❌ REJECT ]    [ 💬 NOTE ]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Human Decision Actions

| Action | What Happens | When to Use |
|--------|--------------|-------------|
| **✅ ADVANCE** | Candidate moves to "Human Interview" stage. Calendar invite sent. | You want to meet them in person/video |
| **⏸️ HOLD** | Candidate stays in pipeline but deprioritized. No action taken. | "Maybe later" — waiting for other candidates |
| **❌ REJECT** | Polite rejection email sent. Candidate archived. | Clear no — doesn't meet bar |
| **💬 NOTE** | Add private notes visible only to hiring team | "Check if salary expectations align" |

---

### The Feedback Loop: Human Decisions Train the AI

> Every human decision makes the AI smarter.

#### When Human Advances a Candidate

The AI learns: "This profile pattern → success." It slightly upweights similar candidates in future scoring.

#### When Human Rejects a Candidate (with reason)

The AI learns from the WHY:

| Human Reason | AI Learning |
|--------------|-------------|
| "Too junior for this role" | Adjust experience weighting for this job level |
| "Salary expectations too high" | Flag similar profiles earlier with salary warning |
| "Bad culture fit (arrogant)" | Increase weight of humility signals in Round 1 |
| "Liked them but going with someone else" | No negative signal — competitive loss, not quality issue |

#### When Human Hires a Candidate

**This is gold data.** The AI now has a confirmed "good hire" signal. After 90 days, the system can:
- Check: Did this hire succeed? (Still employed? Promoted? Manager feedback?)
- If YES: Reinforce the pattern
- If NO: Investigate what signals were missed

---

### Dashboard View: The "Finalist Queue"

HR sees all candidates who passed AI interviews in a ranked queue:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 AI Engineer (Entry Level) — 7 Finalists Ready for Review               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RANK │ NAME              │ SCORES (R/R1/R2) │ STATUS     │ ACTION         │
│  ─────┼───────────────────┼──────────────────┼────────────┼────────────    │
│  #1   │ Ahmed Al-Rashid   │ 82 / 78 / 85     │ ⭐ Strong  │ [Review]       │
│  #2   │ Sarah Chen        │ 79 / 82 / 80     │ ⭐ Strong  │ [Review]       │
│  #3   │ Omar Hassan       │ 75 / 80 / 77     │ ✓ Good     │ [Review]       │
│  #4   │ Priya Sharma      │ 88 / 72 / 74     │ ⚠️ Mixed   │ [Review]       │
│  #5   │ James Wilson      │ 70 / 75 / 78     │ ✓ Good     │ [Review]       │
│  #6   │ Fatima Al-Mazrouei│ 72 / 70 / 75     │ ✓ Good     │ [Review]       │
│  #7   │ David Park        │ 71 / 68 / 72     │ ⚠️ Borderline│ [Review]     │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────── │
│  📊 Pipeline Stats: 234 applied → 45 screened → 12 interviewed → 7 passed  │
│  ⏱️ Time to fill: 18 days (target: 30 days) ✅ On track                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Notes on Rankings:**
- **⭐ Strong Hire:** All scores ≥75, no red flags
- **✓ Good:** Solid candidate, minor concerns
- **⚠️ Mixed:** High variance in scores (e.g., great resume, weak interview) — needs human judgment
- **⚠️ Borderline:** Just barely passed thresholds — review carefully

---

### Final Handoff: The Offer Stage

Once human decides to hire:

1. **AI generates offer letter draft** based on:
   - Salary range from `Job_Input_Document`
   - Candidate's location/visa needs
   - Standard company templates

2. **Human reviews and sends offer**

3. **System tracks:**
   - Offer sent date
   - Candidate response (accepted/declined/negotiating)
   - If declined: captures reason for future salary calibration

4. **On acceptance:**
   - Candidate marked as "HIRED"
   - Triggers onboarding workflow (outside this system's scope)
   - 90-day check scheduled for feedback loop

---

### Human Touchpoints Summary

| Phase | Human Action | Time Required |
|-------|--------------|---------------|
| **Phase 0** | Fill kickoff form | ~5 min |
| **Phase 1** | Approve JD draft | ~2 min |
| **Phase 6** | Review finalist dossiers | ~5 min per candidate |
| **Phase 6** | Conduct final interview (optional) | ~30 min per candidate |
| **Phase 6** | Make hire decision | ~1 min |
| **Offer** | Review and send offer | ~5 min |

**Total human time for one hire:** ~1-2 hours (vs. 20+ hours in traditional process)

---

## Summary of the "Smart" Loops

| Loop Name | Trigger | Action | Goal |
|-----------|---------|--------|------|
| **The "Noise" Loop** | High Volume, Low Resume Scores | Rewrite JD to be harder/stricter | Reduce HR workload |
| **The "Reach" Loop** | Low Volume, High Resume Scores | Increase Outbound email limits; Broaden ad spend | Scale what works |
| **The "Liar" Loop** | High Resume Score, Low Interview Score (5+ candidates showing this pattern) | **Step 1:** Check if interview questions are effective (Agent 8 reviews question quality). **Step 2:** If questions are fine, THEN tighten Resume Screening prompt and flag specific keywords as "suspect" | Catch fakes earlier — but first verify it's not a question problem |

---

## Post-Round 2 Engagement (Candidate Communication)

> Candidates who complete Round 2 are waiting for a human decision. Don't leave them in the dark.

After a candidate completes their Round 2 interview, the system sends **timer-based status update emails** while the hiring manager reviews dossiers:

| Trigger | Email Sent | Purpose |
|---|---|---|
| **Interview completed** | Immediate confirmation: "Thank you for completing your interview. Our team will review your results shortly." | Acknowledgment |
| **48 hours, no human action** | "Your interview is being reviewed by our hiring team. We'll be in touch within the next few days." | Prevent anxiety |
| **7 days, no human action** | "We're still reviewing candidates for this role. You remain under consideration. We'll update you by [date]." | Maintain engagement |
| **14 days, no human action** | Internal alert to hiring manager: "7 candidates awaiting review for 14+ days. Please review." | Nudge the human |
| **Human makes decision** | Appropriate email (advance to human interview / rejection / hold) | Resolution |

**Key Rules:**
- Emails are professional and honest — never "ghost" a candidate
- If the role is filled, ALL remaining candidates get notified within 24 hours
- Rejection emails include: brief reason (generic), encouragement, and opt-in to future roles

---

## Recommended Build Order

> Phased implementation plan to get value quickly while building toward the full system.

### Phase A: Foundation (Weeks 1-3)
*Get the core pipeline working end-to-end with a single job.*

1. **Phase 0: Kickoff Form** — Build the `Job_Input_Document` input UI
2. **Agent 5: Forensic Screener** — Resume parsing + scoring (already partially built)
3. **Agent 6: Gatekeeper** — Pre-screening questionnaire flow
4. **Agent 9: Voice Interviewer** — AI interview (already built as Round 1 "Wayne")
5. **Agent 10: Adjudicator** — Post-interview scoring + dossier generation
6. **Phase 6: Dashboard** — Finalist queue + human decision actions (already partially built)

**Milestone:** A candidate can apply → get screened → interview with AI → appear on dashboard for human decision.

### Phase B: Intelligence Layer (Weeks 4-6)
*Add the research and personalization that makes interviews smart.*

7. **Agent 1: Domain Architect** — Market research + Role Strategy Document
8. **Agent 2: Copywriter** — JD generation from research
9. **Agent 7: Interview Architect** — Personalized question generation (4 sources)
10. **Post-Round 2 Engagement** — Timer-based candidate communication emails

**Milestone:** Interviews are now personalized per candidate. JDs are auto-generated. Candidates get status updates.

### Phase C: Acquisition Engine (Weeks 7-10)
*Add outbound sourcing and pipeline optimization.*

11. **Agent 3: Outbound Hunter** — Resume database search + personalized outreach + Reputation Engine
12. **Agent 4: Acquisition Manager** — Pipeline monitoring + Scenarios A-E
13. **Phase 6 Feedback Loop** — Human rejection reasons → AI learning (Scenario E)

**Milestone:** System actively hunts candidates instead of just waiting for applications.

### Phase D: Learning & Optimization (Weeks 11-14)
*Close the feedback loops that make the system get smarter over time.*

14. **Agent 8: Question Optimizer** — Cold-start proxy signals → full correlation analysis
15. **Smart Loops** — Noise Loop, Reach Loop, Liar Loop (with quality-first check)
16. **90-Day Outcome Tracking** — Connect hire outcomes back to interview signals

**Milestone:** The system continuously improves its own accuracy based on real outcomes.

### Dependencies
```
Phase 0 → Agent 1 → Agent 2 → Agent 3
Phase 0 → Agent 5 → Agent 6 → Agent 9 → Agent 10 → Phase 6
Agent 7 depends on Agent 1 (research) + Agent 5 (resume data)
Agent 8 depends on Agent 10 (interview data) + Phase 6 (human decisions)
Agent 4 depends on Agent 3 + Agent 5 + Agent 9 (pipeline metrics)
```
