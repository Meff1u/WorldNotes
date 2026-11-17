# WorldNotes

Interactive 3D globe for keeping notes about countries. Live at https://meff1u.github.io/WorldNotes/

## Features

- **3D globe** with all 255 countries and territories from Natural Earth 1:10m, including small island nations like Tuvalu, Nauru or the Maldives
- **Country notes**: write a note for any country, it saves automatically as you type
- **Surface colors**: paint a country with one of 12 preset colors or any custom color
- **Selection highlight**: the selected country is raised, lit up and outlined; very small countries also get a pulsing marker so they're easy to spot
- **Groups**: collect countries into named groups with their own color and note; a country can belong to many groups
- **Hover tooltips** showing the country name, its groups and a preview of its note
- **Search** to find a country by name and fly the camera to it, ignoring diacritics (`aland` finds Åland Islands)
- **Country list** with search by name or note and filters (with note, without note, colored, by group)
- **Random country** picker: any country, one without a note, one you've already written about, or one from a group
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
5. **Clear all** removes both the note and the color for that country (its group memberships stay)
6. Close the panel with **×**, by clicking the ocean, or with `Esc`

The counter at the bottom of the screen shows how many notes, colored countries and groups you have.

### Groups

Groups collect countries under one name, for example "Visited in 2024" or "Bucket list". Each group has its **own color** and **own note**, which never overwrite the notes of its countries.

- **Add a country to a group** from its panel: use the **Add to a group…** list, or pick **+ New group…** to create one on the spot. The country's groups show up as chips; click a chip to open the group, or **×** to remove the country from it
- **Pick which color a country uses** with the **Own color / Group color** switch in its panel. A country always starts with its own color; switching to **Group color** lets you choose which of its groups to take the color from, since a country can be in several groups but shows only one color
- **Manage groups** in **Groups** in the settings menu: create, rename, change the color, write the group note, see and remove member countries, or delete the group. Deleting a group keeps all country notes, and countries that used its color go back to their own
- **Show on globe** in a group highlights its countries in the group color, fades the rest of the map and moves the camera to fit them all. Close the banner at the top (or press `Esc`) to go back to the normal view

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `↑` `↓` | Move through search results |
| `Enter` | Select the highlighted search result |
| `Esc` | Close the settings menu, the panel or the group highlight, or clear the search |

### Settings

The gear icon in the top right corner opens the settings menu:

- **Country list** shows every country with its color and a preview of its note. Search matches both names and note text, and the filters narrow it down to countries **with a note**, **without a note** or **colored**, each with a live count. Once you have groups, a dropdown limits the list to one group. Pick a country (click or `↑` `↓` + `Enter`) to close the list and fly to it
- **Groups** opens the group manager (see above)
- **Random country** opens a picker: **Any country**, **Without a note**, **With a note**, or any of your groups. Each option shows how many countries it can pick from, and empty ones are disabled. The globe flies to the drawn country and opens its panel
- **Theme** switches between light and dark
- **Import notes** and **Export notes** (see below)
- **Factory reset** deletes all notes, colors and settings. A confirmation window shows how much will be removed and lets you export a backup first. This cannot be undone

### Backup and transfer

Notes live in your browser's local storage, so they are tied to one browser on one device. Use the settings menu to move them elsewhere:

- **Export notes** downloads `worldnotes-YYYY-MM-DD.json` with all notes, colors, groups and the theme
- **Import notes** loads such a file. If you already have data, you'll be asked before it is replaced.

The file format:

```json
{
    "app": "WorldNotes",
    "version": 2,
    "exportedAt": "2026-11-17T09:12:44.201Z",
    "settings": { "theme": "dark" },
    "countries": {
        "Poland": {
            "note": "Visited Kraków in 2024",
            "color": "#ef4444",
            "colorSource": "gm3k2x9a1b",
            "updatedAt": "2026-11-16T20:43:39.524Z"
        }
    },
    "groups": {
        "gm3k2x9a1b": {
            "name": "Visited 2024",
            "color": "#3b82f6",
            "note": "Summer road trip",
            "members": ["Poland", "Germany", "France"],
            "createdAt": "2026-11-17T09:02:10.000Z",
            "updatedAt": "2026-11-17T09:05:31.000Z"
        }
    }
}
```

Countries are keyed by their English name as shown on the map. `colorSource` is the id of the group whose color the country uses, or `null` for its own `color`.

## Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/WorldNotes/

Country shapes are generated from Natural Earth 1:10m (`world-atlas`) by `scripts/build-countries.js`, which runs automatically before `dev` and `build`.

## Deployment

Pushing to `main` builds and deploys through GitHub Actions. In the repository settings set **Pages → Source** to **GitHub Actions** once.
