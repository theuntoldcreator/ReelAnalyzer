# Design System Specification: High-Tech AI Video Automation

## 1. Overview & Creative North Star: "The Synthetic Lens"

The North Star for this design system is **"The Synthetic Lens."** We are not building a generic SaaS dashboard; we are creating a high-fidelity interface that feels like an extension of the AI’s own "sight." It is a professional, dark-mode environment where data isn't just displayed—it is curated.

To move beyond the "template" look, this system rejects rigid, boxed-in grids. Instead, it utilizes **intentional asymmetry** and **tonal layering**. We emphasize a "Cinematic Utility" aesthetic: high-contrast typography scales (the "Editorial" feel) paired with soft, translucent surfaces (the "Tech" feel). By overlapping elements and using varied surface depths, we create a sense of physical space within the digital screen.

---

## 2. Colors: Depth Through Luminance

The palette is anchored in deep obsidian tones, punctuated by "Electric Indigo" and "Cyan" to represent AI activity and primary user intent.

### Core Palette
- **Background (`#060e20`):** The absolute base. Everything grows from this void.
- **Primary & Primary Dim (`#a3a6ff` / `#6063ee`):** Used for active AI states and core CTA buttons.
- **Secondary (`#53ddfc`):** Reserved for data visualization highlights and "Processing" indicators.
- **Tertiary (`#ff9dd1`):** Used sparingly for "Insight" callouts or human-in-the-loop interventions.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. To separate a sidebar from a main feed, transition from `surface` to `surface-container-low`. To highlight a card, sit a `surface-container-highest` element on a `surface-container` background.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of frosted glass.
1.  **Level 0 (Base):** `surface` (`#060e20`)
2.  **Level 1 (Sections):** `surface-container-low` (`#091328`)
3.  **Level 2 (Active Cards):** `surface-container-high` (`#141f38`)
4.  **Level 3 (Popovers/Tooltips):** `surface-bright` (`#1f2b49`)

### The "Glass & Gradient" Rule
Floating elements (Modals, Chat Bubbles, Video Overlays) must use **Glassmorphism**. Apply `surface-container` at 60% opacity with a `24px` backdrop-blur. 
*   **Signature Textures:** For primary actions, use a linear gradient from `primary` (`#a3a6ff`) to `primary_dim` (`#6063ee`) at a 135-degree angle to provide a sense of energy and movement.

---

## 3. Typography: Editorial Precision

We use a dual-font strategy to balance technical precision with modern editorial flair.

*   **Display & Headlines (Space Grotesk):** A tech-leaning sans-serif with geometric quirks. Use `display-lg` for macro-metrics (e.g., "98% Accuracy") to create a bold, authoritative focal point.
*   **Titles & Body (Manrope):** A highly legible, modern sans-serif. Use `title-lg` for card headings. `body-md` is your workhorse for AI insights and chat logs.
*   **Technical Labels (Inter):** Used for metadata, timestamps, and micro-copy. The neutral nature of Inter ensures that even dense video logs remain readable.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too "heavy" for a sleek AI interface. We achieve lift through light, not shadow.

*   **The Layering Principle:** Depth is achieved by "stacking" the surface tiers. A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural "sunken" effect for input areas, while a `surface-container-highest` creates an elevated "lifted" effect for actionable insights.
*   **Ambient Glow:** For "floating" items, use a wide, soft shadow: `0px 20px 40px rgba(0, 0, 0, 0.4)`. To represent AI "focus," use a subtle outer glow using the `primary` color at 10% opacity.
*   **The "Ghost Border":** If a boundary is required for accessibility, use the `outline_variant` (`#40485d`) at **15% opacity**. This creates a "glimmer" edge rather than a hard line.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_dim`), `xl` (0.75rem) corner radius. Use `Space Grotesk` Medium for the label.
*   **Secondary:** Ghost style. Transparent fill with a `Ghost Border` and `primary` text.
*   **Tertiary:** Text-only, using `secondary` (`#53ddfc`) for "Low-priority" automation tasks.

### AI Insight Cards
*   **Styling:** No borders. Use `surface-container-high`.
*   **Interaction:** On hover, shift the background to `surface-container-highest`.
*   **Asymmetry:** Place the "Confidence Score" (Display-sm) in the top right, breaking the vertical alignment of the text content to create a custom, high-end feel.

### Chat Interface
*   **User Bubbles:** `surface-container-highest` with a `Ghost Border`.
*   **AI Bubbles:** Glassmorphic (`surface-container` @ 60% blur) with a subtle `primary` glow on the left edge.
*   **Spacing:** Use `24px` vertical margins between message groups; do not use dividers.

### Video Timeline & Scrubber
*   **Track:** `surface-container-lowest`.
*   **Active Range:** `secondary_dim` (`#40ceed`) with a subtle pulse animation.
*   **Markers:** Use `tertiary` for human-flagged moments and `primary` for AI-detected events.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a separator. If you feel the need for a line, add 16px of padding instead.
*   **DO** use `secondary_fixed_dim` for icons to ensure they feel "illuminated" against the dark background.
*   **DO** utilize the `xl` (0.75rem) border radius for cards to soften the high-tech aesthetic.

### Don't
*   **DON'T** use pure white (`#FFFFFF`) for text. Always use `on_surface` (`#dee5ff`) to reduce eye strain in dark mode.
*   **DON'T** use standard 1px borders. They break the "Glass & Gradient" illusion.
*   **DON'T** use generic "drop shadows." If an element needs to stand out, use a color-tinted ambient glow or a background-step increase.
*   **DON'T** overcrowd the layout. If the AI is doing the work, the UI should stay out of the way, providing "breathing room" for the video content.