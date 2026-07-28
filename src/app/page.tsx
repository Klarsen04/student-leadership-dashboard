import Link from "next/link";
import { Calendar, CheckSquare, Target, BookOpen, BarChart3, Sparkles, ArrowRight, Smartphone, Zap, Users } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      {/* Gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[15%] w-[45%] h-[45%] rounded-full bg-blue-600/15 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[30%] right-[20%] w-[25%] h-[25%] rounded-full bg-violet-600/10 blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center glow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">
            Leadership OS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="btn-gradient text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
          >
            Get Started
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="text-center max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/20 text-purple-300 text-xs font-medium mb-8 animate-pulse-glow">
            <Zap className="w-3.5 h-3.5" />
            Built for student leaders who do it all
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Your campus impact,
            <br />
            <span className="gradient-text">one dashboard.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Track tasks, set goals, reflect on growth, and stay on top of every
            leadership role — all in one beautiful, focused space.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="btn-gradient px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2.5 shadow-lg shadow-purple-500/25"
            >
              Start for Free
              <ArrowRight className="w-4.5 h-4.5" />
            </Link>
            <Link
              href="#features"
              className="px-6 py-3.5 rounded-xl font-medium text-base text-muted-foreground hover:text-foreground border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03] transition-all"
            >
              See Features
            </Link>
          </div>
        </div>

        {/* Floating UI Preview */}
        <div className="mt-20 relative mx-auto max-w-4xl">
          <div className="glass-card rounded-2xl p-1 glow">
            <div className="rounded-xl bg-[hsl(230,25%,8%)] p-6 border border-white/[0.04]">
              {/* Mock dashboard */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <div className="flex-1" />
                <div className="h-5 w-32 rounded bg-white/[0.06]" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Tasks Done", value: "12", color: "from-purple-500/20 to-purple-500/5" },
                  { label: "Goals Active", value: "4", color: "from-blue-500/20 to-blue-500/5" },
                  { label: "Streak", value: "7d", color: "from-emerald-500/20 to-emerald-500/5" },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-xl bg-gradient-to-br ${stat.color} border border-white/[0.06] p-4`}>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
                  <div className="h-4 w-24 rounded bg-white/[0.08]" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400/60" />
                      <div className="h-3 rounded bg-white/[0.06] flex-1" />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/[0.06] p-4 space-y-3">
                  <div className="h-4 w-20 rounded bg-white/[0.08]" />
                  <div className="flex items-end gap-1 h-16">
                    {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-gradient-to-t from-purple-500/40 to-blue-500/20"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect behind the card */}
          <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-violet-500/20 to-blue-500/30 rounded-3xl" />
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mt-32 scroll-mt-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to <span className="gradient-text">lead well</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              Purpose-built tools for the student who juggles clubs, classes, and everything in between.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            <FeatureCard
              icon={<CheckSquare className="w-5 h-5" />}
              title="Task Management"
              description="Kanban boards, priorities, pomodoro timer. See your day at a glance."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              title="Goal Tracking"
              description="Set semester goals, track progress with visual bars, celebrate milestones."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<BookOpen className="w-5 h-5" />}
              title="Reflections"
              description="Daily, weekly, monthly journals with wellness check-ins and gratitude prompts."
              gradient="from-amber-500 to-orange-500"
            />
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Analytics"
              description="Time budgets, streaks, completion trends. Know where your energy goes."
              gradient="from-emerald-500 to-teal-500"
            />
            <FeatureCard
              icon={<Calendar className="w-5 h-5" />}
              title="Calendar"
              description="Day, week, month views. Color-coded calendars with custom tags."
              gradient="from-rose-500 to-red-500"
            />
            <FeatureCard
              icon={<Smartphone className="w-5 h-5" />}
              title="Works Everywhere"
              description="PWA-ready. Install on your phone for native-like access anywhere, anytime."
              gradient="from-violet-500 to-indigo-500"
            />
          </div>
        </div>

        {/* Social proof / CTA */}
        <div className="mt-32 text-center">
          <div className="glass-card rounded-2xl p-12 max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
            <div className="relative">
              <div className="flex items-center justify-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/20 -ml-2 first:ml-0 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                ))}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to level up your leadership?
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Join student leaders who use Leadership OS to stay organized, grow intentionally, and make an impact.
              </p>
              <Link
                href="/login"
                className="btn-gradient px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2.5 shadow-lg shadow-purple-500/25"
              >
                Get Started — It&apos;s Free
                <ArrowRight className="w-4.5 h-4.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-muted-foreground">&copy; 2026 Leadership OS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <a href="mailto:studentleadershipdashboard@gmail.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, gradient }: { icon: React.ReactNode; title: string; description: string; gradient: string }) {
  return (
    <div className="group glass-card rounded-xl p-6 transition-all duration-300 hover:scale-[1.03] hover:bg-white/[0.06] relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
      <div className="relative">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 text-white shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
          {icon}
        </div>
        <h3 className="font-semibold text-base mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
