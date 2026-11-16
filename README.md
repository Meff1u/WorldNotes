# WorldNotes

Interactive 3D globe for keeping notes about countries. Live at https://meff1u.github.io/WorldNotes/

## Features

- **3D globe** with all 255 countries and territories from Natural Earth 1:10m, including small island nations like Tuvalu, Nauru or the Maldives
- **Country notes**: write a note for any country, it saves automatically as you type
- **Surface colors**: paint a country with one of 12 preset colors or any custom color
- **Selection highlight**: the selected country is raised, lit up and outlined; very small countries also get a pulsing marker so they're easy to spot
- **Hover tooltips** showing the country name and a preview of its note
- **Search** to find a country by name and fly the camera to it
- **Import and export** of all notes, colors and settings as a JSON file
- **Light and dark theme**, defaulting to your system preference
- **Factory reset** to wipe all notes and settings, with a confirmation step
- **Local storage**: everything is kept in your browser, no account or server needed
- **Mobile friendly**: touch controls and a bottom sheet panel on small screens

## How to use

### Moving around the globe

| Action | Mouse | Touch |
| --- | --- | --- |
| Rotate | Drag with left button | Drag with one finger |
| Zoom | Scroll wheel | Pinch |

The buttons in the bottom left corner zoom in (**+**), zoom out (**−**) and reset the view (**↺**).

### Working with countries

1. **Click a country** on the globe, or type its name in the search box and press `Enter`
2. The side panel opens (a bottom sheet on mobile) with the country's note and color
3. **Pick a color** from the swatches, or use the rainbow swatch to choose a custom one. **Reset** brings back the default color
4. **Write a note** in the text area, it saves automatically. "Saved" appears when it's stored
5. **Clear all** removes both the note and the color for that country
6. Close the panel with **×**, by clicking the ocean, or with `Esc`

The counter at the bottom of the screen shows how many notes and colored countries you have.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `↑` `↓` | Move through search results |
| `Enter` | Select the highlighted search result |
| `Esc` | Close the settings menu, the panel or clear the search |

### Settings

The gear icon in the top right corner opens the settings menu:

- **Theme** switches between light and dark
- **Import notes** and **Export notes** (see below)
- **Factory reset** deletes all notes, colors and settings. A confirmation window shows how much will be removed and lets you export a backup first. This cannot be undone

### Backup and transfer

Notes live in your browser's local storage, so they are tied to one browser on one device. Use the settings menu to move them elsewhere:

- **Export notes** downloads `worldnotes-YYYY-MM-DD.json` with all notes, colors and the theme
- **Import notes** loads such a file. If you already have notes, you'll be asked before they are replaced

The file format:

```json
{
    "app": "WorldNotes",
    "version": 1,
    "exportedAt": "2026-11-16T20:46:56.780Z",
    "settings": { "theme": "dark" },
    "countries": {
        "Poland": {
            "note": "Visited Kraków in 2024",
            "color": "#ef4444",
            "updatedAt": "2026-11-16T20:43:39.524Z"
        }
    }
}
```

Countries are keyed by their English name as shown on the map.

## Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/WorldNotes/

Country shapes are generated from Natural Earth 1:10m (`world-atlas`) by `scripts/build-countries.js`, which runs automatically before `dev` and `build`.

## Deployment

Pushing to `main` builds and deploys through GitHub Actions. In the repository settings set **Pages → Source** to **GitHub Actions** once.
