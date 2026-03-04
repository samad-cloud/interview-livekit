#!/usr/bin/env python3
"""The Voice: Sends Tally eligibility forms to Dubai candidates OR interview links to others.
Also sends reminder emails to candidates who haven't completed their interview after 3 days."""

import os
import base64
from datetime import datetime, timezone
from email.mime.text import MIMEText
from urllib.parse import quote

from utils import get_supabase_client, get_gmail_service, log

# --- Configuration ---
COMPANY_NAME = "Printerpix"
MIN_SCORE = 50
INTERVIEW_BASE_URL = "https://printerpix-recruitment.vercel.app/interview"
ROUND2_BASE_URL = "https://printerpix-recruitment.vercel.app/round2"
TALLY_FORM_ID = os.environ.get("TALLY_FORM_ID", "")
REMINDER_AFTER_DAYS = 3

# Dubai eligibility email (HTML with Tally CTA button)
DUBAI_EMAIL_SUBJECT = f"Your Application to {COMPANY_NAME}: Let's Explore a Fit"

DUBAI_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Received – {company_name}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf5f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5f7; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:600px; box-shadow:0 4px 24px rgba(195,3,97,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c30361; padding:28px 36px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">{company_name}</h1>
            </td>
          </tr>

          <!-- Welcome heading -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0; color:#c30361; font-size:22px; font-weight:700; line-height:1.4;">
                Thank You for Applying &mdash; Let's Get Started
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 36px 32px;">

              <p style="margin:0 0 18px; color:#1f2937; font-size:15px; line-height:1.7;">
                Hi {first_name},
              </p>
              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                Thank you for applying to the <strong>{role_title}</strong> position at {company_name} &mdash; we're genuinely excited about the possibility of having you on the team!
              </p>
              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                To move things forward, our first step is a few quick questions to align on logistics and your availability for the role. This takes less than 5 minutes.
              </p>
              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                We're reviewing applications in real time and prioritizing strong fits, so completing it now is the fastest way to keep your candidacy moving ahead.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{tally_url}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="#a00250" fillcolor="#c30361">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Let's Get Started &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{tally_url}" target="_blank" style="display:inline-block; background-color:#c30361; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:16px 40px; border-radius:8px; line-height:1; letter-spacing:0.3px; border-bottom:3px solid #a00250;">
                      Let's Get Started &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix.recruitment@gmail.com" style="color:#c30361; text-decoration:underline;">printerpix.recruitment@gmail.com</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:600;">
                      Best regards,
                    </p>
                    <p style="margin:0 0 4px; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.5;">
                      John Poole
                    </p>
                    <p style="margin:0; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.5;">
                      Recruitment Manager, {company_name}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

# Direct interview invite (non-Dubai, also used for Dubai candidates who pass Tally)
INVITE_EMAIL_SUBJECT = f"You're Invited to an Interview with {COMPANY_NAME}"

INVITE_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation – {company_name}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf5f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5f7; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:600px; box-shadow:0 4px 24px rgba(195,3,97,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c30361; padding:28px 36px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">{company_name}</h1>
            </td>
          </tr>

          <!-- Welcome heading -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0; color:#c30361; font-size:22px; font-weight:700; line-height:1.4;">
                Thank you for applying! You're invited to your first interview at {company_name}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 36px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 18px; color:#1f2937; font-size:15px; line-height:1.7;">
                Hi {first_name},
              </p>

              <p style="margin:0 0 24px; color:#374151; font-size:15px; line-height:1.7;">
                At {company_name}, we're pioneering a better hiring process. To make our first conversation faster, fairer, and more focused on you, we use our own AI system. This approach helps remove bias and allows you to interview in a low-pressure environment, at a time that suits your energy and schedule.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-top:2px solid #fce7f0;">&nbsp;</td>
                </tr>
              </table>

              <!-- What to expect -->
              <p style="margin:0 0 16px; color:#c30361; font-size:16px; font-weight:700; line-height:1.5;">
                What to expect
              </p>

              <!-- Bullet points -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; The interview has a fixed number of questions and typically takes 15&ndash;20 minutes.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; We'll ask about your experience and how you've handled specific situations.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; Every response is personally reviewed by our HR team. The system helps us conduct the conversation, but real people evaluate your answers.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; If you complete this stage successfully, a member of our team will be in touch to invite you for a technical interview.</td>
                </tr>
              </table>

              <p style="margin:0 0 12px; color:#374151; font-size:15px; line-height:1.7;">
                We're moving quickly with qualified candidates, so completing this today or tomorrow helps keep your application on the fast track.
              </p>
              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                Our advice? Don't overthink it. Find a quiet spot, relax, and let your experience speak for itself.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{interview_link}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="#a00250" fillcolor="#c30361">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Start Your Interview &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{interview_link}" target="_blank" style="display:inline-block; background-color:#c30361; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:16px 40px; border-radius:8px; line-height:1; letter-spacing:0.3px; border-bottom:3px solid #a00250;">
                      Start Your Interview &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix.recruitment@gmail.com" style="color:#c30361; text-decoration:underline;">printerpix.recruitment@gmail.com</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:600;">
                      Best regards,
                    </p>
                    <p style="margin:0 0 4px; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.5;">
                      John Poole
                    </p>
                    <p style="margin:0; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.5;">
                      Recruitment Manager, {company_name}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# Reminder email for candidates who haven't completed their interview after 3 days
REMINDER_EMAIL_SUBJECT = f"Quick reminder: Your {COMPANY_NAME} application"

REMINDER_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Reminder – {company_name}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf5f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5f7; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:600px; box-shadow:0 4px 24px rgba(195,3,97,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c30361; padding:28px 36px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">{company_name}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <p style="margin:0 0 18px; color:#1f2937; font-size:15px; line-height:1.7;">
                Hi {first_name},
              </p>

              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                We noticed you started your application with us but haven't yet completed the interactive interview. We wanted to reach out in case you had any questions or ran into any technical issues.
              </p>

              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                We're still very interested in learning more about you, and the interview is still available for you to complete. It takes about {duration} and can be done at any time that works for you.
              </p>

              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                To keep your application moving forward, we'd appreciate if you could complete this within the next 2&ndash;3 days. We're reviewing candidates on a rolling basis and would love to include you in our upcoming review cycle.
              </p>

              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                Looking forward to hearing from you!
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{interview_link}" style="height:52px;v-text-anchor:middle;width:320px;" arcsize="12%" strokecolor="#a00250" fillcolor="#c30361">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Complete My Interview &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{interview_link}" target="_blank" style="display:inline-block; background-color:#c30361; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:16px 40px; border-radius:8px; line-height:1; letter-spacing:0.3px; border-bottom:3px solid #a00250;">
                      Complete My Interview &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you're experiencing any technical difficulties or have questions about the process, please email <a href="mailto:printerpix.recruitment@gmail.com" style="color:#c30361; text-decoration:underline;">printerpix.recruitment@gmail.com</a> and we'll be happy to help.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:600;">
                      Best regards,
                    </p>
                    <p style="margin:0 0 4px; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.5;">
                      John Poole
                    </p>
                    <p style="margin:0; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.5;">
                      Recruitment Manager, {company_name}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# Round 2 invite email (sent after delayed "human review" period)
ROUND2_EMAIL_SUBJECT = "Congratulations! You've been shortlisted for the {job_title} role"

ROUND2_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Round 2 Invitation – {company_name}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf5f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5f7; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:600px; box-shadow:0 4px 24px rgba(195,3,97,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c30361; padding:28px 36px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">{company_name}</h1>
            </td>
          </tr>

          <!-- Welcome heading -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0; color:#c30361; font-size:22px; font-weight:700; line-height:1.4;">
                The Next Milestone: Your Technical Deep Dive
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 36px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 18px; color:#1f2937; font-size:15px; line-height:1.7;">
                Hi {first_name},
              </p>

              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                Thank you for completing the first stage. We were truly impressed with your responses and are excited to invite you to the next round of our process.
              </p>

              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                This round is a <strong>Technical Deep Dive</strong>: a focused, conversational session (roughly 30&ndash;40 minutes) where we'll explore your problem-solving approach and architectural thinking in more detail. This is your opportunity to go deeper than the first interview by sharing new examples and expanding on your thinking.
              </p>

              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                The format is similar to your first interview and success here leads directly to the final stage: a live conversation with our team, where we'll discuss the role in more depth and answer any questions you may have. We're moving quickly with shortlisted candidates, so completing this within the next 48 hours helps keep your application on the fast track.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{round2_link}" style="height:52px;v-text-anchor:middle;width:320px;" arcsize="12%" strokecolor="#a00250" fillcolor="#c30361">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Start Technical Interview &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{round2_link}" target="_blank" style="display:inline-block; background-color:#c30361; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:16px 40px; border-radius:8px; line-height:1; letter-spacing:0.3px; border-bottom:3px solid #a00250;">
                      Start Technical Interview &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix.recruitment@gmail.com" style="color:#c30361; text-decoration:underline;">printerpix.recruitment@gmail.com</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:600;">
                      Best regards,
                    </p>
                    <p style="margin:0 0 4px; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.5;">
                      John Poole
                    </p>
                    <p style="margin:0; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.5;">
                      Recruitment Manager, {company_name}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def interpolate_template(template: str, vars: dict) -> str:
    """Replace {variable} placeholders in a template string. Safer than str.format()."""
    result = template
    for key, value in vars.items():
        result = result.replace(f'{{{key}}}', str(value))
    return result


def fetch_email_templates(supabase) -> dict:
    """Fetch email HTML templates from the prompts table. Returns empty dict on failure."""
    try:
        result = (
            supabase.table("prompts")
            .select("name, system_prompt")
            .in_("name", ["email_round1_invite", "email_round2_invite", "email_reminder", "email_dubai_form"])
            .execute()
        )
        templates = {}
        for row in (result.data or []):
            templates[row["name"]] = row["system_prompt"]
        return templates
    except Exception as e:
        log("WARN", f"Failed to fetch email templates from DB, using hardcoded fallbacks: {e}")
        return {}


def fetch_top_candidates(supabase):
    """Fetch graded candidates with score >= MIN_SCORE, joining jobs.location for Dubai detection.
    Only fetches candidates with created_at set (excludes old/legacy candidates)."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, jd_match_score, interview_token, job_id, jobs(title, location)")
        .eq("status", "GRADED")
        .gte("jd_match_score", MIN_SCORE)
        .not_.is_("created_at", "null")
        .execute()
    )
    return result.data


def is_dubai_role(candidate: dict) -> bool:
    """Check if the candidate's job is based in Dubai using jobs.location."""
    job = candidate.get("jobs")
    if not job:
        return False
    location = (job.get("location") or "").lower()
    return "dubai" in location


def create_email(to_email: str, subject: str, body: str, html: bool = False) -> dict:
    """Create an email message for the Gmail API."""
    subtype = "html" if html else "plain"
    message = MIMEText(body, subtype)
    message["to"] = to_email
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    return {"raw": raw_message}


def send_dubai_questionnaire(gmail_service, email: str, full_name: str, interview_token: str, role_title: str = "Open Position", template: str = ""):
    """Send the Dubai eligibility form email with Tally CTA button."""
    encoded_name = quote(full_name)
    first_name = full_name.split()[0] if full_name else "there"
    tally_url = f"https://tally.so/r/{TALLY_FORM_ID}?interview_token={interview_token}&candidate_name={encoded_name}"
    html_template = template or DUBAI_EMAIL_HTML
    body = interpolate_template(html_template, {
        "first_name": first_name,
        "role_title": role_title,
        "company_name": COMPANY_NAME,
        "tally_url": tally_url,
    })
    message = create_email(email, DUBAI_EMAIL_SUBJECT, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def send_interview_invite(gmail_service, email: str, full_name: str, interview_token: str, template: str = ""):
    """Send direct interview invite with secure token link."""
    first_name = full_name.split()[0] if full_name else "there"
    interview_link = f"{INTERVIEW_BASE_URL}/{interview_token}"
    html_template = template or INVITE_EMAIL_HTML
    body = interpolate_template(html_template, {
        "first_name": first_name,
        "interview_link": interview_link,
        "company_name": COMPANY_NAME,
    })
    message = create_email(email, INVITE_EMAIL_SUBJECT, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def update_candidate_status(supabase, candidate_id: int, status: str):
    """Update candidate status. Also sets invite_sent_at when sending invites."""
    update_data = {"status": status}
    if status in ("INVITE_SENT", "ROUND_2_INVITED"):
        update_data["invite_sent_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("candidates").update(update_data).eq("id", candidate_id).execute()


def fetch_form_completed_candidates(supabase):
    """Fetch Dubai candidates who passed the Tally eligibility form and need interview invites."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, interview_token")
        .eq("status", "FORM_COMPLETED")
        .not_.is_("created_at", "null")
        .execute()
    )
    return result.data


def fetch_candidates_needing_reminder(supabase):
    """Fetch candidates who were sent an interview invite 3+ days ago but haven't completed it.
    Only returns candidates who haven't already received a reminder and whose job is still active."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, interview_token, status, invite_sent_at, current_stage, job_id, jobs(is_active)")
        .in_("status", ["INVITE_SENT", "ROUND_2_INVITED"])
        .not_.is_("invite_sent_at", "null")
        .is_("reminder_sent_at", "null")
        .not_.is_("created_at", "null")
        .execute()
    )
    # Filter to only those where invite_sent_at is 3+ days ago and job is active
    now = datetime.now(timezone.utc)
    eligible = []
    for c in result.data:
        # Skip candidates whose job is no longer active
        job = c.get("jobs")
        if not job or not job.get("is_active"):
            continue

        sent_at = c.get("invite_sent_at")
        if not sent_at:
            continue
        # Parse the ISO timestamp
        sent_dt = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
        days_elapsed = (now - sent_dt).days
        if days_elapsed >= REMINDER_AFTER_DAYS:
            eligible.append(c)
    return eligible


def send_reminder_email(gmail_service, email: str, full_name: str, interview_link: str, is_round_2: bool = False, template: str = ""):
    """Send a reminder email to a candidate who hasn't completed their interview."""
    first_name = full_name.split()[0] if full_name else "there"
    duration = "30&ndash;40 minutes" if is_round_2 else "15&ndash;20 minutes"
    html_template = template or REMINDER_EMAIL_HTML
    body = interpolate_template(html_template, {
        "first_name": first_name,
        "interview_link": interview_link,
        "duration": duration,
        "company_name": COMPANY_NAME,
    })
    message = create_email(email, REMINDER_EMAIL_SUBJECT, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def run_reminders(supabase, gmail_service, template: str = "") -> int:
    """Send reminder emails to candidates who haven't completed their interview after 3 days.
    Returns the number of reminders sent."""
    candidates = fetch_candidates_needing_reminder(supabase)
    if not candidates:
        log("INFO", "No candidates need reminders")
        return 0

    log("INFO", f"Found {len(candidates)} candidate(s) needing reminders (sending max 1 per run)")

    for candidate in candidates:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]
            status = candidate.get("status", "")

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping reminder")
                continue

            # Use the correct link based on whether this is Round 1 or Round 2
            if status == "ROUND_2_INVITED":
                interview_link = f"{ROUND2_BASE_URL}/{interview_token}"
            else:
                interview_link = f"{INTERVIEW_BASE_URL}/{interview_token}"

            is_round_2 = status == "ROUND_2_INVITED"
            log("INFO", f"Sending reminder to {email} (status: {status})")
            send_reminder_email(gmail_service, email, full_name, interview_link, is_round_2=is_round_2, template=template)

            # Mark reminder as sent
            supabase.table("candidates").update({
                "reminder_sent_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", candidate_id).execute()

            log("SUCCESS", f"Reminder sent to {email}")
            # Rate limit: only send 1 reminder per run to avoid spam filters
            return 1

        except Exception as e:
            log("ERROR", f"Failed to send reminder to {candidate.get('email', 'unknown')}: {e}")

    return 0


def fetch_round_2_approved_candidates(supabase):
    """Fetch candidates approved for Round 2 whose scheduled send time has passed."""
    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, interview_token, job_id, jobs(title)")
        .eq("status", "ROUND_2_APPROVED")
        .not_.is_("round_2_invite_after", "null")
        .lte("round_2_invite_after", now)
        .not_.is_("created_at", "null")
        .execute()
    )
    return result.data


def send_round_2_invite(gmail_service, email: str, full_name: str, interview_token: str, job_title: str, template: str = ""):
    """Send Round 2 technical interview invite email."""
    first_name = full_name.split()[0] if full_name else "there"
    round2_link = f"{ROUND2_BASE_URL}/{interview_token}"
    subject = ROUND2_EMAIL_SUBJECT.format(job_title=job_title)
    html_template = template or ROUND2_EMAIL_HTML
    body = interpolate_template(html_template, {
        "first_name": first_name,
        "round2_link": round2_link,
        "job_title": job_title,
        "company_name": COMPANY_NAME,
    })
    message = create_email(email, subject, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def run_round_2_invites(supabase, gmail_service, template: str = "") -> int:
    """Send Round 2 invite emails to candidates whose scheduled time has arrived.
    Returns the number of invites sent."""
    candidates = fetch_round_2_approved_candidates(supabase)
    if not candidates:
        log("INFO", "No Round 2 invites ready to send")
        return 0

    log("INFO", f"Found {len(candidates)} Round 2 invite(s) ready to send")
    sent = 0

    for candidate in candidates:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping Round 2 invite")
                continue

            # Get job title from joined data
            job = candidate.get("jobs")
            job_title = job.get("title", "Open Position") if job else "Open Position"

            log("INFO", f"Sending Round 2 invite to {email} (job: {job_title})")
            send_round_2_invite(gmail_service, email, full_name, interview_token, job_title, template=template)
            update_candidate_status(supabase, candidate_id, "ROUND_2_INVITED")
            log("SUCCESS", f"Round 2 invite sent to {email}")
            sent += 1

        except Exception as e:
            log("ERROR", f"Failed to send Round 2 invite to {candidate.get('email', 'unknown')}: {e}")

    return sent


def run_mailer() -> tuple[int, int, int, int]:
    """
    Main mailer function - can be called from other modules.
    Returns tuple of (dubai_forms_sent, interview_invites_sent, reminders_sent, round_2_invites_sent).
    """
    log("INFO", "Starting outreach to top candidates...")

    supabase = get_supabase_client()
    gmail_service = get_gmail_service()

    # Fetch email templates from DB (fallback to hardcoded if unavailable)
    templates = fetch_email_templates(supabase)
    tmpl_invite = templates.get("email_round1_invite", "")
    tmpl_round2 = templates.get("email_round2_invite", "")
    tmpl_reminder = templates.get("email_reminder", "")
    tmpl_dubai = templates.get("email_dubai_form", "")

    dubai_sent, invites_sent, failed = 0, 0, 0

    # --- Phase 1: Send interview invites to Dubai candidates who passed Tally form ---
    form_completed = fetch_form_completed_candidates(supabase)
    if form_completed:
        log("INFO", f"Found {len(form_completed)} Dubai candidate(s) who passed eligibility form")

    for candidate in form_completed:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping")
                failed += 1
                continue

            log("INFO", f"Sending interview invite to eligible Dubai candidate {email}")
            send_interview_invite(gmail_service, email, full_name, interview_token, template=tmpl_invite)
            update_candidate_status(supabase, candidate_id, "INVITE_SENT")
            log("SUCCESS", f"Interview invite sent to {email}")
            invites_sent += 1

        except Exception as e:
            log("ERROR", f"Failed to process {candidate.get('email', 'unknown')}: {e}")
            failed += 1

    # --- Phase 2: Process newly graded candidates ---
    candidates = fetch_top_candidates(supabase)
    log("INFO", f"Found {len(candidates)} candidate(s) with score >= {MIN_SCORE}")

    for candidate in candidates:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            score = candidate.get("jd_match_score", 0)
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping")
                failed += 1
                continue

            if is_dubai_role(candidate):
                # Dubai role → Send Tally eligibility form
                job = candidate.get("jobs")
                job_title = job.get("title", "Open Position") if job else "Open Position"
                log("INFO", f"Dubai role detected for {email} (score: {score})")
                send_dubai_questionnaire(gmail_service, email, full_name, interview_token, job_title, template=tmpl_dubai)
                update_candidate_status(supabase, candidate_id, "QUESTIONNAIRE_SENT")
                log("SUCCESS", f"Dubai eligibility form sent to {email}")
                dubai_sent += 1
            else:
                # Non-Dubai role → Send interview link directly
                log("INFO", f"Non-Dubai role for {email} (score: {score}) - sending interview invite")
                send_interview_invite(gmail_service, email, full_name, interview_token, template=tmpl_invite)
                update_candidate_status(supabase, candidate_id, "INVITE_SENT")
                log("SUCCESS", f"Interview invite sent to {email}")
                invites_sent += 1

        except Exception as e:
            log("ERROR", f"Failed to process {candidate.get('email', 'unknown')}: {e}")
            failed += 1

    # --- Phase 3: Send delayed Round 2 invites (scheduled after "human review" period) ---
    try:
        round_2_sent = run_round_2_invites(supabase, gmail_service, template=tmpl_round2)
    except Exception as e:
        log("ERROR", f"Round 2 invite phase failed: {e}")
        round_2_sent = 0

    # --- Phase 4: Send reminders to candidates who haven't completed their interview ---
    try:
        reminders_sent = run_reminders(supabase, gmail_service, template=tmpl_reminder)
    except Exception as e:
        log("ERROR", f"Reminder phase failed: {e}")
        reminders_sent = 0

    log("INFO", f"Outreach complete: {dubai_sent} eligibility forms, {invites_sent} interview invites, {round_2_sent} round 2 invites, {reminders_sent} reminders, {failed} failed")
    return (dubai_sent, invites_sent, reminders_sent, round_2_sent)


def main():
    """Entry point when run directly."""
    run_mailer()


if __name__ == "__main__":
    main()
