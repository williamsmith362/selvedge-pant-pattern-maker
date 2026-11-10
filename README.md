# Selvedge pattern notebook

A personal, mobile-first manual jeans drafting worksheet. Static HTML, CSS and JavaScript, with no build step or third-party runtime scripts. GitHub Pages publishes the existing `main` branch through the retained Pages workflow.

## Use

1. Choose **Pants · around**, **Pants · flat ×2**, or **Body · around** independently for waist and seat. Body ease is explicit in Fit details and is not added to garment inputs.
2. Enter finished band height, **vertical crotch depth** from the top of the intended waistband, total length, and one hem's flat opening. State whether total length includes the band. A curved front-rise measurement is an optional reference target, never a substitute for vertical depth.
3. Read the front/back stitching-line dimensions. Add cutting allowances outside these lines. True waist curves and check curved seam lengths on the actual draft.
4. Use the cloth planner for a conservative arrangement of four panel envelopes. It allows at most two selvedge-anchored panels per row. Enter a reserve and check that the actual waistband, yoke, fly, pockets, belt loops, and any extra back-rise shaping fit the layout.

The leg split remains **45% front / 55% back** by default. The back waist allocation is **0.5 inch larger than the front allocation** on each side, while the combined waist target stays constant. Back crotch extension remains larger than front. These settings preserve intentional back/front balance; they do not establish that a pattern will hang correctly without seam-length, grain and fit checks.

## Measurement model

All state is stored in inches. Unit changes only change input/output presentation. Decimal and fractional inputs are supported; fraction output rounds to the nearest 1/16 inch. Decimal output retains up to three places. Calculations use unrounded values.

- `W = entered waist × (flat ? 2 : 1) + (body ? waist ease : 0)`
- `H = entered seat × (flat ? 2 : 1) + (body ? seat ease : 0)`
- `finished total = entered length + (starts below band ? band height : 0)`
- `panel height = finished total − band height`
- `crotch level = vertical depth + selected crotch drop − band height`
- `leg span = panel height − crotch level`
- `seat level = measured waist-to-seat − band height`, or the selected proportion of panel crotch depth (75% by default)
- `front waist allocation = W/4 − back waist advantage/2`
- `back waist allocation = W/4 + back waist advantage/2`
- `base seat width = H/4`
- `Q = H/8 − selected deduction` (deduction defaults to 0.5 inch)
- `front crotch-point width = H/4 + Q/2`
- `back crotch-point width = H/4 + Q`
- `back seat offset reference = Q/4`
- `knee distance = measured crotch-to-knee`, or 40% of leg span
- `point 2 = halfway from knee to hem`
- `knee circumference = 2 × selected flat knee`, defaulting to `2 × (flat hem + 0.5 inch)`
- `point 2 circumference = 2 × selected flat point 2`, defaulting to hem circumference
- Each leg circumference is divided by the chosen front/back share.

These are reference dimensions for a proportional manual block. Waist allocations must be trued along shaped edges. Seat offset is a construction reference rather than automatic curve generation. The app does not generate the pattern curves or walk mating seams. The original front and back PDF guides are available under Drawing reference. The guided example pattern PDF uses the built-in test measurements and marks all 13 front/back result rows, including the seat offset and consecutive vertical sections. It is a reduced visual example; cutting allowances are added separately. Calculator allowances remain separate from stitching-line measurements.

See [NMSU's distinction between crotch depth and crotch length](https://pubs.nmsu.edu/_c/C227/index.html).

## Fabric planning

The width envelope is the widest calculated horizontal dimension of each panel plus the outer allowance and the maximum applicable inner-edge allowance. Length is panel height plus waist attachment allowance and hem turn-up. Four panels are arranged in valid single/pair rows, minimizing row count without rotation or nesting. Width shrinkage reduces the usable cloth width before packing. Purchase length is `(panel envelope length × rows + reserve) / (1 − length shrinkage)`. The original two-rise-width packing shortcut is gone.

This estimates the displayed rectangular envelopes, not a production cutting marker or guaranteed purchase minimum. Additional curved/back-rise shaping and all other pieces must be checked against the layout and reserve. Prewashed cloth uses 0% expected remaining shrinkage.

## Saved data and iPhone

The **How to measure** link opens `measure.html`, with **Body** and **Jeans** tabs. Fourteen lessons use original annotated vector illustrations, calculator-specific field mapping, direct links to the correct input, keyboard-accessible tabs, and linked primary measuring references. Tutorial navigation never changes measurements or source settings. The guide and illustration modules are cached for offline use with the calculator.

The interface follows saved draft → measurements → front/back results → fabric planning. System typography, readable phone controls and subtle dividers keep the everyday path clear. **Test measurements** stays visible beside the measurement heading, and the front/back reference diagram appears above calculated results. Fit details, proportions, notes, formulas and cutting allowances remain in labeled expandable sections. The tutorial shows preparation at the first step and keeps it available in **Before you measure** throughout.

Both headers show **Yousef Husari** with the supplied YH monogram, rendered dark in light mode and white in dark mode. The sun/moon button replaces the appearance menu and remembers the choice across the calculator, guide, reloads and browser-back navigation. Existing saved theme values remain supported. Changing appearance preserves draft data and any unfinished input. The same monogram is used by the browser favicon, 180px Apple touch icon, 192px/512px app icons and a separate maskable icon. The app manifest and iOS title use Yousef Husari; the app identity, scope and launch URL remain unchanged.

- Current measurements autosave to `sp_workspace_v2` on the same browser origin. Named drafts are saved snapshots and update when **Save draft** is used.
- Existing `sp_presets`, `sp_notes`, and `sp_history` are retained. Old presets migrate with their old rise stored as a curved target; vertical depth is intentionally left blank. Confirm their measurement sources and length convention before using them.
- Backup export includes current workspace, named drafts, notes, allowances and the old data. Import accepts old exports and new backups, merging named drafts instead of deleting the notebook.
- Browser/device data is local; there is no cloud sync. Keep an exported backup, especially before clearing browser storage or moving to a Home Screen app.
- In iPhone Safari, use **Share → Add to Home Screen**. After a successful online load, the service worker caches the application and original PDF references for offline use. Future online visits check the network for current files.

## Development and validation

Serve the repository with a static HTTP server, for example `python3 -m http.server 8000`. No dependencies are needed by the website.

Run `npm test` with Node 22 or later. Tests cover target conservation with a wider back, source/ease normalization, waistband origins, independent curved rise, measured overrides, invalid geometry, fabric width/selvedge constraints, shrinkage, fractions, old-preset migration, and comparison of both panels.

The interface is additionally checked in Safari's WebKit engine at phone, tablet and desktop widths. A physical sewing sample is still necessary to validate fit and how the finished jeans hang.
