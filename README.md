# work-map

An interactive map of my projects, plus reusable architecture diagrams. Static
site: plain HTML, CSS and JavaScript, no build step and no dependencies other
than Google Fonts.

- `index.html`: the landing map, rendered from `projects.json`
- `arch.html?spec=NAME`: a project architecture diagram, rendered from `specs/NAME.json`
- `assets/diagram.js`: the shared renderer (layout, arrows, hover, tooltips, keyboard)
- `assets/style.css`: dark and light themes (dark is the default)

## Run it locally

`fetch()` does not work from `file://`, so serve the folder:

```
python3 -m http.server 8000
# open http://localhost:8000/ and http://localhost:8000/arch.html?spec=cadence-pipeline
```

## Publish on GitHub Pages

1. Create a repo named `work-map` under your account and push this folder to `main`.
2. In the repo: Settings > Pages > Source: Deploy from a branch > `main` / root.
3. The site appears at `https://chrishoangle.github.io/work-map/`.

## Embed in Notion

In Notion, type `/embed` and paste `https://chrishoangle.github.io/work-map/`.
The layout fits a ~900px wide embed; below 640px the groups stack vertically.
Add `?theme=light` to the URL if you want the embed to start in light mode.
Every node opens in a new tab, so clicks never navigate inside the Notion frame.

## Edit a link

Open `projects.json` and change the node's `link`. Leave `link` empty (`""`) and
the node shows "case study soon" and is not clickable.

## Add a project

Add an object to `nodes` in `projects.json`:

```json
{
  "id": "my-project",
  "group": "sci",
  "title": "Project title",
  "subtitle": "One line about it",
  "stack": ["Python", "BigQuery"],
  "status": "shipped",
  "link": "https://...",
  "diagram": "my-project"
}
```

- `group` must match an `id` in `groups`. Add a new group there to get a new container.
- `status`: `shipped` (solid box), `planned` (dashed box, means in progress), or
  `tbd` (dotted box, details still to confirm).
- `stack` is what the hover tooltip shows.
- `diagram` (optional) adds an "architecture" link to `arch.html?spec=my-project`.

## Arrows

Only add arrows between things that really share data or code:

```json
"edges": [
  { "from": "node-a", "to": "node-b", "label": "reads", "status": "planned" }
]
```

`label` and `status` are optional. Planned edges are dashed. The landing map
currently has no edges on purpose.

## Add an architecture diagram

Copy `specs/cadence-pipeline.json` to `specs/my-project.json` and edit it. Same
format as above: `title`, `intro`, `groups` (drawn left to right as columns),
`nodes`, `edges`. Set `"draft": true` to show a "placeholders until confirmed"
banner. Keep work diagrams high level: no internal hostnames, table names, or
customer data.

## Accessibility

Nodes are links (or focusable boxes when there is no link) with ARIA labels.
Tab moves between nodes, Enter opens the case study, and focus shows the same
highlight and stack tooltip as hover. A text list of each diagram's data flow
is included for screen readers.
