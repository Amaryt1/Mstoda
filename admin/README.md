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

When you click save, the dashboard prepares a JSON request in a GitHub Issue.
This request is ONLY staged. It does NOT modify apps.json automatically.
The owner must open Actions > AMARYT Admin | Confirm owner request, choose
Run workflow, and enter that Issue number as a SECOND explicit confirmation.
Both the Issue author and the manually-triggered workflow actor must be the
GitHub-verified owner account ID 190318829. The backend validates the request
before writing apps.json. Closed requests cannot be executed again.

No PAT, OAuth client secret, signing certificate, password or write token is
stored in the dashboard. Other users could view the public site and submit
issues, but their issues cannot execute the catalog-writing job.

Repository administrators with direct write access can still change code
and workflows, so do not give such access to untrusted people.

## Open the dashboard

The dashboard is published on GitHub Pages at:
https://amaryt1.github.io/Mstoda/

GitHub Pages for this public repository is PUBLIC and cannot enforce a
GitHub sign-in before viewing the interface. GitHub-only verification protects
all modifications, NOT visibility. The original Mstoda/apps.json and IPA links
remain public, as requested. Do not represent the dashboard as private.

## Change an app

1. Open AMARYT Admin and load the live catalog.
2. Use Add, Edit or another action. Published new apps need a version
   and HTTPS IPA download URL. Hidden drafts need no release yet.
3. Choose Save via GitHub, review the data, and click Open GitHub request.
4. In GitHub, log in as the owner and select Submit new issue. No catalog
   change happens at this first step.
5. Open https://github.com/Amaryt1/Mstoda/actions/workflows/admin-confirm.yml
6. Click Run workflow; enter the Issue number; click Run workflow again.
   The server checks the authenticated GitHub actor and Issue author.
7. On success GitHub Actions updates apps.json and closes the Issue.
   Refresh the dashboard to see the change.

For very large requests, the panel copies the JSON text and opens a blank
issue; paste the text before clicking Submit.

Media files are managed via GitHub's normal upload UI for now: the panel
edits HTTPS icon/banner/screenshot links only. No untrusted access token
is stored in the browser to upload binary files.

## Validate

Run these commands from the repository root:

    python3 -m unittest discover -s tests -p 'test_admin_*.py' -v
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

## Email verification / external services

No email address, mail delivery service, Cloudflare account, OAuth application,
or personal access token is required for the two-step GitHub workflow.
Turn on two-factor authentication in your GitHub account settings.

The experimental Cloudflare email-OTP proposal is not part of this release.
