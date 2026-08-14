import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle,
  ChevronRight,
  Clock,
  EyeOff,
  HeartPulse,
  Leaf,
  Lock,
  Pill,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { ColorBends } from "@/components/landing/color-bends";
import { GooeyNav } from "@/components/landing/gooey-nav";
import { MagicBento } from "@/components/landing/magic-bento";
import { CardSwap } from "@/components/landing/card-swap";
import { FlowingMenu } from "@/components/landing/flowing-menu";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        throw redirect({ to: "/app" });
      }
      if (Capacitor.isNativePlatform()) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "SomaCare — Your AI Health Companion" },
      {
        name: "description",
        content:
          "SomaCare unifies your vitals, medications, appointments and a context-aware AI assistant into one calm, secure health workspace.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { label: "Home", href: "#hero" },
    { label: "Features", href: "#features" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "Security", href: "#security" },
  ];

  const features = [
    {
      title: "Health Vault",
      description:
        "Your complete health profile — conditions, allergies, medications, and emergency contacts in one secure place.",
      icon: <Stethoscope className="h-6 w-6" />,
      image: "/images/landing/feature-vault.svg",
      colSpan: 2,
    },
    {
      title: "Adwoa AI Assistant",
      description:
        "Chat about symptoms, upload reports, and get grounded answers that know your history.",
      icon: <Bot className="h-6 w-6" />,
      image: "/images/landing/feature-ai-chat.svg",
    },
    {
      title: "Live Vitals Tracking",
      description:
        "Blood pressure, glucose, heart rate, weight — visualized and trended in real time with intelligent alerts.",
      icon: <HeartPulse className="h-6 w-6" />,
      image: "/images/landing/feature-vitals.svg",
    },
    {
      title: "Wellness Integration",
      description:
        "Nutrition, fitness, sleep, hydration, and mood — with AI-generated plans that adapt to your goals.",
      icon: <Sparkles className="h-6 w-6" />,
      image: "/images/landing/feature-wellness.svg",
      colSpan: 2,
    },
    {
      title: "Smart Scheduling",
      description:
        "Your day at a glance — appointments, medications, meals, and workouts unified in one timeline.",
      icon: <Clock className="h-6 w-6" />,
      image: "/images/landing/feature-schedule.svg",
    },
    {
      title: "Medication Safety",
      description:
        "AI-powered medication verification — check for allergy conflicts and drug interactions.",
      icon: <Pill className="h-6 w-6" />,
      image: "/images/landing/feature-medverify.svg",
    },
  ];

  const testimonials = [
    {
      id: "1",
      title: "Transformed My Chronic Care",
      content:
        "SomaCare has completely transformed how I manage my Type 2 Diabetes. The AI actually knows my history and provides personalized advice that aligns with my treatment plan.",
      author: "Sarah M.",
      role: "Patient, Type 2 Diabetes",
    },
    {
      id: "2",
      title: "Peace of Mind for Caregivers",
      content:
        "As a caregiver, having all my mother's health data in one place with intelligent medication reminders has been life-changing. I finally feel organized and in control.",
      author: "James K.",
      role: "Caregiver",
    },
    {
      id: "3",
      title: "The Health App That Understands",
      content:
        "I've tried many health apps over the years, but SomaCare is the first one that actually understands my complete health picture. The AI assistant is remarkably context-aware.",
      author: "Maria L.",
      role: "Patient, Multiple Conditions",
    },
  ];

  const footerItems = [
    { label: "Features", href: "#features", description: "Discover what makes SomaCare different" },
    { label: "Security", href: "#security", description: "How we protect your health data" },
    { label: "Get Started", href: "/auth", description: "Begin your health journey" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <GooeyNav
        logo={{ image: "/images/branding/logo.svg", href: "/" }}
        items={navItems}
        cta={{ label: "Get Started", href: "/auth" }}
      />

      {/* Hero Section */}
      <section
        id="hero"
        className="relative min-h-screen flex items-center overflow-hidden"
        ref={heroRef}
      >
        {/* Green/black/white ColorBends background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-background/80" />
          <ColorBends
            className="absolute inset-0 opacity-30"
            colors={["#3f9b63", "#2f7d4d", "#57b276"]}
            speed={0.2}
            density={0.8}
          />
        </div>

        <div className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Headline, Tagline, CTA */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col space-y-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-surface/30 px-4 py-1.5 text-sm font-medium text-primary/90"
              >
                <Leaf className="h-4 w-4 text-[var(--primary)]" />
                Intelligent health management
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight"
              >
                Your health,
                <br />
                <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] bg-clip-text text-transparent">
                  simplified & secure
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="max-w-xl text-xl text-muted-foreground leading-relaxed"
              >
                SomaCare integrates your medical data, AI-powered insights, and daily health
                tracking into one elegant platform. Designed for real life, with privacy at its
                core.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-wrap gap-4"
              >
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="h-12 px-8 soma-gradient border-0 text-white shadow-lg hover:shadow-primary/30 transition-shadow"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 border-border/50 hover:bg-surface/50 transition-colors"
                  >
                    Discover Features
                  </Button>
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="grid grid-cols-3 gap-8 mt-8 text-sm"
              >
                {[
                  {
                    icon: <Lock className="h-5 w-5 text-[var(--primary)]" />,
                    k: "End-to-end",
                    v: "encryption",
                  },
                  {
                    icon: <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />,
                    k: "HIPAA-aligned",
                    v: "privacy",
                  },
                  {
                    icon: <EyeOff className="h-5 w-5 text-[var(--primary)]" />,
                    k: "Zero",
                    v: "data sharing",
                  },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-3">
                    {s.icon}
                    <div>
                      <div className="font-medium text-foreground">{s.k}</div>
                      <div className="text-muted-foreground">{s.v}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: Preview Card (Adwoa AI) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <div className="soma-card p-1 rounded-2xl shadow-2xl">
                <div className="p-6 md:p-8 bg-surface/50 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full soma-gradient">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Adwoa AI</div>
                      <div className="text-xs text-muted-foreground">Your health assistant</div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-xl rounded-tl-sm bg-secondary/60 p-4 text-sm">
                      My blood pressure was 142/90 this morning. Should I be concerned about this
                      reading?
                    </div>

                    <div className="rounded-xl rounded-tr-sm bg-[var(--primary)]/90 text-white p-4 text-sm">
                      This reading indicates elevated blood pressure. Given your history and current
                      medication, I recommend:
                      <ol className="mt-3 space-y-2 list-decimal list-inside">
                        <li>Logging this in your vitals tracker</li>
                        <li>Monitoring hydration levels</li>
                        <li>Reviewing with Dr. Wagner at your appointment</li>
                      </ol>
                      <div className="mt-3 text-xs opacity-80">
                        Would you like me to set a medication reminder?
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      {
                        l: "BP Trend",
                        v: "138/88",
                        sub: "7-day avg",
                        icon: <HeartPulse className="h-4 w-4 text-[var(--primary)]" />,
                      },
                      {
                        l: "Resting HR",
                        v: "68 bpm",
                        sub: "Normal",
                        icon: <HeartPulse className="h-4 w-4 text-[var(--primary)]" />,
                      },
                      {
                        l: "Sleep",
                        v: "7h 12m",
                        sub: "Last night",
                        icon: <ChevronRight className="h-4 w-4 text-[var(--primary)]" />,
                      },
                    ].map((s) => (
                      <div key={s.l} className="rounded-lg bg-surface p-3 text-center">
                        <div className="flex justify-center mb-1">{s.icon}</div>
                        <div className="text-xs text-muted-foreground">{s.l}</div>
                        <div className="font-medium text-foreground">{s.v}</div>
                        <div className="text-xs text-muted-foreground/80">{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-surface/30" ref={featuresRef}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-surface/30 px-4 py-1.5 text-sm font-medium text-primary/90 mb-6"
            >
              <Star className="h-4 w-4 text-[var(--primary)]" />
              Intelligent Health Platform
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
            >
              Everything you need for
              <br />
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] bg-clip-text text-transparent">
                better health management
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto mt-6 text-xl text-muted-foreground leading-relaxed"
            >
              SomaCare integrates your medical data, daily tracking, and AI-powered insights into
              one elegant platform. Designed for real life, with privacy and security at its core.
            </motion.p>
          </div>

          <div className="relative">
            <MagicBento cards={features} />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-surface/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-surface/30 px-4 py-1.5 text-sm font-medium text-primary/90 mb-6"
            >
              <Users className="h-4 w-4 text-[var(--primary)]" />
              Trusted by our community
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="font-display text-4xl md:text-5xl font-bold tracking-tight"
            >
              Real stories from
              <br />
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] bg-clip-text text-transparent">
                SomaCare users
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="max-w-2xl mx-auto mt-6 text-lg text-muted-foreground"
            >
              See how SomaCare is helping people take control of their health with confidence and
              clarity.
            </motion.p>
          </div>

          <div className="relative">
            <CardSwap cards={testimonials} autoPlay interval={8000} />
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-surface/30 px-4 py-1.5 text-sm font-medium text-primary/90 mb-6"
              >
                <Shield className="h-4 w-4 text-[var(--primary)]" />
                Privacy & Security
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="font-display text-4xl md:text-5xl font-bold tracking-tight"
              >
                Your health data,
                <br />
                <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] bg-clip-text text-transparent">
                  protected by design
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="mt-6 max-w-lg text-lg text-muted-foreground leading-relaxed"
              >
                SomaCare is built with enterprise-grade security and privacy protections. Your
                health data is encrypted end-to-end and never shared with third parties.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="mt-8 grid grid-cols-2 gap-8 text-sm"
              >
                {[
                  {
                    icon: <Lock className="h-5 w-5 text-[var(--primary)]" />,
                    k: "End-to-end",
                    v: "encryption",
                  },
                  {
                    icon: <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />,
                    k: "HIPAA-aligned",
                    v: "privacy",
                  },
                  {
                    icon: <EyeOff className="h-5 w-5 text-[var(--primary)]" />,
                    k: "Zero",
                    v: "data sharing",
                  },
                  {
                    icon: <CheckCircle className="h-5 w-5 text-[var(--primary)]" />,
                    k: "Regular",
                    v: "security audits",
                  },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-3">
                    {s.icon}
                    <div>
                      <div className="font-semibold">{s.k}</div>
                      <div className="text-muted-foreground">{s.v}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Visualization */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              viewport={{ once: true }}
            >
              <div className="soma-card p-1 rounded-2xl shadow-xl">
                <div className="p-8 bg-surface/50 rounded-xl backdrop-blur-sm">
                  {/* Green-themed security visualization */}
                  <div className="absolute inset-0 -z-10 opacity-10">
                    <div className="absolute top-0 left-0 w-full h-full">
                      <div className="absolute top-8 left-8 w-20 h-20 border-2 border-[var(--primary)] rounded-lg transform rotate-12" />
                      <div className="absolute top-16 right-8 w-16 h-16 border-2 border-[var(--primary)] rounded-lg transform -rotate-12" />
                      <div className="absolute bottom-8 left-1/2 w-24 h-24 border-2 border-[var(--primary)] rounded-full" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="grid h-12 w-12 place-items-center rounded-full soma-gradient">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Enterprise-grade security</div>
                      <div className="text-sm text-muted-foreground">
                        Built for healthcare data protection
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        icon: <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />,
                        title: "Data encryption",
                        desc: "At rest and in transit",
                      },
                      {
                        icon: <EyeOff className="h-4 w-4 text-[var(--primary)]" />,
                        title: "Privacy first",
                        desc: "Your data stays yours",
                      },
                      {
                        icon: <CheckCircle className="h-4 w-4 text-[var(--primary)]" />,
                        title: "Compliance ready",
                        desc: "GDPR & HIPAA inspired",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 p-3 rounded-lg bg-surface"
                      >
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--primary)]/10">
                          {item.icon}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-border/50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          {/* FlowingMenu Footer */}
          <div className="relative soma-card p-1 rounded-2xl shadow-xl mb-12">
            <div
              className="absolute inset-0 bg-cover bg-center rounded-2xl opacity-10"
              style={{ backgroundImage: "url(/images/landing/flowing-menu-bg.svg)" }}
            />
            <div className="relative z-10 p-8 md:p-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                  Your health journey,
                  <br />
                  <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] bg-clip-text text-transparent">
                    powered by trust
                  </span>
                </h2>
                <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
                  SomaCare is built by SomaLabsGH to help you take control of your health with
                  confidence, clarity, and privacy.
                </p>
              </motion.div>

              {/* FlowingMenu for Footer Links */}
              <div className="mt-12 flex justify-center">
                <FlowingMenu
                  items={footerItems}
                  backgroundImage="/images/landing/flowing-menu-bg.svg"
                />
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-border/50">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SomaLabsGH. All rights reserved.
            </div>
            <div className="text-sm text-muted-foreground">
              Not a substitute for professional medical advice
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
