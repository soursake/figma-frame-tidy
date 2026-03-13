# Frame Tidy — Figma Plugin

Keeps your design frames crisp with one click.

## What it does

| Feature | How to trigger |
|---|---|
| Equalize spacing between frames | Select 2+ frames |
| Align frames (top-align row, left-align column) | Select 2+ frames |
| Clean up text label gap above frames | Select any frame with a label above it |
| Tidy frames inside a section + resize section to fit | Select a section |
| Equalize spacing between sections | Select 2+ sections |

## How to load in Figma

1. Open Figma Desktop
2. **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` from this folder
4. Run via **Plugins → Development → Frame Tidy**

## Settings

- **Frame spacing** — gap in px between frames (default 40)
- **Text label gap** — gap in px between a label text and the frame below (default 16)

## Tips

- Works on frames, components, and component sets
- Text labels must be siblings of the frames (same parent layer) to be detected
- Sections are auto-resized with 40px padding after tidying their contents
- Press **Enter** to trigger Tidy Up from the keyboard
