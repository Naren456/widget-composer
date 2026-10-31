# WidgetComposer — separated splash-screen assets

The bundle contains the original reference, a reusable logo mark, Android icon exports, a clean dark-green background, separate visual crops for the four example widget cards, and loading-state assets.

## Structure
- `brand/logo-symbol.svg`: editable four-petal logo symbol (SVG source).
- `brand/logo-symbol-transparent.png`: transparent high-resolution symbol raster.
- `brand/android-app-icon-1024.png`: full square app icon with its own background; Android launcher applies its mask.
- `brand/android-adaptive-foreground.png`: transparent foreground mark with adaptive-icon safe padding.
- `brand/android-adaptive-background.png`: square background layer for Android adaptive icons.
- `brand/wordmark-widgetcomposer.png`, `brand/tagline.png`: rasterized transparent crops from the reference.
- `widgets/*.png`: individual masked crops of the widget-card illustrations in the uploaded splash image.
- `loading/*.png`: loading title, progress bar, lightbulb, and supporting note crops.
- `backgrounds/splash-background.png`: clean dark background without UI elements.
- `reference/original-splash-screen.png`: original uploaded reference.
- `asset-preview.jpg`: overview of selected assets.

## Important notes
The supplied splash was one flattened image, not a layered design source. The widget cards have therefore been extracted as raster crops and masked to their visible shapes; any hidden portions where cards overlap cannot be reconstructed exactly from the flattened image. For the shipped app, use the widget crops as visual references or rebuild their text and controls as native React Native components. Prefer rendering the wordmark/tagline with native text for sharpness and localization.

## React Native / Expo usage
- Put `brand/android-app-icon-1024.png` at `assets/app-icon/icon.png` for a conventional launcher icon.
- For Android adaptive icons, use `android-adaptive-foreground.png` as `foregroundImage` and `android-adaptive-background.png` as the background image or an equivalent solid color depending on the Expo SDK configuration.
- Use `backgrounds/splash-background.png` as a visual reference for the custom in-app loading screen. The native splash should remain a simple background + centered logo.
- Do not use the full splash screenshot as the actual interactive loading screen; render the progress bar, labels, and transitions with native components.
- `brand/logo-symbol-generated-transparent.png`: generated transparent raster alternative to the hand-authored SVG mark.
- `brand/previous-android-icon-reference.png`: earlier app icon PNG supplied/generated during the design iteration.
