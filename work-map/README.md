# work-map

An interactive map of my work, plus per-project architecture diagrams. It's a static site with no build step: plain HTML, vanilla JS, and inline SVG. The only external request is Google Fonts.

- **`index.html`** is the landing map. Every node opens its case study in a new tab.
- **`diagram.html?p=<spec>`** renders one architecture diagram from `specs/<spec>.json`.
- **`projects.json`** is the one file to edit for landing-map nodes, links, and connections.

```
work-map/
├── index.html            landing map
├── diagram.html          architecture diagram page (?p=spec-name)
├── projects.json         landing map data: groups, projects, links, edges
├── specs/
│   ├── cadence-activity.json
│   └── llm-cost-anomaly.json
├── assets/
│   ├── workmap.js        shared renderer (landing map + diagrams)
│   └── workmap.css       styles + light/dark themes
├── embed-test.html       previews the site in 900px iframes
└── .nojekyll
```

## Run locally

Browsers block `fetch()` of JSON from `file://`, so serve the folder:

```bash
cd work-map
python3 -m http.server 8000
# open http://localhost:8000
```

## Edit a link

Open `projects.json`, find the node, and replace its `url`. Placeholder links contain `REPLACE`, and the browser console lists any that are left.

```json
{ "id": "jpl-dtn", "url": "https://www.notion.so/your-jpl-case-study-page" }
```

## Add a project

Add an object to `nodes` in `projects.json`:

```json
{
  "id": "my-new-project",              // unique, kebab-case
  "group": "science",                  // id of a group in "groups"
  "title": "Short title",
  "subtitle": "One line about what it does",
  "stack": ["Python", "PyTorch"],      // shown in the hover tooltip
  "url": "https://www.notion.so/...",  // case study, opens in a new tab
  "status": "shipped"                  // or "in-progress" (dashed box)
}
```

Nodes appear in their group in the order they're listed. To add a whole new column, add a group:

```json
{ "id": "ml", "label": "Machine learning", "row": 0, "direction": "vertical", "accent": "blue" }
```

The accent can be `violet`, `teal`, `amber`, `blue`, `rose`, or `slate`.

## Connect two projects

Only connect projects that really share data or code. Add the connection to `edges`:

```json
{ "from": "cadence-activity", "to": "cadence-spend", "label": "billing view · xlsx writer", "dir": "none" }
```

- `dir` can be `"none"` (a plain line, used on the landing map), `"forward"` (an arrow, the default), or `"both"`.
- `"status": "planned"` makes the line dashed.
- Connected nodes in the same column need room for the label. That's what `"gap": 40` on the Cadence group provides.

## Architecture diagrams

`diagram.html?p=<name>` loads `specs/<name>.json` and renders it with the same component as the landing map.

The diagram flows top to bottom:

- `row` sets each group's stage, from 0 at the top.
- Groups in the same row sit side by side.
- `grow` sets each group's relative width.

```json
{
  "title": "Pipeline name",
  "summary": "One or two sentences.",
  "legend": { "shipped": "live", "pending": "planned", "edge": "data flow" },
  "groups": [
    { "id": "sources", "label": "Sources", "row": 0, "accent": "blue" },
    { "id": "_s1", "row": 1, "spacer": true, "grow": 1 },
    { "id": "jobs", "label": "Jobs", "row": 1, "accent": "violet", "grow": 3 }
  ],
  "nodes": [
    { "id": "db", "group": "sources", "title": "Postgres", "subtitle": "app data", "stack": ["Postgres"] },
    { "id": "next", "group": "sources", "title": "New source", "status": "planned" },
    { "id": "etl", "group": "jobs", "title": "Nightly ETL", "subtitle": "Cloud Run Jobs", "grow": 1 }
  ],
  "edges": [
    { "from": "db", "to": "etl", "label": "nightly" },
    { "from": "next", "to": "etl", "status": "planned" },
    { "from": "jobs", "to": "...", "label": "edges can start or end at a group id too" }
  ]
}
```

Layout tips:

- **Spacers.** A `"spacer": true` group is an invisible gap. Use one so a line can drop straight down without crossing a box. Spacers are hidden on phones.
- **Wide nodes.** `"grow"` on a node makes it wider. A wide node lets several lines enter it straight from above.
- **Label position.** Labels sit at the midpoint of the line. Nudge one with `labelAt` (0 to 1 along the curve), `labelDx`, or `labelDy` (pixels).
- **Phones.** Under 640px, diagrams with more than one row become stacked stages, and the lines turn into a readable "Connections" list.
- **Index page.** `diagram.html` with no `?p=` lists every project in `projects.json` that has a `"diagram"` field.

Keep Cadence diagrams high-level. Don't include internal hostnames, project, dataset, or table names, file paths, or customer data.

## Theme

Dark is the default. Visitors can toggle light/dark, and their choice is saved in their browser. To force a theme in an embed, add `?theme=light` or `?theme=dark` to the URL.

## Deploy to GitHub Pages

1. Create a public repo named `work-map` and push these files to `main`.
2. In the repo, go to Settings → Pages → Build and deployment, choose "Deploy from a branch", then `main` / `root`.
3. The site goes live at `https://chrishoangle.github.io/work-map/`. Diagrams are at `.../work-map/diagram.html?p=cadence-activity`.

```bash
cd work-map
git init -b main
git add .
git commit -m "Work map: landing map + architecture diagrams"
git remote add origin https://github.com/chrishoangle/work-map.git
git push -u origin main
```

## Embed in Notion

1. Type `/embed` and paste `https://chrishoangle.github.io/work-map/`.
2. Make the block full width, then drag its height to fit. About 560px works at full width.
3. In each case-study page, embed that project's diagram the same way, for example `https://chrishoangle.github.io/work-map/diagram.html?p=llm-cost-anomaly`.

Links open in a new tab, so clicks don't navigate inside the Notion iframe. Open `embed-test.html` to preview both pages at 900px.

## Accessibility

- Every node is a link, or a focusable element when it has no URL. Tab moves between nodes and Enter opens a link.
- Each node's `aria-label` includes its title, subtitle, stack, status, and "opens in a new tab".
- Hover and keyboard focus both highlight the node and its connections and show the tooltip.
- Connections are also listed as text for screen readers.
- Reduced-motion preferences turn off transitions.
