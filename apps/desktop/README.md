# 1T Persona desktop app

Your character, standing on your desktop. An Electron shell around the web app in `apps/web`: it opens the `#/pet` page in a transparent, always-on-top window and lets clicks fall through wherever the character isn't.

```bash
cd apps/desktop
npm install                 # downloads Electron (~100 MB); not part of the root workspace on purpose
npm start                   # needs a web build first: npm run web:build (from the repo root)
ONE_T_URL=http://localhost:5190/#/pet npm start   # or point it at the dev server (npm run web)
npm run pack                # zips for macOS (Apple Silicon, Intel) and Windows in release/, with sha256 in manifest.json
```

- **Data.** The app has its own storage, separate from your browser. In the web app: Library → **Export all**, then drop the file on the desktop app. The file holds characters and chats, never keys.
- **What's in the window.** A see-through portrait if the character has one, the character's anone.life face if you added an anone.life key (it moves when they talk), otherwise a disc with their name.
- **Security.** Only the app's own pages load in the window; other links open in your browser. The page gets four functions from `preload.js` and nothing else.
- **Signing.** Builds are ad-hoc signed, not notarized, so the first launch needs one extra step. Proper signing needs an Apple Developer ID / a Windows code-signing certificate.
  - **macOS:** move the app to Applications and open it. macOS says it "could not verify" the app: click **Done**, then **System Settings › Privacy & Security** → **Open Anyway** next to *1T Persona*, and enter your password. Only once. On macOS 14 and earlier, right-click → Open → Open also works (on macOS 15+ it no longer does).
  - **Windows:** SmartScreen appears: **More info → Run anyway**.
- **Icon.** `build/icon.*`. If you publish a fork, use your own name and icon (see TRADEMARKS.md).
- **Testing.** `scripts/smoke.js` runs the real window in a throwaway profile and plays a list of steps (run JS, move the mouse, take screenshots), logging every click-through switch.
