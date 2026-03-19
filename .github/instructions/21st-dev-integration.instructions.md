# 🧩 LUMION HRIS — 21ST.DEV COMPONENT INTEGRATION PROMPT
> Governs how every 21st.dev component is adapted and where it lives in the app.

---

## ⚠️ INTEGRATION RULES (READ BEFORE TOUCHING ANY COMPONENT)

1. **Never use a 21st.dev component as-is.** Every component must be adapted to Lumion's design system before use.
2. **Strip all demo content** — placeholder text, example data, random Unsplash URLs, emoji, "NexusGate", "Loxt-MoZzI", etc.
3. **Replace hardcoded colors with CSS variables** — search each file for hex values (#06b6d4, #000000, #ffffff, etc.) and replace with `hsl(var(--foreground))`, `hsl(var(--background))`, `hsl(var(--border))`, etc.
4. **Remove icons** unless a component functionally requires them (e.g. eye icon on password toggle is functional — keep it). Decorative icons get removed.
5. **Override font** — remove any `font-signika`, `font-dm-sans`, `font-bold` styling from headings. Apply `font-display` (Instrument Serif) to page titles only; `font-sans` (Geist) everywhere else.
6. **Verify dark mode** on every component before marking it done.
7. **Install dependencies globally** — don't install per-component. If `framer-motion` is already installed, don't reinstall.

---

## 📦 GLOBAL DEPENDENCY INSTALL

All required dependencies installed to workspace root:
- Already done via: `pnpm add -w framer-motion @paper-design/shaders-react lucide-react class-variance-authority @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-icons`

---

## 🗂️ FILE PLACEMENT

All adapted components go here:

```
apps/web/src/
├── components/
│   └── ui/
│       ├── hero.tsx                  ← Public marketing page only
│       ├── clipped-shape-image.tsx   ← Employee spotlight
│       ├── image-swiper.tsx          ← Team/onboarding carousel
│       ├── activity-chart-card.tsx   ← Dashboard widget
│       ├── auth-login.tsx            ← Rename: gaming-login.tsx
│       └── ghost-404-page.tsx        ← 404 page
└── app/
    ├── (auth)/
    │   └── login/
    │       └── page.tsx              ← Uses auth-login.tsx
    └── not-found.tsx                 ← Uses ghost-404-page.tsx
```

---

## 🔐 COMPONENT 1: AUTH LOGIN PAGE
**Source:** `gaming-login.tsx` → **Rename to:** `auth-login.tsx`

### What to keep
- Video background component structure
- Glass card `backdrop-blur-sm bg-black/50 border border-white/10`
- Form structure (email + password + remember me toggle + submit)
- Toggle switch component

### What to REMOVE completely
- All references to "NexusGate" → replace with "Lumion HRIS"
- The tagline "Your gaming universe awaits" → remove
- "[Press Enter to join the adventure]" → remove
- Game emojis (⚔️ 🎮 🏆) → remove
- Social login buttons (Chrome, Twitter, Gamepad2) → remove
- Purple gradient glows on the title → remove
- `animate-pulse` on the subtitle → remove

### What to REPLACE
```tsx
// OLD title
<span className="relative inline-block text-3xl font-bold mb-2 text-white">
  NexusGate
</span>

// NEW title
<span className="relative inline-block font-display text-3xl font-normal text-white tracking-tight">
  Lumion HRIS
</span>
```

```tsx
// OLD subtitle
<p>Your gaming universe awaits</p>

// NEW subtitle
<p className="text-white/60 text-sm font-sans">
  Sign in to your workspace
</p>
```

```tsx
// OLD submit button (purple)
<button className="... bg-purple-600 hover:bg-purple-700 ...">
  Enter NexusGate
</button>

// NEW submit button (clean white)
<button className="w-full py-2.5 rounded-md bg-white text-black text-sm font-medium
                   hover:bg-white/90 transition-opacity disabled:opacity-50">
  {isSubmitting ? 'Signing in...' : 'Sign in'}
</button>
```

```tsx
// OLD social section
<div className="grid grid-cols-3 gap-3">
  <SocialButton icon={<Chrome />} name="Chrome" />
  ...
</div>

// NEW — remove social section entirely, replace with:
<p className="mt-6 text-center text-xs text-white/40">
  Lumion Technology · Privacy Policy · Terms
</p>
```

```tsx
// OLD forgot password link
<a href="#" className="text-sm text-white/80 ...">Forgot password?</a>

// NEW — keep but update text
<a href="/forgot-password" className="text-xs text-white/50 hover:text-white/80 transition-colors">
  Forgot password?
</a>
```

```tsx
// REMOVE "Don't have an account?" section
// HR admins create accounts — employees don't self-register
// Replace with:
<p className="mt-6 text-center text-xs text-white/40">
  Contact your HR administrator to get access.
</p>
```

### Video background
Replace the Pexels gaming video with a professional office/architecture video:
```tsx
<LoginPage.VideoBackground videoUrl="https://videos.pexels.com/video-files/3196003/3196003-uhd_2560_1440_25fps.mp4" />
// Abstract corporate architecture — dark, minimal, professional
```
Or use this static fallback gradient if video fails to load:
```tsx
// In VideoBackground component, add fallback:
className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
```

### Final page usage
```tsx
// app/(auth)/login/page.tsx
import LoginPage from '@/components/ui/auth-login'

export default function LoginPage_() {
  const handleLogin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) router.push('/dashboard')
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4">
      <LoginPage.VideoBackground videoUrl="https://videos.pexels.com/video-files/3196003/3196003-uhd_2560_1440_25fps.mp4" />
      <div className="relative z-20 w-full max-w-sm">
        <LoginPage.LoginForm onSubmit={handleLogin} />
      </div>
    </div>
  )
}
```

---

## 👻 COMPONENT 2: GHOST 404 PAGE
**Source:** `ghost-404-page.tsx` → **Keep filename**

### Changes required
```tsx
// 1. Remove the external ghost image from xubohuah.github.io
// It's an unreliable external CDN — replace with a simple SVG:

// Replace the Image component with:
<svg viewBox="0 0 120 120" className="w-20 h-20 md:w-28 md:h-28" fill="none">
  {/* Simple ghost shape */}
  <ellipse cx="60" cy="55" rx="38" ry="42" fill="hsl(var(--muted))" opacity="0.6"/>
  <rect x="22" y="55" width="76" height="42" fill="hsl(var(--muted))" opacity="0.6"/>
  {/* Wavy bottom */}
  <path d="M22 97 Q32 110 42 97 Q52 84 62 97 Q72 110 82 97 Q92 84 98 97 L98 97 L22 97Z"
        fill="hsl(var(--background))"/>
  {/* Eyes */}
  <ellipse cx="46" cy="52" rx="6" ry="8" fill="hsl(var(--background))"/>
  <ellipse cx="74" cy="52" rx="6" ry="8" fill="hsl(var(--background))"/>
</svg>

// 2. Update font classes
// Remove: font-signika, font-dm-sans
// These fonts are not in Lumion's stack

// OLD:
<span className="text-[80px] md:text-[120px] font-bold text-[#222222] opacity-70 font-signika">
  4
</span>

// NEW:
<span className="text-[80px] md:text-[120px] font-display font-normal text-foreground opacity-60">
  4
</span>

// 3. Update heading
// OLD: "Boo! Page missing!"
// NEW:
<h1 className="font-display text-3xl md:text-4xl font-normal text-foreground mb-4 opacity-70">
  Page not found.
</h1>

// 4. Update subtitle
// OLD: "Whoops! This page must be a ghost - it's not here!"
// NEW:
<p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
  The page you're looking for doesn't exist or you don't have access to it.
</p>

// 5. Update CTA button
// OLD: href="https://xubh.top/" "Find shelter"
// NEW:
<Link href="/dashboard"
  className="inline-block bg-foreground text-background px-6 py-2.5 rounded-md text-sm font-medium
             hover:opacity-90 transition-opacity">
  Back to dashboard
</Link>

// 6. Remove "What means 404?" link at the bottom
// Replace with nothing, or:
<p className="mt-8 text-xs text-muted-foreground/40">
  Error 404 · Page not found
</p>

// 7. Update background
// OLD: bg-white (hardcoded)
// NEW: bg-background (CSS variable, respects dark mode)
```

### Usage
```tsx
// app/not-found.tsx
import { NotFound } from '@/components/ui/ghost-404-page'

export default function NotFoundPage() {
  return <NotFound />
}
```

---

## 📊 COMPONENT 3: ACTIVITY CHART CARD
**Source:** `activity-chart-card.tsx` → **Keep filename**

This is the most ready-to-use component. Minimal changes needed.

### Changes required
```tsx
// 1. Remove the TrendingUp icon from CardDescription
// OLD:
<CardDescription className="flex items-center gap-1">
  <TrendingUp className="h-4 w-4 text-emerald-500" />
  +12% from last week
</CardDescription>

// NEW — remove icon, make percentage dynamic:
<CardDescription className="text-xs text-muted-foreground">
  {trend > 0 ? `+${trend}%` : `${trend}%`} from last {period.toLowerCase()}
</CardDescription>
```

```tsx
// 2. Update bar color to use foreground (not primary which might be navy)
// In the motion.div for bars:
className="w-full rounded-sm bg-foreground/80"
// NOT bg-primary — in dark mode primary flips to light, foreground stays correct
```

```tsx
// 3. Add trend prop to component interface
interface ActivityChartCardProps {
  title?: string
  totalValue: string
  data: ActivityDataPoint[]
  className?: string
  dropdownOptions?: string[]
  trend?: number      // ← ADD THIS
  period?: string     // ← ADD THIS
}
```

### Where to use in the dashboard
```tsx
// app/(dashboard)/page.tsx — Executive Dashboard

// Attendance activity card
<ActivityChartCard
  title="Attendance"
  totalValue="94%"
  trend={2}
  period="Week"
  data={attendanceData} // from /api/attendance/weekly-summary
  dropdownOptions={['This Week', 'This Month', 'This Quarter']}
/>

// Payroll activity card
<ActivityChartCard
  title="Payroll Cost"
  totalValue="₦48.2M"
  trend={-3}
  period="Month"
  data={payrollData} // from /api/payroll/monthly-trend
  dropdownOptions={['This Month', 'This Quarter', 'This Year']}
/>
```

### API endpoints to create for real data
```typescript
// GET /api/attendance/weekly-summary
// Returns: [{ day: 'Mon', value: 94 }, { day: 'Tue', value: 87 }, ...]
// Calculates: attendance rate per day for the current week

// GET /api/payroll/monthly-trend  
// Returns: [{ day: 'W1', value: 12400000 }, ...]
// Calculates: payroll disbursements per week for current month
```

---

## 🖼️ COMPONENT 4: CLIPPED SHAPE GALLERY
**Source:** `clipped-shape-image.tsx` → **Keep filename**

### Where to use
**Option A — Employee Spotlight on the Dashboard:**
Show 3 recently onboarded employees or recently promoted employees.

**Option B — Onboarding Welcome Screen:**
Show 3 images representing company culture (office, team, work environment).

### Changes required for Employee Spotlight
```tsx
// Create a wrapper component:
// components/dashboard/employee-spotlight.tsx

import ClippedShapeGallery from '@/components/ui/clipped-shape-image'
import { useQuery } from '@tanstack/react-query'

export function EmployeeSpotlight() {
  const { data: employees } = useQuery({
    queryKey: ['spotlight-employees'],
    queryFn: () => fetch('/api/employees/recent-hires').then(r => r.json())
  })

  const mediaItems = employees?.data?.slice(0, 3).map((emp, i) => ({
    src: emp.avatar || `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500`,
    alt: `${emp.firstName} ${emp.lastName}`,
    clipId: (['clip-another1', 'clip-another2', 'clip-another3'] as const)[i],
    type: 'image' as const
  }))

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        New Hires This Month
      </p>
      <ClippedShapeGallery mediaItems={mediaItems} className="border-0 p-0 bg-transparent" />
    </div>
  )
}
```

### Style overrides
```tsx
// In ClippedShapeGallery, override the className:
<section
  className={`grid grid-cols-3 gap-4 ${className || ''}`}
  // Remove: dark:bg-black bg-white border rounded-lg p-5
  // These are already handled by Lumion's card system
>
```

---

## 🃏 COMPONENT 5: IMAGE SWIPER
**Source:** `image-swiper.tsx` → **Keep filename**

### Where to use
**Employee Directory — "Meet The Team" view:**
A swipeable card stack of employee profile photos. Great for mobile.

**Onboarding Welcome Screen:**
Swipe through "Welcome to Lumion" cards with onboarding steps.

### Changes required
```tsx
// Replace the image URLs with real employee avatars from Supabase Storage.
// Create a wrapper:

// components/employees/team-swiper.tsx
import { ImageSwiper } from '@/components/ui/image-swiper'
import { useQuery } from '@tanstack/react-query'

export function TeamSwiper({ departmentId }: { departmentId?: string }) {
  const { data } = useQuery({
    queryKey: ['team-swiper', departmentId],
    queryFn: () => fetch(`/api/employees/avatars?dept=${departmentId || ''}`).then(r => r.json())
  })

  const imageUrls = data?.data
    ?.map(e => e.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400')
    .join(',')

  if (!imageUrls) return null

  return (
    <ImageSwiper
      images={imageUrls}
      cardWidth={200}
      cardHeight={280}
    />
  )
}
```

### Style overrides
```tsx
// In image-swiper.tsx, update the article card styling:

// OLD:
className="image-card absolute cursor-grab active:cursor-grabbing
           place-self-center border border-slate-400 rounded-xl
           shadow-md overflow-hidden will-change-transform"

// NEW:
className="image-card absolute cursor-grab active:cursor-grabbing
           place-self-center border border-border rounded-md
           overflow-hidden will-change-transform"
// border-slate-400 → border-border (CSS variable)
// rounded-xl → rounded-md (consistent with design system)
// shadow-md → removed (no shadows in Lumion)
```

---

## 🌈 COMPONENT 6: SHADER HERO
**Source:** `hero.tsx` → **DO NOT use inside the dashboard**

### Where it CAN be used
Only on the **public marketing/landing page** for Lumion HRIS (if you have one).

```
app/
└── (marketing)/
    └── page.tsx  ← Public landing page, not inside the app
```

### If used on landing page, changes required
```tsx
// 1. Remove the rotating "Loxt - Mozzi • 21st.dev is amazing" text
// In the bottom-right PulsingBorder section, remove the <motion.svg> with the textPath entirely

// 2. Replace hero text
// OLD:
<span>Beautiful</span>
<span>Shader</span>  
<span>Experiences</span>

// NEW:
<span className="block font-normal text-white/70 text-2xl tracking-wider mb-2">
  Human Resources
</span>
<span className="block font-display text-white text-7xl font-normal">
  Simplified.</span>
<span className="block font-sans font-light text-white/60 text-4xl italic">
  For Africa.
</span>

// 3. Replace navigation links
// Features → /features
// Pricing → /pricing
// Docs → /docs

// 4. Replace CTA buttons
// OLD: "View Pricing" and "Get Started"
// NEW: "See how it works" and "Request a demo"

// 5. Replace the badge text
// OLD: "✨ New Paper Shaders Experience"
// NEW: "Now available in Nigeria, Kenya & Ghana"
```

---

## 🛠️ COMMON MISTAKES TO AVOID

1. **Don't mix `font-black` with `font-display`** — Instrument Serif has no black weight. Use `font-normal` for display font headings.

2. **Don't keep `animate-pulse` on UI elements** — it's only acceptable on skeleton loaders, never on live UI elements in a professional HRIS.

3. **The video in auth-login must have a dark overlay** — ensure `bg-black/30 z-10` overlay is always present so the login card is readable.

4. **ActivityChartCard bars must NOT use `bg-primary`** — in Lumion's dark mode, `--primary` is light-colored. Use `bg-foreground/80` for bars that work in both modes.

5. **ClippedShapeGallery clip paths are SVG IDs** — if you render this component more than once on a page, the clip path IDs (`clip-another1`, `clip-another2`, `clip-another3`) will conflict. Prefix them with a unique ID if rendering multiple instances.

6. **The ImageSwiper uses a comma-separated string for images** — don't pass an array. Join with commas: `images={urls.join(',')}`.

7. **ghost-404-page imports `next/image`** — ensure your `next.config.ts` allows the Unsplash domain if using fallback URLs: `images: { domains: ['images.unsplash.com'] }`.

---

## ✅ INTEGRATION CHECKLIST

For each component, verify before marking done:

```
auth-login.tsx (from gaming-login.tsx)
[ ] "NexusGate" removed → "Lumion HRIS" in Instrument Serif
[ ] Game emojis removed
[ ] Purple glows removed
[ ] Social login buttons removed
[ ] Submit button uses white bg
[ ] Video changed to professional footage
[ ] "No account?" copy changed to "Contact HR admin"
[ ] Supabase auth.signInWithPassword() wired up
[ ] Error state shows Supabase error message
[ ] Dark mode: glass card readable on dark video
[ ] Mobile responsive at 375px

ghost-404-page.tsx
[ ] External ghost image removed
[ ] Ghost replaced with inline SVG
[ ] font-signika and font-dm-sans removed
[ ] Numbers use font-display
[ ] bg-white → bg-background
[ ] "Boo!" copy replaced with professional message
[ ] CTA links to /dashboard
[ ] "What means 404?" removed
[ ] Dark mode verified

activity-chart-card.tsx
[ ] TrendingUp icon removed from CardDescription
[ ] Bar color: bg-foreground/80 (not bg-primary)
[ ] trend and period props added
[ ] Two instances on dashboard wired to real API endpoints
[ ] Weekly attendance data: real Supabase query
[ ] Payroll trend data: real Supabase query
[ ] Dropdown changes trigger refetch

clipped-shape-image.tsx
[ ] Default media items removed
[ ] Wired to /api/employees/recent-hires
[ ] Employee avatars from Supabase Storage
[ ] Fallback Unsplash URL for employees without photo
[ ] className overrides remove default bg-white/bg-black

image-swiper.tsx
[ ] border-slate-400 → border-border
[ ] shadow-md removed
[ ] rounded-xl → rounded-md
[ ] Wired to real employee avatar API
[ ] Graceful handling of 0 employees

hero.tsx (marketing only)
[ ] "Loxt-MoZzI" rotating text REMOVED
[ ] Copy completely replaced with Lumion messaging
[ ] Nav links point to real routes
[ ] CTA buttons wired
[ ] Only used on public marketing page
```

---

## 📅 EXECUTION ORDER

1. ✅ Install dependencies globally (pnpm add -w ...)
2. → Copy source files to apps/web/src/components/ui/
3. → Adapt auth-login.tsx (video BG, text, buttons)
4. → Adapt ghost-404-page.tsx (SVG ghost, copy, button)
5. → Adapt activity-chart-card.tsx (remove icons, add trend/period props)
6. → Adapt clipped-shape-image.tsx (remove defaults, wire API)
7. → Adapt image-swiper.tsx (token colors, borders)
8. → Adapt hero.tsx last (marketing page only, lowest priority)
9. → Wire API endpoints once components render correctly with seed data
