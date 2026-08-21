# FitLog

A personal workout tracker: log workouts, keep a full history, save reusable
routines, track progress/PRs per exercise, and a built-in rest timer.

No build step, no backend, no accounts. It's a plain HTML/CSS/JS
[PWA](https://web.dev/progressive-web-apps/) — all your data is stored
locally in your browser (`localStorage`) on whichever device you open it on.

## Running it locally

Any static file server works. For example, with Python:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.

## Deploying (so you can install it on your phone)

Push this folder to a GitHub repo, then enable **GitHub Pages** for it
(Settings → Pages → Deploy from branch → `main` / root). You'll get a URL
like `https://<username>.github.io/<repo>/`. Open that on your phone and use
"Add to Home Screen" (Chrome menu → Install app) to install it like a native
app — it'll work offline after the first load.

## Backing up your data

Since data lives only in the browser, use **Settings → Export backup** to
download a JSON snapshot of everything (workouts, routines, custom
exercises, settings). Save it to Drive, your computer, wherever. **Settings
→ Import backup** restores from that file — handy when switching phones or
recovering after clearing browser data.

## Data model

Everything is stored under a few `localStorage` keys as plain JSON — see
[`js/db.js`](js/db.js) for the schema (`fitlog_workouts`, `fitlog_routines`,
`fitlog_custom_exercises`, `fitlog_settings`).
