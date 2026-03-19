"use client"
import { useEffect, useRef, useState } from "react"
import { MeshGradient } from "@paper-design/shaders-react"
import { motion } from "framer-motion"

export default function ShaderShowcase() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = (event?: MediaQueryListEvent) => {
      setIsDark(event ? event.matches : media.matches)
    }

    sync()
    media.addEventListener("change", sync)

    return () => {
      media.removeEventListener("change", sync)
    }
  }, [])

  const baseGradient = isDark
    ? ["#05070B", "#0C2B36", "#1F2937", "#0B1220", "#0F172A"]
    : ["#F8FAFC", "#E2E8F0", "#CBD5E1", "#F1F5F9", "#E5E7EB"]

  const overlayGradient = isDark
    ? ["#020617", "#164E63", "#1E293B", "#111827"]
    : ["#FFFFFF", "#E2E8F0", "#D9F0F8", "#F8FAFC"]

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden bg-background">
      <MeshGradient className="absolute inset-0 h-full w-full" colors={baseGradient} speed={0.3} />
      <MeshGradient className="absolute inset-0 h-full w-full opacity-60" colors={overlayGradient} speed={0.2} />
      <div className="absolute inset-0 bg-background/45 dark:bg-black/35" />

      <header className="relative z-20 flex items-center justify-between p-6">
        <div className="font-display text-2xl font-normal text-foreground dark:text-white">Lumion HRIS</div>
        <nav className="flex items-center space-x-2">
          <a href="/features" className="text-foreground/80 dark:text-white/80 hover:text-foreground dark:hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-background/40 dark:hover:bg-white/10 transition-all">Features</a>
          <a href="/pricing" className="text-foreground/80 dark:text-white/80 hover:text-foreground dark:hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-background/40 dark:hover:bg-white/10 transition-all">Pricing</a>
          <a href="/docs" className="text-foreground/80 dark:text-white/80 hover:text-foreground dark:hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-background/40 dark:hover:bg-white/10 transition-all">Docs</a>
          <a href="/register" className="text-foreground/80 dark:text-white/80 hover:text-foreground dark:hover:text-white text-xs font-light px-3 py-2 rounded-full hover:bg-background/40 dark:hover:bg-white/10 transition-all">Register Company</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/register" className="h-8 rounded-full border border-foreground/25 px-4 py-2 text-xs font-normal text-foreground dark:border-white/30 dark:text-white flex items-center">Start Company</a>
          <a href="/login" className="h-8 rounded-full bg-foreground px-6 py-2 text-xs font-normal text-background dark:bg-white dark:text-black flex items-center">Sign in</a>
        </div>
      </header>

      <main className="absolute bottom-8 left-8 z-20 max-w-2xl">
        <motion.h1 className="mb-6 text-6xl leading-none tracking-tight text-foreground dark:text-white md:text-8xl"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
          <span className="mb-2 block text-2xl font-normal tracking-wider text-foreground/70 dark:text-white/70 md:text-4xl">Human Resources</span>
          <span className="block font-display text-6xl font-normal text-foreground dark:text-white md:text-7xl">Simplified.</span>
          <span className="block font-sans text-4xl font-light italic text-foreground/65 dark:text-white/60">For Africa.</span>
        </motion.h1>
        <motion.p className="mb-8 max-w-xl text-lg font-light text-foreground/70 dark:text-white/70"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }}>
          Payroll, leave, recruitment and performance — built for Nigerian and African businesses.
        </motion.p>
        <motion.div className="flex items-center gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1.0 }}>
          <a href="/register" className="rounded-full bg-foreground px-10 py-4 text-sm font-medium text-background transition-all hover:opacity-90 dark:bg-white dark:text-black">Create Company Workspace</a>
          <a href="/demo" className="rounded-full border border-foreground/25 px-10 py-4 text-sm font-medium text-foreground transition-all hover:bg-background/50 dark:border-white/30 dark:text-white dark:hover:bg-white/10">Request a demo</a>
        </motion.div>
      </main>
    </div>
  )
}
