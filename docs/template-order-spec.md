# Template Invitation: product and order flow spec

## Product

One product: "Template Invitation". The customer must choose from existing templates. Right now there is ONE template: "The Vow Atelier" (bilingual English/Urdu wedding invitation, black and antique gold). The code must support more templates later with no rewrite (templates are an array in config.js).

## Price (all in config.js, nothing hard-coded elsewhere)

- List price: $40. Limited-time discount: 50% (shown as -$20). Customer pays $20.
- discount config: { active:true, percent:50, label:'Limited time offer', endsAt:'' }. If endsAt is set and in the past, the discount ends everywhere automatically and the price shows $40. No fake countdowns.
- Optional extra: Express delivery, price in config (expressPrice: 5).
- Delivery chips from config: standard 'Ready in 4-7 days', express 'Express: 24-48h' (placeholders I will edit).
- Remove the old plans (Essential, Signature, Bespoke) from the pricing section and presets. Leave the old 5-step configurator code in the project but unlinked, because I may reuse it for a second card.

## Pricing section: one card

Same structure as my reference screenshot, in our design tokens (gold and plum, not teal):

1. Badge with a star: "Launch offer" (text from config).
2. Title "Template Invitation". Description: "Choose from our designs. We adjust colors, texts and photos to yours." (count from config).
3. Price block: big $20, struck-through $40, and "Limited time offer" underneath (all from the engine).
4. Two chips: standard delivery and express delivery (from config).
5. Divider, label "Always included", then a checklist with round check icons:
   Personal designer by your side / Opening animation / Photos of your choice / Background music / Date reveal / An invitation letter / Events details / A timer / Location details and Add to calendar option / Smart RSVP tracking / Unlimited revisions and unlimited guests
6. A full-width primary button "Choose Template Invitation" with an arrow, ALWAYS animating (see Animation).
7. Divider, then the label "1 template to choose from" (count from config) and below it a row of template thumbnails. The thumbnail shows the template's looping preview video (reuse the project's initPreviewVideos system) in a small rounded phone-shaped tile (aspect 540/1160, about 72px wide). Clicking a thumbnail opens the order flow with that template chosen.
   The section container is a responsive grid so a second card can be added later. With one card, center it at a maximum width of 560px.

## Order flow: a dialog with 3 steps

Reuse the existing order dialog and its live price header if they exist; otherwise create them. Header: title "Build Your Template Invitation", the live total (with the struck-through list price when a discount applies), a close button. Under it: a progress bar (transform: scaleX, never width) and "Step X of 3". Footer: Back (steps 2 and 3) and the main button, ALWAYS animating, pinned at the bottom of the dialog. Steps slide and fade horizontally (transform and opacity only). Focus moves to each step's heading. The dialog is a full-height bottom sheet under 640px and a centered card up to 780px above that. All nav, hero, gallery "Order this design" and pricing buttons open this flow.

- Step 1 "Choose your invitation template": helper text "Every design is fully personalised to you: your colors, your photos, your text." A grid (2 columns when two or more templates, one centered column of max 340px for one) of template cards: the looping video preview inside a phone-shaped frame, a "New" badge, a selected check mark, title, one-line description, and a "See live example" link (opens the demo in a new tab). With one template it is selected by default. Main button: "Continue".
- Step 2 "Your invitation details": the form below. Main button: "Continue".
- Step 3 "Review your order": receipt. Main button: "Place order".

## Step 2 form: built for The Vow Atelier

Read the Vow Atelier demo's own config object first and make sure every customizable value in it has a field. Fields, in labelled fieldsets, with helper text and inline errors. "R" = required.

1. The couple: R groom's name; R bride's name; which name appears first (Groom / Bride); checkbox "Please write our names in Urdu for us"; optional names in Urdu script (dir="auto").
2. Opening words: a short line under the names (default "A celebration written in the stars.", max 80 characters); an optional welcome message (max 200 characters).
3. The date: R wedding date (native date input, min today) with a "date not final yet" checkbox that disables it; R main start time; R time zone select (default to the visitor's own via Intl).
4. Events (repeatable rows, 1 to 6, add and remove buttons): event type select (Nikkah, Mehndi, Barat, Walima, Dholki, Reception, Other) plus a custom name if Other; date; start time; venue name; city; optional Google Maps link (must be a valid https URL); optional dress code.
5. Main venue ("A place to remember"): R venue name; R city and country; optional short description (max 140 characters); optional map link.
6. Language: choose "English and Urdu (as in the live example)", "English only", "Urdu only" or "Other language (tell us in the notes)"; radio "I will provide the Urdu text" or "Please translate for us".
7. RSVP: where replies should go: R WhatsApp number or email; reply-by date; toggles for "Ask guests how many are attending", "Ask about dietary or accessibility needs", "Ask for a contact number".
8. Music: pick one of 3 placeholder tracks from config, "Suggest something similar (we pick royalty-free)" or "No music".
9. Photos: checkbox "I will send my photos on WhatsApp after I place the order". No upload on the site.
10. Delivery: Standard (included) or Express (+ expressPrice from config).
11. Your contact details: R full name; R WhatsApp number (7 to 15 digits, optional leading plus, with a country-code hint); email (optional but validated if filled); preferred contact method (WhatsApp or Email); notes (max 600 characters, with a counter).
12. A required consent checkbox: "I understand nothing is charged until I approve my preview." And a hidden honeypot field named "website" that must stay empty.

## Step 3 receipt

Itemised lines from the pricing engine: "Template Invitation: The Vow Atelier $40", "Limited time offer -$20" (green), "Express delivery +$5" (only if chosen), a clear total. Below it a summary of the key answers (names, date, events count, language, music, delivery) with "Edit" links that jump back to step 2. An order reference (DI-YYMMDD-XXXX). A note from config: "No payment is taken now. We send your free preview first." Main button "Place order": builds a clean plain-text order message and opens https://wa.me/<DI.site.phone>?text=<encoded>; secondary link "Send by email" (mailto) and a "Copy order message" button as a fallback. After sending, show a thank-you panel: the reference, "Tap Send in WhatsApp to deliver your order" and a short numbered "What happens next" list from config. Clear the saved draft afterwards.

## Animation (always-on call-to-action buttons)

Applies to "Choose Template Invitation", the step "Continue" buttons and "Place order": a class .cta-live with (a) a slow breathing scale between 1 and 1.025, (b) a light shimmer sweep across the button, (c) a soft expanding halo ring, and (d) a gentle arrow nudge. Only transform and opacity are animated. Make sure the halo is not clipped by overflow:hidden (use a wrapper). Pause the animation on hover and show a lifted state. With prefers-reduced-motion, all of it stops and the button keeps a strong static style.

## Rules

Follow .github/copilot-instructions.md. All text and prices from config.js. No innerHTML with user text. Validate with inline errors and an aria-live summary. Save drafts in localStorage inside try/catch under "di_template_order_v1", validate on load. Mobile first, 360px, 44px tap targets, no horizontal overflow, no blur or backdrop-filter.
