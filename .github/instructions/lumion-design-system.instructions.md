---
description: "Use when designing or editing Lumion HRIS frontend UI, dashboard screens, design system tokens, typography, Tailwind classes, page layouts, forms, tables, cards, charts, empty states, sidebar navigation, or shadcn/21st.dev component styling. Enforces Lumion's premium, restrained product design system."
name: "Lumion Design System"
applyTo: "apps/web/src/**/*.ts, apps/web/src/**/*.tsx, apps/web/src/**/*.css, packages/ui/src/**/*.ts, packages/ui/src/**/*.tsx, packages/ui/src/**/*.css"
---
# Lumion Design System

Lumion HRIS must feel precise, restrained, and inevitable. The product should read like a premium SaaS instrument, not a template dashboard.

## Core References

Borrow the feel of:
- Linear: dense, precise navigation and monochrome control
- Vercel Dashboard: typography hierarchy, borders, restraint
- Raycast: compact spacing and zero noise
- Notion: content-first layout and whitespace
- Loom: calm empty states and transitions
- Stripe Dashboard: dense but readable tables and data presentation

## Visual Rules

- Default to neutral surfaces with a single desaturated accent.
- Never use colorful admin-template styling, gradients, glassmorphism, blobs, or decorative backgrounds.
- No purple/blue-on-white SaaS gradient look.
- No icon-heavy layouts. Sidebar navigation should be text-first.
- No rounded-3xl cards, oversized shadows, glow effects, or ornamental UI.
- Cards are separated by border, not by loud backgrounds or heavy elevation.
- Remove visual noise before adding elements.

## Color Rules

- Use CSS variables only. No hardcoded hex colors in app or UI package components.
- Use the existing token system in globals.css as the source of truth.
- Cards should use border distinction, not tinted backgrounds.
- Status badges should use subtle tints only: semantic text color plus low-opacity background.
- Charts should use one base color with opacity variation, not multicolor palettes.
- Links should stay restrained; prefer neutral text with hover emphasis rather than bright blue.
- Destructive styling should be muted and only used where truly necessary.

## Typography Rules

- Page titles use the display face and should feel editorial, calm, and confident.
- UI body copy uses the sans face consistently.
- Do not introduce Inter, Roboto, or system-ui as the primary UI font.
- Numbers in tables and dashboards should use mono with tabular numerals.
- Labels are small, uppercase, tracked, and muted.
- Hierarchy comes from scale and weight, not decorative color.
- Avoid bold body copy; prefer medium at most.

## Spacing and Density

- Use Tailwind's default spacing scale only.
- Page shell spacing should center around px-6 and py-6.
- Cards should usually use p-5, compact cards p-4.
- Form sections should use space-y-4.
- Table cells should usually be px-4 py-3.
- Aim for Stripe-like density: information-rich, never cramped.
- Avoid arbitrary spacing values that break rhythm.

## Layout Rules

- Sidebar is fixed-width, text-first, and quiet.
- Desktop sidebar should not collapse by default.
- Active nav state should be subtle and structural, not colorful.
- Page headers should follow a consistent pattern: title, subdued description, minimal actions.
- Use wide tables for record-heavy pages.
- Use disciplined grids for overview pages, not decorative card mosaics.
- Settings and form-heavy pages should stay narrow and readable.

## Component Rules

### Cards
- Border only, subtle radius, minimal or no shadow.
- Do not use saturated card backgrounds.

### Buttons
- Primary: solid foreground/background contrast, no gradient.
- Secondary: outline.
- Ghost: quiet inline action.
- Destructive: muted red, no aggressive styling.

### Badges
- Text only plus subtle background tint.
- No icons inside badges.

### Tables
- No zebra striping.
- No vertical borders between columns.
- Hover states should be barely visible.
- Numeric columns are right-aligned and use mono tabular numerals.
- Actions should stay visually quiet until needed.

### Forms
- Labels always sit above fields.
- Placeholders do not replace labels.
- Inputs should be neutral and border-led.
- Validation messages should be concise.

### Empty States
- Prefer text plus one CTA.
- No large illustrations or mascot-like filler.

### Loading States
- Prefer skeletons that mirror final layout.
- Do not show isolated spinners on blank pages.

## Motion Rules

- Use transition-colors duration-150 for most interactive states.
- Keep animation limited to small fades or Radix-controlled primitives.
- Page entry may use a short fade with tiny upward motion.
- No parallax, confetti, glow pulses, or decorative motion systems.

## Chart Rules

- Use Recharts with a single-color system and opacity variation.
- Avoid rainbow legends and decorative chart treatments.
- Tooltips should be minimal, bordered, and text-first.
- Grid lines should be reduced or removed unless necessary for reading values.

## Sidebar Rules

- Text-only nav is preferred.
- Section labels should be uppercase, tracked, and muted.
- Keep the sidebar quiet, precise, and dense.
- User profile area should be understated and text-led.

## 21st.dev and shadcn Rules

When installing shadcn or 21st.dev components:
- Normalize them to Lumion tokens immediately.
- Replace hardcoded values with CSS variables.
- Tighten radius to the project's standard radius.
- Remove decorative icons where they are not functionally necessary.
- Verify dark mode quality instead of assuming defaults are acceptable.

## Quality Gates

Before finalizing frontend work, verify:
- Typography is disciplined and consistent.
- No hardcoded colors or loud surfaces were introduced.
- Spacing follows the system.
- Tables, cards, and forms remain restrained.
- Motion stays minimal.
- The page looks closer to Linear/Vercel/Stripe than to a ThemeForest admin template.

## Default Bias

When in doubt:
- remove instead of add
- reduce color before increasing it
- prefer border over fill
- prefer typography over decoration
- prefer structure over ornament
