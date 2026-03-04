-- Add email template rows to the prompts table.
-- Both backend (mailer.py) and frontend (sendInvite.ts) fetch these at runtime.
-- Variables use {variable} format (Python-compatible string replacement).
-- Fallback to hardcoded HTML if fetch fails.

INSERT INTO prompts (name, label, description, system_prompt) VALUES
(
  'email_round1_invite',
  'Round 1 Invite Email',
  'HTML body sent to candidates with their first (personality) interview link. Variables: {first_name}, {interview_link}, {company_name}.',
  $html$<!DOCTYPE html>
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
</html>$html$
),
(
  'email_round2_invite',
  'Round 2 Invite Email',
  'HTML body sent to candidates invited to the technical interview. Variables: {first_name}, {round2_link}, {job_title}, {company_name}.',
  $html$<!DOCTYPE html>
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
                The format is similar to your first interview and success here leads directly to the final stage: a live conversation with our team, where we'll discuss the <strong>{job_title}</strong> role in more depth and answer any questions you may have. We're moving quickly with shortlisted candidates, so completing this within the next 48 hours helps keep your application on the fast track.
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
</html>$html$
),
(
  'email_reminder',
  'Interview Reminder Email',
  'HTML body sent to candidates who haven''t completed their interview after 3 days. Variables: {first_name}, {interview_link}, {duration}, {company_name}.',
  $html$<!DOCTYPE html>
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
</html>$html$
),
(
  'email_dubai_form',
  'Dubai Eligibility Form Email',
  'HTML body sent to Dubai-role candidates to complete the visa eligibility Tally form. Variables: {first_name}, {role_title}, {tally_url}, {company_name}.',
  $html$<!DOCTYPE html>
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
</html>$html$
);
