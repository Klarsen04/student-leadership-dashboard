export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-16 px-4">
      <div className="max-w-2xl mx-auto prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: June 28, 2026</p>

        <h2>Information We Collect</h2>
        <p>
          Student Leadership OS collects the following information when you create an account
          or sign in with Google:
        </p>
        <ul>
          <li>Your name and email address</li>
          <li>Profile picture (if signing in with Google)</li>
          <li>Calendar events (if you grant calendar access)</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>
          Your information is used solely to provide the Student Leadership OS service,
          including:
        </p>
        <ul>
          <li>Authenticating your identity</li>
          <li>Displaying your calendar events within the app</li>
          <li>Storing your tasks, goals, and reflections</li>
        </ul>

        <h2>Data Storage</h2>
        <p>
          Your data is stored securely and is not sold or shared with third parties.
          We use industry-standard security measures to protect your information.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          We use Google OAuth for authentication and calendar access. Google&apos;s use of
          your information is governed by the{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>.
        </p>

        <h2>Data Deletion</h2>
        <p>
          You can request deletion of your account and all associated data by contacting
          us at kirstylarsen3@gmail.com.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this privacy policy, contact us at kirstylarsen3@gmail.com.
        </p>
      </div>
    </div>
  );
}
