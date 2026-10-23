# Project rules: "Digital Invitations" website

## What this is

A static website for selling animated digital invitations. Plain HTML, CSS and JavaScript only. No frameworks, no bundlers, no npm. Tested with the VS Code Live Server extension.

## Files

- index.html, style.css, script.js: the marketing homepage (do not break it).
- config.js: all editable business data (prices, catalog, copy, contact details).
- pricing.js: pure price calculation functions (no DOM code).
- order.js and order.css: the order configurator modal.
- invitation-demo/: a separate demo invitation (leave it alone).
- Use classic <script> tags (not ES modules). Share code through one global namespace: window.DI (DI.catalog, DI.pricing, DI.order).

## Design

- Reuse the CSS variables in style.css (--bg, --ink, --gold, --plum, --card, --line, --serif, --sans, --script) and the existing .btn styles. Never hard-code new colors if a token exists.
- Support the existing dark-mode tokens and prefers-reduced-motion.
- Animate only transform and opacity. No backdrop-filter and no blur filters (they are slow on phones).
- Mobile first. Everything must work at 360px wide, with 44px minimum tap targets.

## Code quality

- Never put user input into innerHTML. Use textContent or createElement. Escape anything built from strings.
- Keep functions small and named clearly. Add short beginner-friendly comments explaining why, not what.
- All prices, labels and business copy come from config.js. Never hard-code prices in HTML or JS.
- Accessibility is required: labels, fieldset/legend, visible focus, keyboard support, aria-live for dynamic totals and errors.
- After any change, make sure the browser console shows no errors, and list the files you changed.
- Do not change files unrelated to the task. Ask before deleting anything that is not clearly part of the task.
