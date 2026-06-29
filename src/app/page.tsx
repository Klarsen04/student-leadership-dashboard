import Link from "next/link";
import { Calendar, CheckSquare, Target, BookOpen, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            Student Leadership OS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
            Manage your campus leadership in one place
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Student Leadership OS helps student leaders organize their roles, track tasks,
            set goals, sync calendars, and reflect on their growth — all in a single dashboard
            built for busy campus leaders.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-base"
            >
              Get Started Free
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Calendar className="w-6 h-6 text-blue-600" />}
            title="Calendar Sync"
            description="Sync your Google and Microsoft calendars to see all your meetings, events, and commitments in one view."
          />
          <FeatureCard
            icon={<CheckSquare className="w-6 h-6 text-blue-600" />}
            title="Task Management"
            description="Track tasks across all your leadership roles with priorities, due dates, and progress tracking."
          />
          <FeatureCard
            icon={<Target className="w-6 h-6 text-blue-600" />}
            title="Goal Setting"
            description="Set and track goals for each semester and role. Monitor your progress with visual indicators."
          />
          <FeatureCard
            icon={<BookOpen className="w-6 h-6 text-blue-600" />}
            title="Reflections"
            description="Journal your leadership experiences, lessons learned, and personal growth over time."
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
            title="Analytics"
            description="Understand where your time goes with insights across your roles and commitments."
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
            title="Works on Any Device"
            description="Access your dashboard from your phone, tablet, or laptop. Install it as an app for quick access."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; 2026 Student Leadership OS
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:studentleadershipdashboard@gmail.com" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
}
