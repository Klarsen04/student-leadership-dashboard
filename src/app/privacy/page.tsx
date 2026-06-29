export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-16 px-4">
      <div className="max-w-2xl mx-auto prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: June 28, 2026</p>

        <p>
          Student Leadership OS (&quot;we,&quot; &quot;our,&quot; or &quot;the app&quot;) is committed to
          protecting your privacy. This Privacy Policy explains how we collect, use, store,
          and share your information when you use our service.
        </p>

        <h2>Information We Collect</h2>
        <p>We collect information in the following ways:</p>

        <h3>Information you provide directly</h3>
        <ul>
          <li>Account information: name, email address, and password (if using email sign-up)</li>
          <li>Content you create: tasks, goals, reflections, and calendar events</li>
        </ul>

        <h3>Information from third-party sign-in</h3>
        <p>If you choose to sign in with Google or Microsoft, we receive:</p>
        <ul>
          <li>Your name, email address, and profile picture</li>
          <li>OAuth tokens to maintain your session</li>
        </ul>

        <h3>Google Calendar data</h3>
        <p>
          If you grant calendar access, we access your Google Calendar events in
          read-only mode. We retrieve event titles, times, locations, and descriptions
          solely to display them within the app. We do not modify, delete, or share your
          calendar data with any third party.
        </p>

        <h2>How We Use Your Information</h2>
        <p>We use collected information exclusively to:</p>
        <ul>
          <li>Authenticate your identity and maintain your session</li>
          <li>Display your calendar events alongside your tasks and goals</li>
          <li>Store and retrieve content you create within the app</li>
          <li>Provide data export functionality for your personal records</li>
        </ul>
        <p>
          We do <strong>not</strong> use your data for advertising, profiling, analytics
          beyond basic service operation, or any purpose unrelated to providing the app.
        </p>

        <h2>Data Sharing</h2>
        <p>
          We do not sell, rent, trade, or otherwise share your personal information with
          third parties. Your data is only accessed by the services required to operate
          the app:
        </p>
        <ul>
          <li><strong>Vercel</strong> — hosting and deployment</li>
          <li><strong>Google OAuth</strong> — authentication (if you choose Google sign-in)</li>
          <li><strong>Microsoft OAuth</strong> — authentication (if you choose Microsoft sign-in)</li>
        </ul>

        <h2>Data Storage and Security</h2>
        <p>
          Your data is stored in a secure database with encrypted connections. We implement
          industry-standard security measures including:
        </p>
        <ul>
          <li>HTTPS encryption for all data in transit</li>
          <li>Hashed passwords (never stored in plain text)</li>
          <li>Secure, HTTP-only session tokens</li>
          <li>Content Security Policy headers to prevent cross-site attacks</li>
        </ul>

        <h2>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. If you delete your
          account, all associated data is permanently removed from our systems within
          30 days.
        </p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> — Export all your data at any time via Settings</li>
          <li><strong>Correction</strong> — Update your information through the app</li>
          <li><strong>Deletion</strong> — Request complete deletion of your account and data</li>
          <li><strong>Revoke access</strong> — Disconnect Google or Microsoft access at any time
            through your Google/Microsoft account settings</li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>Our app integrates with the following services, each governed by their own privacy policies:</p>
        <ul>
          <li>
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google Privacy Policy
            </a>
          </li>
          <li>
            <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">
              Microsoft Privacy Statement
            </a>
          </li>
          <li>
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              Vercel Privacy Policy
            </a>
          </li>
        </ul>

        <h2>Google API Services User Data Policy</h2>
        <p>
          Student Leadership OS&apos;s use and transfer of information received from Google APIs
          adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          Our service is intended for college and university students. We do not knowingly
          collect information from children under 13. If you believe a child under 13 has
          provided us with personal information, please contact us so we can remove it.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make material changes,
          we will notify users through the app. Continued use of the service after changes
          constitutes acceptance of the updated policy.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise your data
          rights, contact us at:{" "}
          <a href="mailto:studentleadershipdashboard@gmail.com">studentleadershipdashboard@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
