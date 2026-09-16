# A Little Corner - Zamora prototype

A small React + TypeScript + Vite blog demo.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` checks TypeScript and creates the production build.

## Writing stories

Open **Writer login** in the footer (or `/writer`). On your first visit, choose and confirm a password of at least 8 characters. Once logged in, create, read, edit, or delete stories. Deleting requires confirmation. Log out to return to read-only mode; refreshing also logs you out.

The password is stored as a salted PBKDF2-SHA-256 hash (210,000 iterations), never as plaintext. This requires HTTPS or localhost for Web Crypto.

This is intentionally a **browser-only demo**, not server authentication: localStorage holds the stories and password hash, and the login is a UI gate that someone with browser tools can bypass. Every browser has its own password and posts. Other visitors see the original sample stories. Clearing this site's browser data removes local posts and resets the password; there is no password recovery. Do not use this to protect private content. Drafts are not autosaved.

The original sample stories live in `content/posts.json`. Edits in the demo do not change that file or GitHub. Publishing shared posts later would require a backend.

## GoDaddy Node.js hosting

- Repository root: this folder; branch: `main`.
- Node: 22.12+ (or 20.19+); the `engines` field records Vite's minimum requirement.
- Install: `npm ci` (production-only installs also include the build tools).
- Build: `npm run build`.
- Start: `npm start`.

`server.mjs` serves only the production `dist/` folder, binds to `0.0.0.0`, and reads GoDaddy's `PORT` environment variable (defaults to 3000 locally). Direct page links fall back to `index.html`; missing assets return 404. HTTPS is supplied by the host and is needed for password hashing outside localhost. No database or server-side password is required for this browser-only demo.

After pushing, redeploy the latest commit in GoDaddy's preview. A server is now included for hosting the files; posts and login still stay in each visitor's browser.
