# WorldNotes

Interactive 3D globe for keeping notes about countries. Live at https://meff1u.github.io/WorldNotes/

## Features

- **3D globe** with all 265 countries and territories from Natural Earth 1:10m, including small island nations like Tuvalu, Nauru or the Maldives and overseas regions such as Guadeloupe, Martinique or Réunion shown on their own
- **Country notes**: write a note for any country, it saves automatically as you type
- **Flags and status**: each panel shows the flag and whether the place is a country, a territory (e.g. "Overseas region of France") or a disputed area
- **Surface colors**: paint a country with one of 12 preset colors or any custom color
- **Selection highlight**: the selected country is raised, lit up and outlined; very small countries also get a pulsing marker so they're easy to spot
- **Groups**: collect countries into named groups with their own color and note; a country can belong to many groups
- **Profiles**: keep several separate globes, each with its own notes, colors and groups, and switch between them
- **Hover tooltips** showing the country name, its groups and a preview of its note
- **Search** to find a country by name and fly the camera to it, ignoring diacritics (`aland` finds Åland Islands)
- **Country list** with search by name or note and filters (with note, without note, colored, by group)
- **Random country** picker: any country, one without a note, one you've already written about, or one from a group
- **Optional cloud sync**: sign in with Google, Discord or an email link to keep your data in step across devices; without signing in nothing leaves your browser
- **Import and export** of all profiles, notes, colors and settings as a JSON file
- **Light and dark theme**, defaulting to your system preference
- **Factory reset** to wipe all profiles, notes and settings, with a confirmation step
- **Local first**: everything is saved in your browser, no account needed, with a meter showing how much of the browser's storage is used
- **Mobile friendly**: touch controls, the search box at the bottom within thumb's reach and a bottom sheet panel

## How to use

### Moving around the globe

| Action | Mouse | Touch |
| --- | --- | --- |
| Rotate | Drag with left button | Drag with one finger |
| Zoom | Scroll wheel | Pinch |

The buttons zoom in (**+**), zoom out (**−**) and reset the view (**↺**). They sit in the bottom left corner on desktop and in the top left corner on phones.

### Working with countries

1. **Click a country** on the globe, or type its name in the search box and press `Enter`
2. The side panel opens (a bottom sheet on mobile) with the country's flag, its status, note, color and groups. On phones the search box hides while the panel is open
3. **Pick a color** from the swatches, or use the rainbow swatch to choose a custom one. **Reset** brings back the default color
4. **Write a note** in the text area, it saves automatically. "Saved" appears when it's stored
5. **Clear all** removes both the note and the color for that country (its group memberships stay)
6. Close the panel with **×**, by clicking the ocean, or with `Esc`

The counter at the bottom of the screen shows how many notes, colored countries and groups you have.

Territories without a flag of their own show the flag of their parent country (e.g. Clipperton Island shows France's). Disputed areas with a flag of their own show it; the others show a neutral icon instead of picking a side.

### Groups

Groups collect countries under one name, for example "Visited in 2024" or "Bucket list". Each group has its **own color** and **own note**, which never overwrite the notes of its countries.

- **Add a country to a group** from its panel: use the **Add to a group…** list, or pick **+ New group…** to create one on the spot. The country's groups show up as chips; click a chip to open the group, or **×** to remove the country from it
- **Pick which color a country uses** with the **Own color / Group color** switch in its panel. A country always starts with its own color; switching to **Group color** lets you choose which of its groups to take the color from, since a country can be in several groups but shows only one color
- **Manage groups** in **Groups** in the settings menu: create, rename, change the color, write the group note, see and remove member countries, or delete the group. Deleting a group keeps all country notes, and countries that used its color go back to their own
- **Show on globe** in a group highlights its countries in the group color, fades the rest of the map and moves the camera to fit them all. Close the banner at the top (or press `Esc`) to go back to the normal view

### Profiles

A profile is a separate globe with its own notes, colors and groups.

- **Profile** at the top of the settings menu shows the active profile and opens the profile manager
- **New profile** creates an empty globe, switches to it and lets you name it right away
- Click a profile to **switch** to it; the globe reloads with that profile's data
- The pencil **renames** a profile (`Enter` saves, `Esc` cancels), the bin **deletes** it after a confirmation. The last remaining profile can't be deleted
- Each profile shows its number of notes, groups and how much storage it takes. With more than one profile, the counter at the bottom of the screen starts with the active profile's name

### Cloud sync

Cloud sync is optional. It appears in the settings menu only when the site is built with Supabase keys (see [Development](#development)).

- **Sign in** with **Continue with Google**, **Continue with Discord** or by entering your email to get a one-time sign-in link
- While signed in, every change is uploaded a couple of seconds after you stop typing, and changes from your other devices arrive live. Without internet everything keeps working and catches up once you're back online
- Changes are merged per country, group and profile: the newer change wins, so editing different countries on two devices never loses anything
- The first time a device connects to an account that already has data, you choose to **merge both**, **use the cloud data** or **use this device's data**
- The status in the menu shows **Synced**, **Syncing…**, **Offline** or **Error**; **Sync now** forces a sync
- **Sign out** stops syncing and keeps everything on the device
- **Delete account and cloud data** permanently removes your account and everything stored in the cloud; data in your browser stays

See the [privacy policy](https://meff1u.github.io/WorldNotes/privacy.html), also linked in the page footer and the settings menu.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `↑` `↓` | Move through search results, the country list and the settings menu |
| `Enter` | Select the highlighted search result or list item |
| `Esc` | Close a window, the settings menu, the panel or the group highlight, or clear the search |

### Settings

The gear icon in the top right corner opens the settings menu:

- **Profile** opens the profile manager (see above)
- **Cloud sync** shows the sync status and opens sign-in or account options (see above)
- **Country list** shows every country with its color and a preview of its note. Search matches both names and note text, and the filters narrow it down to countries **with a note**, **without a note** or **colored**, each with a live count. Once you have groups, a dropdown limits the list to one group. Pick a country (click or `↑` `↓` + `Enter`) to close the list and fly to it
- **Groups** opens the group manager (see above)
- **Random country** opens a picker: **Any country**, **Without a note**, **With a note**, or any of your groups. Each option shows how many countries it can pick from, and empty ones are disabled. The globe flies to the drawn country and opens its panel
- **Theme** switches between light and dark
- **Import notes** and **Export notes** (see below)
- **Factory reset** deletes all profiles, notes, colors and settings and starts over with one empty profile. A confirmation window shows how much will be removed and lets you export a backup first. This cannot be undone. When signed in, the cloud copy is replaced as well
- **Privacy policy** opens the privacy policy in a new tab
- **Storage** at the bottom of the menu shows how much of the browser's storage WorldNotes uses. The bar turns amber at 70% and red at 90%

### Backup and transfer

Without cloud sync, notes live only in your browser's local storage, tied to one browser on one device. Use the settings menu to move them elsewhere:

- **Export notes** downloads `worldnotes-YYYY-MM-DD.json` with every profile, its notes, colors and groups, and the theme
- **Import notes** loads such a file and replaces all current data. If you already have data, you'll be asked first. When signed in, the import replaces the cloud copy too

Local storage has a fixed limit per website (origin), usually about 5 million characters, which is around 10 MB in Chrome and Firefox and less in Safari. Browsers don't report this limit, so on the first visit WorldNotes measures it once by briefly writing test data until the browser refuses it (this takes a fraction of a second) and remembers the result for that browser. On GitHub Pages the limit is shared by every project under the same `username.github.io` address; the measurement accounts for what other projects already use, while the meter itself shows only what WorldNotes saves.

The file format:

```json
{
    "app": "WorldNotes",
    "exportedAt": "2026-11-17T09:12:44.201Z",
    "version": 3,
    "settings": { "theme": "dark" },
    "activeProfile": "pmwk1a2b3c4",
    "profiles": {
        "pmwk1a2b3c4": {
            "name": "My globe",
            "createdAt": "2026-11-16T20:40:00.000Z",
            "updatedAt": "2026-11-17T09:12:40.000Z",
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
            },
            "deleted": {
                "countries": { "Peru": "2026-11-17T08:30:00.000Z" },
                "groups": {}
            }
        }
    },
    "deletedProfiles": {}
}
```

- Countries are keyed by their English name as shown on the map
- `colorSource` is the id of the group whose color the country uses, or `null` for its own `color`
- `deleted` and `deletedProfiles` remember what was deleted and when, so syncing with an older copy can't bring it back. They can be left empty when editing a file by hand
- Files from older versions (1 and 2, before profiles) still import as a single profile

## Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/WorldNotes/

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run data` | Rebuilds the country shapes (runs automatically before `dev` and `build`) |
| `npm run og` | Regenerates `public/og-image.png`, the link preview image, from the map data |

Country shapes come from Natural Earth 1:10m (`world-atlas`) and are simplified by `scripts/build-countries.js`, which also splits overseas territories listed in `scripts/territories.json` from their parent countries and keeps tiny islands from collapsing.

### Cloud sync (optional)

Without configuration WorldNotes works fully offline and the Cloud sync option stays hidden. To enable it:

1. Create a project on [Supabase](https://supabase.com) and run `supabase/schema.sql` in its **SQL Editor**. It creates the `stores` table with row level security and the `delete_account()` function
2. In **Authentication → URL Configuration** set the site URL and add the redirect URLs (the live site and `http://127.0.0.1:5173/WorldNotes/`)
3. For Google sign-in, create an OAuth client in Google Cloud Console and enter its client ID and secret in **Authentication → Sign In / Providers → Google**. Email links work out of the box. For Discord, create an application in the Discord Developer Portal, add the Supabase callback URL under **OAuth2 → Redirects** and enter its client ID and secret under **Discord**.
4. Copy `.env.example` to `.env` and fill in the project URL and the public (publishable or anon) key from **Project Settings → API Keys**

The public key is meant to be visible in the page; row level security in the database keeps every user's data private. Never put the secret (service role) key in the code.

## Deployment

Pushing to `main` builds and deploys through GitHub Actions. In the repository settings set **Pages → Source** to **GitHub Actions** once.

For cloud sync on the live site, add two repository variables in **Settings → Secrets and variables → Actions → Variables**: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Without them the site is built without cloud sync.

## Credits

- Map data: [Natural Earth](https://www.naturalearthdata.com/) (public domain), via [world-atlas](https://github.com/topojson/world-atlas)
- Globe rendering: [globe.gl](https://github.com/vasturiano/globe.gl) and [three.js](https://threejs.org/)
- Geography helpers: [d3-geo](https://github.com/d3/d3-geo) and [topojson](https://github.com/topojson/topojson)
- Flags: [flag-icons](https://github.com/lipis/flag-icons)
- Cloud sync: [Supabase](https://supabase.com/)
