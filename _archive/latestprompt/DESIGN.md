# Design System Specification: High-Tech Light Mode

## 1. Overview & Creative North Star: "The Ethereal Lab"
The Creative North Star for this design system is **"The Ethereal Lab."** We are moving away from the "standard dashboard" aesthetic and toward a space that feels like a high-end scientific instrument—precise, weightless, and impossibly clean.

This is not a flat design system. It is an editorial experience that uses **intentional asymmetry** and **tonal depth** to guide the eye. We break the grid by allowing high-contrast typography to "float" over layered surfaces, creating a sense of sophisticated technicality. By prioritizing breathing room and subtle shifts in grey over rigid lines, we achieve a premium, custom feel that suggests authority and innovation.

---

## 2. Colors & Surface Philosophy

### Color Tokens (Material Design Convention)
- **Primary (Vibrant Indigo):** `#4647d3` (Primary) | `#9396ff` (Container)
- **Secondary (Deep Violet):** `#5e4ab3` (Secondary) | `#d6cbff` (Container)
- **Surface Foundations:** 
  - `surface`: `#f5f7f9` (The canvas)
  - `surface_container_lowest`: `#ffffff` (Floating cards/elevation)
  - `surface_container_low`: `#eef1f3` (Subtle nesting)
  - `surface_container_highest`: `#d9dde0` (Deepest recesses)

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts. To separate a sidebar from a main content area, place a `surface_container_low` section against the `surface` background. The eye is sophisticated enough to perceive these tonal shifts; we do not need to "draw" the boxes.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of fine, semi-translucent paper.
- **Base Level:** `surface` (#f5f7f9) acts as the global floor.
- **Secondary Level:** Use `surface_container_low` to denote large functional areas (e.g., a data table background).
- **Elevated Level:** Use `surface_container_lowest` (#ffffff) for active components like cards or modals. This creates a "natural lift" without artificial styling.

### The "Glass & Gradient" Rule
To inject "soul" into the tech-heavy layout:
- **Glassmorphism:** For floating headers or navigation overlays, use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. 
- **Signature Textures:** For high-impact CTAs, use a linear gradient from `primary` (#4647d3) to `primary_container` (#9396ff) at a 135° angle. This adds a physical, light-catching quality to the interaction.

---

## 3. Typography: Technical Authority
We pair the geometric precision of **Space Grotesk** with the humanist clarity of **Manrope**.

- **Display (Space Grotesk):** Large, airy, and bold. Use `display-lg` (3.5rem) with `-0.04em` letter spacing for hero sections to create a high-end editorial "brutalism."
- **Headlines (Space Grotesk):** `headline-md` (1.75rem) serves as the primary anchor for page sections.
- **Titles (Manrope):** `title-lg` (1.375rem) provides a soft, professional counterpoint to the sharp Space Grotesk headers.
- **Body (Manrope):** All body text (`body-md`) must utilize a slightly increased line height (1.6) to ensure the "Light Mode" feels breathable and readable.
- **Labels (Space Grotesk):** `label-md` (0.75rem) should be used for data points and technical metadata, often in ALL CAPS with `0.05em` tracking to emphasize the "tech-forward" identity.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering**. Instead of a drop shadow, place a `#ffffff` card on an `#eef1f3` background. The contrast is sufficient to create perceived elevation while maintaining a "flat-tech" look.

### Ambient Shadows
Shadows are reserved only for "floating" objects (Modals, Popovers). 
- **Formula:** `0px 12px 32px rgba(44, 47, 49, 0.06)`. 
- The shadow is never pure black; it uses the `on_surface` color at a very low opacity to mimic natural ambient light.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., in a high-density data grid), use the **Ghost Border**: `outline_variant` (#abadaf) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (Primary to Primary-Container), `0.375rem` (md) radius. White text. Subtle `primary_dim` outer glow on hover.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary:** Text only in `primary` with a `label-md` Space Grotesk weight.

### Input Fields
- **Base State:** `surface_container_lowest` (#ffffff) with a 1px "Ghost Border."
- **Focus State:** Border color shifts to `primary`, with a 4px soft outer glow (10% opacity primary).
- **Typography:** Labels use `label-md` Space Grotesk for a "blueprint" feel.

### Cards & Lists
- **The No-Divider Rule:** Explicitly forbid horizontal line dividers. Separate list items using `12px` of vertical white space or by alternating background tints between `surface` and `surface_container_low`.
- **Nesting:** Content inside cards should be grouped using subtle `surface_variant` shapes rather than lines.

### Technical Chips
- Use `secondary_container` (#d6cbff) with `on_secondary_container` (#4a349d) text. 
- Apply a `9999px` (full) radius to make them look like precise, tactile pills.

---

## 6. Do's and Don'ts

### Do:
- **Use White Space as a Tool:** Treat empty space as a structural element, not "missing" content.
- **Maintain Optical Alignment:** Because Space Grotesk is geometric, headlines may need manual kerning or optical alignment to feel centered.
- **Vary Tonal Weights:** Use `on_surface_variant` (#595c5e) for secondary information to create a clear information hierarchy.

### Don't:
- **Don't use #000000:** It is too harsh for this "Ethereal Lab" aesthetic. Use `on_background` (#2c2f31) for maximum contrast.
- **Don't use "Heavy" Shadows:** If a shadow looks like a shadow, it’s too dark. It should look like a soft glow of depth.
- **Don't use standard 12-column grids rigidly:** Allow elements to bleed across columns or offset them slightly to create an intentional, custom-built appearance.