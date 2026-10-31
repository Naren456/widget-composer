# WidgetComposer — Separated Onboarding Assets

This package contains separated screen mockups and reference crops from the supplied five-screen onboarding contact sheet.

## Contents

- `screens/`: five individually cropped mobile-screen references, with phone borders retained and the labels below the phones excluded.
- `components/widget-cards/`: close crops of the clock, quote, task-list, countdown, and greeting widget cards visible in the reference.
- `components/ui-references/`: close crops of the prompt input, widget previews, style selector, color palette, size selector, and Android setup illustration.
- `brand/`: previously generated logo and Android icon assets, when available.
- `references/`: the original contact sheet and an optional AI-generated welcome-screen concept.
- `asset-preview.jpg`: quick preview of the five separate screen crops.

## Important production note

The five screen PNGs are crops of a composite mockup, not source Figma frames. The component crops are image references and may contain small pieces of neighboring UI or background because the original elements overlap. Use them as visual references; rebuild editable UI, text, buttons, and widget content with React Native components for production.

The source contact sheet is 1536 × 1024 pixels. Individual screen crops retain their original pixel resolution (approximately 291–294 × 760); resizing them larger does not add real detail.
