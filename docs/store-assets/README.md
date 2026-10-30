# Store assets

Marketing and app-store files that are not shipped inside the mobile or website builds. Export from Pencil (`docs/pencil-new.pen`, **App icon concepts** option 7) or from `website/public/favicon.svg` (same CD monogram).

## `app-icon/`

| File | Use |
| --- | --- |
| `app-icon-source.svg` | Master artwork (1024×1024 viewBox). Regenerate PNGs after design changes. |
| `app-icon-1024.png` | **Apple App Store Connect** app icon (1024×1024 PNG, square; Apple applies the mask). |
| `app-icon-512.png` | **Google Play Console** high-res app icon (512×512 PNG). |

### Regenerate PNGs (Mac)

```sh
cd docs/store-assets/app-icon
rsvg-convert -w 1024 -h 1024 app-icon-source.svg -o app-icon-1024.png
rsvg-convert -w 512 -h 512 app-icon-source.svg -o app-icon-512.png
```

Install [librsvg](https://formulae.brew.sh/formula/librsvg) (`brew install librsvg`) if `rsvg-convert` is missing. For correct **Anton** letterforms, install the font on your Mac or open the SVG in a design tool and export from there.

### Store notes

- **Apple:** Upload `app-icon-1024.png` in App Store Connect. Do not bake in rounded corners.
- **Google Play:** Upload `app-icon-512.png` as the app icon. Adaptive launcher layers in `mobile/assets/` are separate from this listing asset.

## `Play Store/`

Phone screenshots and listing art uploaded to **Google Play Console** (closed testing and later production). Sources stay here so the team can re-export or replace them without hunting on a single Mac.

| File | Use |
| --- | --- |
| `1024 x 500 (Google Play Store Feature Graphic).png` | **Feature graphic** (1024×500, required on the main store listing). |
| `1024 x 500 (Google Play Store Feature Graphic).psd` | Editable source for the feature graphic. |
| `Screenshot_*.png` | **Phone screenshots** for the Play listing (capture from a staging account on a real device). |

Play icon upload still uses `app-icon/app-icon-512.png`, not this folder.
