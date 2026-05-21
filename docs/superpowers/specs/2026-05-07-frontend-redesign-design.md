# Frontend Redesign: Organic Playful Style

## Meta
- **Date**: 2026-05-07
- **Scope**: All pages (Home, Questionnaire, Result, Exclusive Page, Quiz, Share, Login, Register)
- **Direction**: Major redesign — organic playful illustration style (Figma/Vercel-like)
- **Goal**: Remove "AI-generated aesthetic" from the frontend

## Design System Changes

### Shape Language: Organic Blobs
Replace uniform `border-radius: 24px` glass cards with irregular blob-radius containers.
- Cards use asymmetric border-radius (e.g., `30% 70% 70% 30% / 30% 30% 70% 70%`)
- Each card has a slightly different ratio for handmade feel
- Glass morphism retained ONLY on Navbar (needs to overlay content)

### Depth: Shadows Over Blur
Replace `backdrop-filter: blur()` layering with multi-layer colored box-shadows.
- Use theme-color semi-transparent shadows, not black
- Hover: shadow spreads rather than brightening

### Icons & Decor: Hand-drawn SVG Illustrations
Replace the sparkle SVG icon (used in logo, AI badge, features, CTA) with:
- Unique micro SVG illustrations per section (organic blobs, wavy lines, dot grids, abstract geometry)
- Pure CSS/SVG, no external illustration dependencies
- Decor is ambient (background scattered elements), not button icons

### Typography: Pure Bold, No Gradients
- Titles: solid color + `font-black` weight, no gradient-text
- Numbers (01, 02, 03) as section identifiers instead of sparkle icons
- Keep Inter variable font

### Motion: Spring Physics
Replace uniform `fadeIn/slideUp 0.5s` with:
- Spring animations (framer-motion `type: "spring"`)
- Staggered delays per element
- Different rhythms for different sections

## Page-by-Page Changes

### Home Page (`src/app/page.tsx`)
Reduce from 5 sections to 4:
1. **Hero**: Big blob decor (animated, theme-colored) + title (pure bold, no gradient) + prompt input directly below + depth selector + example chips. Delete: AI badge, floating preview card with rotation, 3-step cards
2. **My Questionnaires**: Large numbers (01, 02, 03) as card identifiers, organic border-radius cards with soft shadows, horizontal or responsive grid
3. **Highlights + Preview** (merged): Replace Features + Preview sections with one combined section. Abstract CSS illustrations in cards, result preview cards as visual anchors
4. **Footer CTA**: Minimal — two lines + big button. Remove: purple radial gradient background. Add: trust signal ("无需注册即可体验")

### Questionnaire Page (`src/app/questionnaire/[id]/page.tsx`)
- Question card: centered, larger, generous whitespace
- Options: wide horizontal cards with left emoji + right text
- Delete: AI feedback bubble
- Progress: circular dot matrix instead of bar, placed below the card
- Option interaction: border → theme color on hover, rightward micro-shift, selected = theme border + light theme bg + dot marker
- Transition: spring from below, previous card shrinks and fades upward

### Result Page (`src/app/result/[id]/page.tsx`)
- Vertical narrative flow with numbered sections (01, 02, 03)
- Hero: large persona title + 3 core tags, no "your page is ready" boilerplate
- Dimensions: bar with organic blob endpoints, each dimension different theme color
- Tags: handwritten feel — irregular radius, slight rotation (±1deg)
- Recommendations: simple card grid
- Bottom: share CTA + "created by PersonaFlow"

### Exclusive Page (`src/components/ExclusivePageRenderer.tsx`)
- Same narrative flow as Result Page
- DynamicPageRenderer follows same patterns

### Quiz Page (`src/app/quiz/[slug]/page.tsx`)
- Share questionnaire visual style with answer page
- Title from share link, no Navbar
- Post-completion: softer registration prompt

### Share Page (`src/app/share/[slug]/page.tsx`)
- Same narrative flow as Result Page
- Bottom: "Powered by PersonaFlow" + create button

### Login/Register (`src/app/login/page.tsx`, `src/app/register/page.tsx`)
- Organic border-radius card with soft shadow
- Single large blob decor (asymmetric placement)
- Remove all sparkle icons
- Titles: simple "登录" / "创建账号"
- Divider: wavy line instead of straight line

### Navbar (`src/components/Navbar.tsx`)
- Keep glass effect (needed for overlay)
- Logo: plain text "PF" or "PersonaFlow", no sparkle icon
- Nav links: reduce to 2 or remove, keep only action buttons
- Theme switcher: keep

### Globals CSS (`src/app/globals.css`)
- Replace `.glass-card` with `.blob-card` utility (organic radius + soft shadow)
- Add `.shadow-soft-{color}` utilities for colored shadows
- Add blob animation keyframes
- Keep `.glass` for Navbar only
- Remove unused utilities if any

## Files Touched
| File | Change |
|------|--------|
| `src/app/globals.css` | Major: new utilities, replace glass-card, add blob animations |
| `src/app/page.tsx` | Major: restructure sections, new layout |
| `src/app/questionnaire/[id]/page.tsx` | Major: new card layout, progress dots, transitions |
| `src/app/result/[id]/page.tsx` | Major: narrative flow, blob bars, organic tags |
| `src/app/quiz/[slug]/page.tsx` | Medium: visual alignment |
| `src/app/share/[slug]/page.tsx` | Medium: visual alignment |
| `src/app/login/page.tsx` | Light: card restyle, blob decor |
| `src/app/register/page.tsx` | Light: card restyle, blob decor |
| `src/components/Navbar.tsx` | Light: logo text, nav link reduction |
| `src/components/ExclusivePageRenderer.tsx` | Medium: narrative layout |
| `src/components/DynamicPageRenderer.tsx` | Medium: narrative layout |
| `src/components/ThemeSwitcher.tsx` | No changes needed |
| `src/lib/theme/themes.ts` | Light: add shadow tokens per theme |
