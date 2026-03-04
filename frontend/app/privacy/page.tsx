export const metadata = {
  title: 'Privacy Policy - Printerpix Recruitment',
  description: 'Privacy Policy for the Printerpix AI Recruitment Platform',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: 20 February 2026</p>

        <p>
          Printerpix Ltd (&quot;Printerpix&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the
          Printerpix AI Recruitment Platform (the &quot;Service&quot;). This Privacy Policy explains how we
          collect, use, disclose, and safeguard your information when you interact with our Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Information We Collect</h2>

        <h3 className="text-lg font-medium mt-4 mb-2">Information You Provide</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Application data</strong> &mdash; name, email address, and resume/CV content submitted via email or uploaded by our HR team.</li>
          <li><strong>Interview responses</strong> &mdash; voice recordings, transcripts, and video recordings captured during AI-assisted interviews you choose to complete.</li>
          <li><strong>Questionnaire responses</strong> &mdash; answers you submit through eligibility forms (e.g. visa status).</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-2">Information Collected Automatically</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Browser type, IP address, and device information via standard web server logs.</li>
          <li>Cookies necessary for authentication (HR dashboard only).</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-2">Third-Party Services</h3>
        <p>We use the following services to operate the platform:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Google Gmail API</strong> &mdash; to send interview invitation emails to candidates on behalf of Printerpix Recruiting. We access Gmail in a send-only capacity; we do not read, modify, or store the contents of any inbox beyond messages our system originates.</li>
          <li><strong>Google Gemini API</strong> &mdash; to power AI interview conversations and score candidate responses.</li>
          <li><strong>Deepgram</strong> &mdash; for real-time speech-to-text transcription and text-to-speech during interviews.</li>
          <li><strong>Supabase</strong> &mdash; for database hosting and user authentication.</li>
          <li><strong>Vercel</strong> &mdash; for frontend hosting.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To evaluate your application for employment at Printerpix.</li>
          <li>To send interview invitations and status updates via email.</li>
          <li>To conduct AI-assisted voice interviews and generate transcripts.</li>
          <li>To produce interview scores, notes, and hiring recommendations for our HR team.</li>
          <li>To improve the accuracy and fairness of our recruitment process.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Data Sharing</h2>
        <p>
          We do <strong>not</strong> sell, rent, or trade your personal information. We share data only with:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Authorised Printerpix HR personnel who review your application.</li>
          <li>Third-party service providers listed above, solely to operate the Service under their respective privacy policies.</li>
          <li>Legal authorities when required by law or to protect our rights.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Retention</h2>
        <p>
          We retain candidate data for the duration of the recruitment process and up to 12 months
          afterwards for record-keeping and compliance purposes. You may request deletion of your data
          at any time by contacting us.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Security</h2>
        <p>
          We use industry-standard security measures including encrypted connections (TLS), secure
          database hosting, and access controls. However, no method of electronic transmission or
          storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data.</li>
          <li>Withdraw consent for data processing.</li>
          <li>Lodge a complaint with a supervisory authority.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Google API Services &mdash; Limited Use Disclosure</h2>
        <p>
          Our use of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>We only use Gmail API access to send outbound interview invitation emails.</li>
          <li>We do not use Gmail data for advertising, market research, or any purpose unrelated to the recruitment Service.</li>
          <li>We do not allow humans to read Gmail content unless required for security purposes, with user consent, or to comply with applicable law.</li>
          <li>We do not transfer Gmail data to third parties except as necessary to provide or improve the Service, for security purposes, or to comply with applicable law.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. Children&apos;s Privacy</h2>
        <p>
          The Service is not intended for individuals under 18 years of age. We do not knowingly
          collect personal information from children.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page
          with an updated effective date.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us:
        </p>
        <ul className="list-none pl-0 space-y-1 mt-2">
          <li><strong>Email:</strong> printerpix.recruitment@gmail.com</li>
          <li><strong>Company:</strong> Printerpix Ltd</li>
        </ul>
      </div>
    </div>
  );
}
