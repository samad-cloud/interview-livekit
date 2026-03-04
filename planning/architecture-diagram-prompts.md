# Autonomous AI Recruiter — Architecture Diagram Prompts (Gemini)

All prompts target a **hierarchical swimlane diagram** style with a dark navy/charcoal background (#1a1a2e), clean modern typography, color-coded phase lanes, and a professional enterprise SaaS aesthetic.

---

## PROMPT 1: Master Overview (Already Created — Reference)

> Generate a professional hierarchical swimlane architecture diagram on a dark charcoal background (#1a1a2e) titled "Autonomous AI Recruiter — System Architecture" with subtitle "10 Agents | 6 Phases | 3 Self-Optimizing Loops". Layout left-to-right with 6 color-coded horizontal phase swim lanes stacked vertically. Phase 0 "Human Input" (green pill header) contains a "Kickoff Form" icon node labeled "Only human touchpoint" with an "Editable post-launch" annotation arrow curving back. Phase 1 "Research & Strategy" (blue lane) contains Agent 1 "Domain Architect" (magnifying glass icon) flowing right to Agent 2 "Copywriter & SEO" (pen icon), with outputs "Role Strategy Document" below Agent 1 and "Published JD" below Agent 2. Phase 2 "Headhunter Engine" (amber/orange lane) contains Agent 3 "Outbound Hunter" with sub-label "Reputation Engine" and Agent 4 "Acquisition Manager" with sub-label "5 Scenarios (A-E)", with a "Rewrite JD" feedback arrow curving back to Phase 1. Phase 3-4 "Screening" (purple lane) contains Agent 5 "Forensic Analyst" with outputs "Resume Score + Suspicion Report" and threshold "score >= 70" branching to Agent 6 "Gatekeeper" (with "Pre-Screening Questions") leading to PASS "Interview Link Sent" or FAIL "Rejected", and "score < 70" branching down to "Auto-Reject". Phase 5 "The Interview" (teal/cyan lane) contains Agent 7 "Interview Architect" (receiving inputs: Role Research, Company Context, Resume Data, Red Flags) flowing to Agent 8 "Question Optimizer" (sub-label "Cold-start → Proxy signals → Full correlation") flowing to Agent 9 "Voice Interrogator" (sub-label "Deepgram STT + Gemini + TTS, Behavioral Probing, Claim Flagging") flowing to Agent 10 "Adjudicator" outputting "Candidate Dossier + Claims to Verify". Phase 6 "Human Handoff" (red/coral lane) contains "Finalist Dashboard" with action buttons "Advance, Hold, Reject, Note" plus "Reject (with reason)" and "Post-Round 2 engagement emails (48h, 7d, 14d)" leading to "Offer Letter". Three colored curved feedback loops overlay the diagram: "Noise Loop" (orange curve from Screening back to Headhunter, labeled "Adjust questions"), "Reach Loop" (blue curve from Screening back to Research, labeled "Adjust volume"), and "Liar Loop" (red curve from Interview back checking "question quality first"). Include a legend in bottom-right: solid arrow = Data Flow, curved arrow = Feedback Loop, dashed arrow = Rejection Path. Use rounded rectangle nodes with subtle drop shadows, icons inside agent nodes, and a clean sans-serif font throughout.

---

## PROMPT 2: Phase 0 — Human Input (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 0: Human Input — Detailed Workflow" with subtitle "The Only Human Touchpoint in the Entire Pipeline". Use a green (#22c55e) color theme for headers and accent elements.
>
> Layout top-to-bottom with 3 horizontal swim lanes:
>
> **Lane 1: "HR Manager Actions"**
> - Start node (circle): "HR Manager logs into Dashboard"
> - Flow right to: "Click 'New Role' button" (rounded rect with cursor icon)
> - Flow right to: "Kickoff Form Opens" (large rounded rect, highlighted border)
>
> **Lane 2: "Kickoff Form — Field by Field"**
> Show the Kickoff Form as a large expanded card containing a vertical list of form fields, each as a labeled row:
> - Field 1: "Company Name" (text input) — auto-populated if returning user
> - Field 2: "Role Title" (text input) — e.g. "Senior Backend Engineer"
> - Field 3: "Department" (dropdown) — Engineering, Sales, Marketing, Operations, etc.
> - Field 4: "Seniority Level" (radio buttons) — Junior, Mid, Senior, Lead, Director, VP, C-Suite
> - Field 5: "Location / Remote Policy" (multi-select) — On-site, Hybrid, Remote, specific city
> - Field 6: "Salary Range" (range slider or two inputs) — min/max with currency selector
> - Field 7: "Must-Have Skills" (tag input) — e.g. Python, AWS, Kubernetes
> - Field 8: "Nice-to-Have Skills" (tag input) — secondary skills
> - Field 9: "Years of Experience" (range) — minimum required
> - Field 10: "Role Description / Context" (rich text area) — free-form notes about what makes this role unique, team dynamics, challenges
> - Field 11: "Hiring Urgency" (dropdown) — Immediate, 30 days, 60 days, Exploratory
> - Field 12: "Interview Style Preference" (dropdown) — Technical Deep-Dive, Behavioral Focus, Culture Fit, Balanced
> - Field 13: "Red Flags to Watch For" (tag input) — job hopping, gaps, specific concerns
> - Field 14: "Screening Strictness" (slider) — Lenient (60) to Strict (90), default 70
> - "Submit" button (green, prominent)
>
> **Lane 3: "System Response"**
> - "Form Validated" (checkmark node) → "Role Strategy Document Generated" (document icon)
> - Arrow labeled "Triggers Phase 1" flowing to: "Agent 1: Domain Architect activated" (blue node referencing next phase)
> - Side annotation: "Editable Post-Launch — HR can return and modify any field, triggering re-processing through the pipeline"
> - Another annotation: "Form data becomes the 'Source of Truth' referenced by ALL downstream agents"
>
> Include a data flow legend showing: Green arrows = User Actions, White arrows = System Processing, Dashed arrows = Editable/Revisable connections. Use clean sans-serif typography, subtle card shadows, and form field mockup styling.

---

## PROMPT 3: Phase 1 — Research & Strategy (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 1: Research & Strategy — Detailed Workflow" with subtitle "Agent 1 (Domain Architect) + Agent 2 (Copywriter & SEO)". Use a blue (#3b82f6) color theme for headers and accents.
>
> Layout top-to-bottom with 4 horizontal swim lanes:
>
> **Lane 1: "Input Layer"**
> - Start node: "Kickoff Form Data received from Phase 0" (green-bordered card)
> - Exploded into data points flowing down: Role Title, Seniority, Skills, Location, Salary Range, Context Notes, Red Flags, Strictness Level
>
> **Lane 2: "Agent 1 — Domain Architect" (magnifying glass icon)**
> Step-by-step workflow flowing left to right:
> - Step 1: "Parse Role Requirements" — extract structured fields from kickoff data
> - Step 2: "Industry Research" — query market data for role benchmarks (salary ranges, typical requirements, competitor analysis)
> - Step 3: "Skill Taxonomy Mapping" — map must-have/nice-to-have skills to industry-standard skill trees, identify adjacent skills and certifications
> - Step 4: "Competitor Role Analysis" — analyze similar JDs from competing companies, identify differentiators
> - Step 5: "Red Flag Profile Building" — create a structured checklist of what to screen against (from HR input + industry patterns)
> - Step 6: "Seniority Calibration" — define what the seniority level means for THIS specific role (years, scope, leadership expectations)
> - Output (document icon): **"Role Strategy Document"** containing: Ideal Candidate Profile, Skill Weight Matrix (must-have scores vs nice-to-have), Market Salary Benchmark, Competitor Landscape Brief, Red Flag Checklist, Seniority Definition, Interview Focus Areas
>
> **Lane 3: "Agent 2 — Copywriter & SEO" (pen icon)**
> Step-by-step workflow:
> - Step 1: "Ingest Role Strategy Document" from Agent 1
> - Step 2: "Tone & Voice Selection" — match company culture (formal/startup/creative) using context from kickoff
> - Step 3: "JD Structure Generation" — create sections: About Us, Role Overview, Responsibilities, Requirements, Nice-to-Haves, Benefits, Application Process
> - Step 4: "SEO Optimization" — keyword research for job boards, title optimization for search ranking, meta-description generation
> - Step 5: "Inclusive Language Review" — scan for biased language, gendered terms, exclusionary phrases; suggest alternatives
> - Step 6: "Multi-Platform Formatting" — generate variants: LinkedIn post (short), Indeed listing (structured), Company careers page (branded), Email outreach (personalized)
> - Output: **"Published JD"** (multiple format variants ready for distribution)
>
> **Lane 4: "Feedback & Iteration"**
> - "Reach Loop" incoming arrow (blue curve) from Phase 3-4 labeled "Low volume signal — JD not attracting enough candidates"
> - Decision diamond: "Rewrite Trigger?" → Yes: "Agent 2 regenerates JD with broader terms / adjusted requirements" → feeds back to Lane 3 Step 3
> - "HR Override" dashed arrow: "HR can manually edit Published JD at any time"
> - Output arrow: "Finalized JD → Triggers Phase 2 (Headhunter Engine)"
>
> Legend: Blue arrows = Agent Processing, Green arrows = Data Input, Orange arrows = Feedback Loop (Reach Loop), Dashed = Human Override. Show each step as a rounded rectangle with a small step number badge. Include mini-icons for each step.

---

## PROMPT 4: Phase 2 — Headhunter Engine (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 2: Headhunter Engine — Detailed Workflow" with subtitle "Agent 3 (Outbound Hunter) + Agent 4 (Acquisition Manager)". Use an amber/orange (#f59e0b) color theme for headers and accents.
>
> Layout top-to-bottom with 4 horizontal swim lanes:
>
> **Lane 1: "Input Layer"**
> - "Published JD" from Phase 1 (blue-bordered card)
> - "Role Strategy Document" from Agent 1 (blue-bordered card)
> - Both feed into Lane 2
>
> **Lane 2: "Agent 3 — Outbound Hunter" (radar/target icon)**
> Sub-label: "Reputation Engine"
> Step-by-step workflow:
> - Step 1: "Channel Strategy Selection" — determine optimal sourcing channels: LinkedIn, GitHub, Stack Overflow, niche job boards, university networks, professional communities, competitor employee directories
> - Step 2: "Search Query Generation" — create Boolean search strings, skill-based queries, title variations, location filters for each channel
> - Step 3: "Candidate Discovery" — execute searches across channels, scrape public profiles, parse results
> - Step 4: "Reputation Scoring" — for each discovered candidate: GitHub commit frequency & quality, Stack Overflow reputation, LinkedIn endorsements & recommendations, published articles/talks, open source contributions, professional certifications
> - Step 5: "Duplicate Detection" — cross-reference against existing candidate pool, merge profiles from multiple channels
> - Step 6: "Initial Ranking" — score candidates based on: skill match (40%), experience match (25%), reputation score (20%), location/availability (15%)
> - Step 7: "Volume Management" — ensure pipeline has minimum viable candidate flow; if volume too low, expand search parameters
> - Output: **"Ranked Candidate Pool"** — scored list of candidates with profile data, reputation scores, and source channel
>
> **Lane 3: "Agent 4 — Acquisition Manager" (handshake/megaphone icon)**
> Sub-label: "5 Scenarios (A-E)"
> Step-by-step workflow:
> - Step 1: "Candidate Segmentation" — group candidates by engagement likelihood: A (Active job seeker), B (Passive but open), C (Happily employed), D (Career changer), E (Referral/warm intro)
> - Step 2: "Scenario A — Active Seekers" — direct application link, straightforward JD, quick response promise (24h)
> - Step 3: "Scenario B — Passive/Open" — personalized outreach highlighting role uniqueness, career growth angle, salary transparency
> - Step 4: "Scenario C — Happily Employed" — long-game nurture sequence, thought leadership content, company culture showcase, "no pressure" positioning
> - Step 5: "Scenario D — Career Changers" — transferable skills emphasis, mentorship/training highlights, growth trajectory messaging
> - Step 6: "Scenario E — Referral/Warm" — mutual connection leverage, insider perspective sharing, fast-track process offer
> - Step 7: "Message Personalization Engine" — customize each outreach message with candidate-specific details (projects, skills, mutual connections)
> - Step 8: "Multi-Channel Delivery" — send via optimal channel per candidate: email, LinkedIn InMail, Twitter DM, platform-specific messaging
> - Step 9: "Response Tracking" — monitor open rates, reply rates, engagement per scenario; feed metrics to optimization
> - Output: **"Engaged Candidate Pipeline"** — candidates who responded/applied, with engagement score and communication history
>
> **Lane 4: "Feedback Loops"**
> - "Noise Loop" incoming (orange curve) from Phase 3-4: "Too many unqualified candidates passing through" → "Agent 3 tightens search criteria, Agent 4 adjusts qualifying questions in outreach"
> - "Reach Loop" outgoing (blue curve) to Phase 1: "Not enough candidates in pipeline" → "Signal Agent 2 to broaden JD language"
> - Metrics dashboard mini-card showing: "Outreach Volume, Response Rate, Qualification Rate, Channel Performance, Scenario Effectiveness"
> - Output arrow: "Engaged candidates → Phase 3-4 (Screening)"
>
> Legend: Orange arrows = Agent Processing, Blue arrows = Cross-Phase Data, Green curves = Noise Loop feedback, Blue curves = Reach Loop feedback. Each scenario (A-E) shown as a distinct colored sub-card within Agent 4's workflow.

---

## PROMPT 5: Phase 3-4 — Screening (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 3-4: Screening — Detailed Workflow" with subtitle "Agent 5 (Forensic Analyst) + Agent 6 (Gatekeeper)". Use a purple (#a855f7) color theme for headers and accents.
>
> Layout top-to-bottom with 5 horizontal swim lanes:
>
> **Lane 1: "Input Layer"**
> - "Candidate Applications / Engaged Candidates" from Phase 2 (orange-bordered card)
> - Each candidate card shows: Name, Resume/CV, Source Channel, Reputation Score, Communication History
> - "Role Strategy Document" reference (blue-bordered) for screening criteria
>
> **Lane 2: "Agent 5 — Forensic Analyst" (detective magnifying glass icon)**
> Sub-label: "Resume Score + Suspicion Report"
> Step-by-step workflow:
> - Step 1: "Resume Parsing" — extract structured data: work history (company, title, duration), education, skills, certifications, projects, publications using Gemini AI
> - Step 2: "Employment Timeline Analysis" — detect gaps >6 months, short tenures (<1 year pattern), career trajectory (upward/lateral/downward), overlapping dates
> - Step 3: "Skill Verification" — cross-reference claimed skills against: project descriptions (do they match?), seniority level (appropriate depth?), industry norms (realistic combinations?)
> - Step 4: "Education Verification" — validate institution names, degree relevance, graduation timeline plausibility, certification currency
> - Step 5: "Claim Consistency Check" — compare resume claims against: LinkedIn profile (if available), GitHub activity, published work, reputation data from Agent 3
> - Step 6: "Suspicion Flagging" — flag: inflated titles, buzzword stuffing without substance, copy-paste JD descriptions, inconsistent dates, impossible skill breadth for experience level
> - Step 7: "Scoring Algorithm" — weighted score calculation: Skill Match (35%), Experience Relevance (25%), Red Flag Absence (20%), Education Fit (10%), Reputation Bonus (10%)
> - Decision Diamond: **"Score >= 70?"**
>   - YES path (green arrow) → flows to Agent 6
>   - NO path (red arrow) → "Auto-Reject" node → "Rejection Email Sent" → "Candidate archived with score + reasons"
> - Output: **"Resume Score + Suspicion Report"** — numerical score, detailed breakdown, flagged concerns, confidence level
>
> **Lane 3: "Agent 6 — Gatekeeper" (shield/gate icon)**
> Sub-label: "Pre-Screening Questions"
> Step-by-step workflow:
> - Step 1: "Receive Passing Candidates" (score >= 70) with their Suspicion Report
> - Step 2: "Question Selection" — dynamically choose 3-5 pre-screening questions based on: role requirements (technical/behavioral), suspicion flags (targeted probes), seniority level (depth of questions), candidate scenario type (A-E from Phase 2)
> - Step 3: "Question Categories" shown as sub-cards: Availability & Logistics (start date, visa, relocation), Salary Expectations (range alignment check), Technical Verification (1-2 targeted questions addressing suspicion flags), Motivation Assessment (why this role, why now), Deal-Breaker Check (travel, on-call, specific requirements)
> - Step 4: "Response Collection" — send questions via email/platform, set 48-hour response window
> - Step 5: "Response Analysis" — AI evaluation of answers: completeness, honesty signals, enthusiasm level, red flag triggers
> - Step 6: "Final Gate Decision" — Decision Diamond: **"PASS or FAIL?"**
>   - PASS (green arrow) → "Interview Link Generated (UUID token)" → "Interview Invite Email Sent" → flows to Phase 5
>   - FAIL (red dashed arrow) → "Rejected" node → "Rejection with reason logged"
>
> **Lane 4: "Feedback Loop Outputs"**
> - "Noise Loop" (orange curve outgoing to Phase 2): when too many candidates score 60-69 (borderline), signal "Adjust outreach targeting — candidates are close but not matching"
> - "Noise Loop" data: "Adjust questions" — if certain pre-screening questions have >80% failure rate, flag to Agent 4 to add qualifying questions to outreach
> - "Reach Loop" (blue curve outgoing to Phase 1): when total passing candidates < minimum threshold, signal "Broaden JD requirements"
> - "Update screening rules" arrow: HR can adjust the score threshold (default 70) and add/remove red flag rules
>
> **Lane 5: "Metrics & Logging"**
> - Mini dashboard: Pass Rate %, Average Score, Top Rejection Reasons, Suspicion Flag Distribution, Time-to-Screen per candidate, Gatekeeper Pass/Fail ratio
> - "All decisions logged with full audit trail for compliance"
>
> Legend: Purple arrows = Agent Processing, Green arrows = Pass Path, Red dashed arrows = Rejection Path, Orange curves = Noise Loop, Blue curves = Reach Loop. Show the score >= 70 threshold prominently as a dividing line.

---

## PROMPT 6: Phase 5 — The Interview (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 5: The Interview — Detailed Workflow" with subtitle "Agent 7 (Interview Architect) + Agent 8 (Question Optimizer) + Agent 9 (Voice Interrogator) + Agent 10 (Adjudicator)". Use a teal/cyan (#06b6d4) color theme for headers and accents.
>
> Layout top-to-bottom with 6 horizontal swim lanes:
>
> **Lane 1: "Input Layer"**
> - "Interview Link Clicked by Candidate" (green start node) — candidate opens /interview/[token] in browser
> - Data flowing in from previous phases: Role Strategy Document (from Agent 1), Published JD (from Agent 2), Resume Score + Suspicion Report (from Agent 5), Pre-Screening Answers (from Agent 6), Red Flags list (from Phase 0 kickoff)
>
> **Lane 2: "Agent 7 — Interview Architect" (blueprint icon)**
> Step-by-step workflow:
> - Step 1: "Context Assembly" — gather all candidate-specific data: resume parsed data, suspicion flags, pre-screening answers, role requirements, company context
> - Step 2: "Interview Strategy Selection" — based on Interview Style Preference from kickoff form: Technical Deep-Dive (heavy coding/system design), Behavioral Focus (STAR method, past experience), Culture Fit (values alignment, team dynamics), Balanced (mix of all)
> - Step 3: "Question Bank Generation" — create 15-25 questions organized by category: Opening/Rapport (2-3 questions), Technical Competency (5-8 questions), Behavioral/Situational (4-6 questions), Red Flag Probes (2-4 targeted questions based on suspicion report), Culture/Motivation (2-3 questions), Candidate Questions (allow candidate to ask)
> - Step 4: "Difficulty Calibration" — adjust question depth to match seniority level: Junior (fundamentals, willingness to learn), Mid (practical application, problem-solving), Senior (architecture, trade-offs, leadership), Lead+ (strategy, mentoring, organizational impact)
> - Step 5: "Interview Flow Design" — create a structured flow with branching logic: if candidate struggles on topic → pivot to adjacent easier question; if candidate excels → probe deeper with follow-ups
> - Output: **"Interview Blueprint"** — structured question bank with flow logic, timing targets, and evaluation rubric per question
>
> **Lane 3: "Agent 8 — Question Optimizer" (tuning/dial icon)**
> Sub-label: "Cold-start → Proxy signals → Full correlation"
> Step-by-step workflow:
> - Step 1: "Cold-Start Phase" — for new roles with no historical data, use industry-standard question effectiveness benchmarks
> - Step 2: "Proxy Signal Analysis" — analyze patterns from similar roles: which question types best differentiate strong vs weak candidates, optimal question ordering for engagement, time-per-question benchmarks
> - Step 3: "Full Correlation" (after sufficient interviews) — correlate: questions asked ↔ candidate scores ↔ eventual hire success, identify which questions are most predictive of job performance
> - Step 4: "Question Pruning" — remove questions with low predictive value, replace with higher-signal alternatives
> - Step 5: "Anti-Gaming Detection" — identify questions whose answers are easily rehearsed/Googled, rotate question variants to prevent candidate coaching
> - Step 6: "Real-Time Adaptation" — during the interview, suggest follow-up questions based on candidate's previous answers
> - Output: **"Optimized Question Set"** fed to Agent 9 in real-time
> - "Liar Loop" output (red curve): "Question effectiveness data" flowing back — if questions aren't catching dishonest candidates (verified post-hire), flag for replacement
>
> **Lane 4: "Agent 9 — Voice Interrogator" (microphone + waveform icon)**
> Sub-label: "Deepgram STT + Gemini + TTS | Behavioral Probing | Claim Flagging"
> This is the LIVE INTERVIEW lane — show it prominently as the largest section:
> - Step 1: "Session Initialization" — Deepgram WebSocket connection established, Gemini chat session created with system prompt (interviewer personality: "Wayne" for Round 1, "Atlas" for Round 2), conversation history initialized
> - Step 2: "Greeting & Rapport" — AI interviewer introduces itself, explains the process, puts candidate at ease (scripted opening from Interview Blueprint)
> - Step 3: "Core Interview Loop" (shown as a circular flow within this step):
>   - 3a: "Listen" — Deepgram STT captures candidate speech in real-time, converts to text transcript
>   - 3b: "Analyze" — Gemini processes candidate's answer: content quality, relevance to question, depth of understanding, consistency with resume claims
>   - 3c: "Behavioral Signals" — detect: confidence level (hesitation patterns), specificity (vague vs detailed), consistency (contradictions with earlier answers), enthusiasm, red flag triggers
>   - 3d: "Respond" — Gemini generates contextual follow-up or next question, adapts tone and difficulty based on candidate performance
>   - 3e: "Speak" — Deepgram TTS converts AI response to natural speech, plays to candidate
>   - 3f: "Log" — full transcript logged in real-time, behavioral flags annotated
>   - Arrow loops back to 3a
> - Step 4: "Claim Flagging" — during interview, when candidate makes verifiable claims (specific project outcomes, metrics, technologies used), flag for post-interview verification by Agent 10
> - Step 5: "Adaptive Difficulty" — if candidate performing well, increase difficulty; if struggling, offer a pivot to strength area (per Interview Blueprint branching logic)
> - Step 6: "Interview Conclusion" — thank candidate, explain next steps, provide timeline
> - Step 7: "Session Closure" — WebSocket closed, full transcript saved, behavioral flag summary generated, audio recording saved
> - Output: **"Complete Interview Transcript"** with annotated behavioral signals, flagged claims, and time-stamped conversation
>
> **Lane 5: "Agent 10 — Adjudicator" (gavel/scales icon)**
> Step-by-step workflow:
> - Step 1: "Transcript Ingestion" — receive full interview transcript + behavioral annotations + flagged claims
> - Step 2: "Technical Competency Scoring" — evaluate depth and accuracy of technical answers against role requirements (scored 1-10 per competency area)
> - Step 3: "Behavioral Assessment" — score STAR-method responses, leadership indicators, problem-solving approach, communication clarity
> - Step 4: "Consistency Analysis" — cross-reference interview claims with: resume data, pre-screening answers, reputation data; flag any contradictions
> - Step 5: "Red Flag Resolution" — for each suspicion flag from Agent 5: was it addressed in the interview? Was the explanation satisfactory? Upgrade/downgrade concern level
> - Step 6: "Claim Verification Report" — list all verifiable claims made during interview with verification status: Verified, Unverifiable, Suspicious, Contradicted
> - Step 7: "Overall Score Generation" — weighted final score: Technical (35%), Behavioral (25%), Communication (15%), Consistency (15%), Culture Fit (10%)
> - Step 8: "Candidate Dossier Generation" — comprehensive document containing: Executive Summary, Scores by Category, Interview Highlights, Red Flags (resolved/unresolved), Claims to Verify, Recommendation (Strong Yes / Yes / Maybe / No / Strong No), Suggested Round 2 Focus Areas (if applicable)
> - Output: **"Candidate Dossier + Claims to Verify"** → flows to Phase 6
>
> **Lane 6: "Feedback Loops"**
> - "Liar Loop" (red curve) — "Question effectiveness data" from Agent 10's consistency analysis feeds back to Agent 8: "These questions failed to catch inconsistencies — replace or augment"
> - "Question effectiveness data" arrow from Agent 10 back to Agent 8
> - Metrics mini-dashboard: Average Interview Duration, Question Effectiveness Scores, Behavioral Flag Frequency, Claim Verification Rate, Score Distribution
>
> Legend: Teal arrows = Agent Processing, Green arrows = Candidate Actions, Red curves = Liar Loop, Yellow annotations = Real-time events. Show the Voice Interrogator (Agent 9) lane as the largest and most detailed, with the circular interview loop prominently displayed. Use waveform graphics to indicate voice/audio elements.

---

## PROMPT 7: Phase 6 — Human Handoff (Detailed Workflow)

> Generate a detailed hierarchical swimlane workflow diagram on a dark charcoal background (#1a1a2e) titled "Phase 6: Human Handoff — Detailed Workflow" with subtitle "Finalist Dashboard + HR Decision Engine + Post-Decision Automation". Use a red/coral (#ef4444) color theme for headers and accents.
>
> Layout top-to-bottom with 5 horizontal swim lanes:
>
> **Lane 1: "Input Layer"**
> - "Candidate Dossier" arriving from Phase 5 Agent 10 (teal-bordered card) containing: Executive Summary, Category Scores, Interview Transcript, Red Flags, Claims to Verify, AI Recommendation
> - Multiple dossiers shown as a stack — representing multiple finalists for same role
>
> **Lane 2: "Finalist Dashboard" (monitor/dashboard icon)**
> Show as a detailed UI mockup-style wireframe:
> - **Header**: Role Title, Total Candidates Screened, Finalists Count, Days Open
> - **Candidate List Panel** (left side): Ranked list of finalists with: Name, AI Score, AI Recommendation badge (color-coded: green=Strong Yes, light green=Yes, yellow=Maybe, red=No), Source Channel icon, Interview Date
> - **Candidate Detail Panel** (right side, when candidate selected):
>   - Tab 1: "Executive Summary" — AI-generated 2-paragraph summary of the candidate
>   - Tab 2: "Scores Breakdown" — radar/spider chart showing Technical, Behavioral, Communication, Consistency, Culture Fit scores
>   - Tab 3: "Interview Transcript" — full searchable transcript with highlighted moments (strong answers in green, concerns in yellow, red flags in red)
>   - Tab 4: "Claims to Verify" — checklist of unverified claims with suggested verification methods
>   - Tab 5: "Red Flags" — detailed view of all flags with resolution status
>   - Tab 6: "Comparison" — side-by-side comparison with other finalists
> - **Action Buttons** (prominently displayed): "Advance" (green), "Hold" (yellow), "Reject" (red), "Note" (blue), "Reject with Reason" (dark red with text input)
>
> **Lane 3: "HR Decision Workflow"**
> Decision Diamond: "HR Reviews Dossier and Decides"
> - **Advance** (green arrow) → "Candidate moved to Round 2" → "Round 2 Interview Scheduled" → "Agent 7 generates Round 2 Blueprint (deeper technical + culture focus)" → "Round 2 conducted by 'Atlas' persona" → "Second Dossier generated" → "Final Decision"
>   - If Round 2 PASS → "Offer Stage" (see Lane 4)
>   - If Round 2 FAIL → "Rejection with detailed feedback"
> - **Hold** (yellow arrow) → "Candidate placed in Hold Queue" → "Auto-follow-up scheduled (7 days)" → "HR reminded to make decision" → returns to Decision Diamond
> - **Reject** (red arrow) → "Rejection logged with AI recommendation comparison" → "Rejection email sent" → "Candidate archived"
> - **Reject with Reason** (dark red arrow) → "HR enters specific reason" → "Reason logged for AI learning" → "Personalized rejection email generated" → "Feedback fed to Phase 3-4 screening rules for improvement"
> - **Note** (blue arrow) → "HR adds private note to candidate file" → "Note visible to all HR team members" → returns to Dashboard
>
> **Lane 4: "Offer & Engagement Pipeline"**
> - "Offer Stage" start node
> - Step 1: "Offer Letter Generation" — AI drafts offer letter using: role details, salary range, candidate expectations from pre-screening, company template
> - Step 2: "HR Review & Customize" — HR edits offer letter, adjusts terms
> - Step 3: "Offer Sent to Candidate" via email
> - Decision Diamond: "Candidate Response?"
>   - Accept → "Onboarding process initiated" → "Success! Pipeline Complete" (celebration node)
>   - Negotiate → "Counter-offer workflow" → HR adjusts → re-send
>   - Decline → "Decline reason logged" → "Next finalist auto-surfaced" → return to Dashboard
>
> **Lane 5: "Post-Decision Automation & Engagement"**
> - "Post-Round 2 Engagement Emails" timeline:
>   - 48 hours: "Thank you for your interview — we're reviewing all candidates" (warm, personalized)
>   - 7 days: "Update on your application status" (if no decision yet, keeps candidate warm)
>   - 14 days: "Final update" (either decision or timeline extension with explanation)
> - "Candidate Experience Monitoring": track email open rates, response sentiment, candidate satisfaction signals
> - "Talent Pool Management": rejected candidates with strong scores (>80) added to "Future Opportunities" pool with tags for what roles they'd be good for
> - "Analytics & Reporting": Pipeline conversion funnel, Time-to-hire metrics, Source channel effectiveness, AI vs HR decision alignment rate, Candidate experience scores
> - "Feedback to System": HR decisions (especially overrides of AI recommendations) fed back to improve: Screening thresholds (Phase 3-4), Interview question selection (Phase 5), Scoring algorithms (Agent 10)
>
> Legend: Red/coral arrows = Primary HR workflow, Green arrows = Positive outcomes (Advance/Accept), Yellow arrows = Hold/Pending, Red dashed arrows = Rejection paths, Blue arrows = Notes/Information, Gray arrows = Automation. Show the Dashboard wireframe as the centerpiece of this diagram with the most visual detail.

---

## USAGE NOTES

- **Generation Order**: Generate Prompt 1 (master overview) first for context, then generate each phase diagram (Prompts 2-7) as standalone detailed views
- **Consistency**: All diagrams share the same dark background, font style, and icon language for visual cohesion
- **Linking**: Each phase diagram should have small "from Phase X" and "to Phase X" connector nodes at edges to show how they connect to the master overview
- **Print/Presentation**: Each diagram is designed to work as a standalone slide in a presentation deck
- **Resolution**: Target 4K (3840x2160) or higher for readability of detailed elements
