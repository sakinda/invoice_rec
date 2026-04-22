---
name: Reliant Financial
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  margin: 24px
  max_width: 1440px
---

## Brand & Style
The brand personality is anchored in reliability, precision, and institutional trust. It is designed for high-stakes financial environments where clarity is paramount. The target audience includes private wealth managers, financial analysts, and high-net-worth individuals who require a tool that feels sophisticated yet utilitarian.

This design system utilizes a **Corporate / Modern** style. It prioritizes a high information density without sacrificing legibility. The aesthetic is "quietly premium"—avoiding flashy trends in favor of stable, enduring design patterns. Every element is engineered to evoke a sense of security and methodical efficiency, ensuring that the user feels in total control of their data.

## Colors
The color palette is architected for maximum institutional credibility. 
- **Deep Navy (#0F172A):** Used for primary text, sidebars, and structural headers to ground the interface in professionalism.
- **Crisp White (#FFFFFF):** The primary canvas color, ensuring a high-contrast environment for data reading.
- **Soft Accent Blue (#3B82F6):** Reserved exclusively for primary actions, progress indicators, and active states to guide the eye without causing fatigue.
- **Neutral Slate (#F8FAFC):** Used for subtle backgrounds and grouping containers to separate logical sections of data.
- **Functional Colors:** Standardized success, error, and warning tokens are utilized for balance sheets and financial status indicators.

## Typography
The system uses **Inter** for its exceptional legibility and neutral character. To support complex financial tables, the `mono-data` style must always use tabular numbers (`tnum`) to ensure decimal points and digits align vertically across rows. Headlines use a tighter letter spacing to maintain a structured, editorial look, while labels utilize uppercase styling with slight tracking for clear categorization in forms and metadata displays.

## Layout & Spacing
The system employs a **12-column fixed-width grid** centered on the screen for desktop views, ensuring that financial reports do not become overly stretched on ultra-wide monitors. 

Spacing follows a strict 4px baseline grid. A "room to breathe" philosophy is applied to data-heavy views: use `lg` (24px) padding for primary containers and `md` (16px) for internal element grouping. This rhythm prevents the density of financial data from feeling overwhelming or cluttered.

## Elevation & Depth
Depth is conveyed through **ambient shadows** and **tonal layers**. 
- **Level 0 (Base):** The neutral slate background.
- **Level 1 (Cards):** Crisp white surfaces with a 1px border (#E2E8F0) and a very soft, diffused shadow (0px 4px 6px rgba(15, 23, 42, 0.05)).
- **Level 2 (Overlays):** Modals and dropdowns use a more pronounced shadow (0px 10px 15px rgba(15, 23, 42, 0.1)) to signify temporary interaction.

Avoid heavy dark shadows or intense glows. The goal is to simulate paper layers on a desk—subtle, physical, and organized.

## Shapes
The shape language uses a consistent **Rounded (8px-12px)** logic. 
- **Standard Elements:** 8px (0.5rem) for buttons, input fields, and chips.
- **Large Containers:** 12px (0.75rem) for cards, modals, and main content areas.

This level of roundedness softens the technical nature of financial data, making the tool feel modern and approachable without losing its professional edge.

## Components
- **Buttons:** Primary buttons use the soft accent blue with white text. Secondary buttons use a white fill with a subtle slate border. Hover states should involve a slight darkening of the background color.
- **Input Fields:** Use a 1px slate border that thickens and changes to the accent blue upon focus. Include clear validation states (red for error, green for success) below the field.
- **Data Tables:** Use "Zebra striping" with the neutral slate color for every second row to aid horizontal scanning. Headers must be "sticky" and use the `label-md` type style.
- **Document Controls:** Drag-and-drop zones for financial statements should have a dashed blue border when active. Action icons for "Preview," "Download," and "Sign" should be monochromatic slate, turning blue only on hover.
- **Chips:** Used for transaction categories (e.g., "Investment," "Tax," "Transfer"). Use low-saturation background tints of the primary colors to maintain a clean aesthetic.
- **Progress Bars:** Thin, 4px height bars in accent blue to indicate budget usage or document upload status.