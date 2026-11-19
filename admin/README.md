# AMARYT Admin — GitHub-only application dashboard

An Arabic, mobile-friendly catalog administration panel for Amaryt1/Mstoda.
The iOS store continues to read the same public apps.json feed; nothing
inside Feather needs to change.

## Features in this first release

- Published, hidden and draft lists, with search, sorting and category filtering.
- Add, edit, duplicate, hide, show and delete catalog entries.
- Set displayed ordering and move apps up/down.
- Add or replace releases with HTTPS IPA URLs and notes; preserve prior releases.
- Manage icon, banner and up to five screenshot URLs per app.
- Bulk hide, show, delete and recategorize (up to 100 apps per request).
- Export full JSON for local backups; every change also has Git history.
- Responsive GitHub Pages frontend; no external backend or embedded credentials.

## Security model

The dashboard is a **static public website**, because this is a public GitHub
repository. Reading public catalog data is open to all; writing is NOT.

When you click save, the dashboard prepares a JSON request in a new GitHub
Issue. The user logs into GitHub and explicitly submits it. The workflow
only writes when GitHub reports the issue creator is the VERIFIED owner
account ID 190318829 in repository Amaryt1/Mstoda. The backend repeats
this check and validates every field before editing apps.json.

No PAT, OAuth client secret, signing certificate, password or write token is
stored in the dashboard. Other users could view the public site and submit
issues, but their issues cannot execute the catalog-writing job.

Repository administrators with direct write access can still change code
and workflows, so do not give such access to untrusted people.

## Activate the dashboard

1. Review and merge the feature/amaryt-admin-panel PR into Mstoda/main.
2. Open Mstoda > Settings > Pages.
3. In Build and deployment, select Source: GitHub Actions.
4. From Actions, run AMARYT Admin | Publish GitHub Pages if necessary.
5. Open the Pages address (normally https://amaryt1.github.io/Mstoda/admin/).

The website is NOT live until GitHub Pages is enabled and deployed.

## Change an app

1. Open AMARYT Admin and load the live catalog.
2. Use Add, Edit or another action. Published new apps need a version
   and HTTPS IPA download URL. Hidden drafts need no release yet.
3. Choose Save via GitHub, review the data, and click Open GitHub request.
4. In GitHub, log in as the owner and select Submit new issue.
5. GitHub Actions validates the request, updates apps.json and adds a
   comment to the request issue. Refresh the panel to see the change.

For very large requests, the panel copies the JSON text and opens a blank
issue; paste the text before clicking Submit.

Media files are managed via GitHub's normal upload UI for now: the panel
edits HTTPS icon/banner/screenshot links only. No untrusted access token
is stored in the browser to upload binary files.

## Validate

Run these commands from the repository root:

    python3 -m unittest discover -s tests -p test_admin_request.py -v
    python3 -m py_compile scripts/admin_request.py
    node --check admin/app.js

GitHub Actions checks syntax, tests and compatibility with the existing
apps.json feed.

## Planned later

- Automatic screenshot discovery only from licensed and verified sources.
- Authenticated binary media uploads without exposed secrets.
- Optional bulk CSV/JSON import with review, quotas and duplicate detection.
- Separately managing the larger Feather app catalog, which is not part
  of this Mstoda feed.

The original manage-app.yml GitHub Actions workflow remains available as
a fallback administration path.
