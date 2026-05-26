# SpaceFighterV

A browser-based space shooter with persistent score saving.

**Live:** https://spacefighterv.vercel.app

---

## Summary

SpaceFighterV is a canvas-based space shooter built in React and TypeScript. Shoot waves of descending invaders, rack up your score, and save it to a global leaderboard. The game runs entirely in the browser, works on mobile with touch controls, and generates all sound procedurally via the Web Audio API (no audio files needed).

The original version (2019) used a CRA + Express + Heroku stack. This rebuild (2025) replaces the dead Heroku backend with Next.js API routes and MongoDB Atlas, fixes the plaintext password vulnerability by switching to bcrypt, and adds JWT expiry.

---

## Features

- Space invaders gameplay with progressive wave difficulty
- Scrolling star field, particle explosions, and screen flash on death
- Procedural sound FX and a heartbeat soundtrack that speeds up as invaders dwindle
- Touch controls for mobile (left, right, fire buttons)
- Account system: register, login, save scores
- Leaderboard at `/scores`

## Stack

- **Frontend:** Next.js 15, React 18, TypeScript, Canvas API, Web Audio API
- **Backend:** Next.js API routes (serverless)
- **Database:** MongoDB Atlas via Mongoose
- **Auth:** bcryptjs + JSON Web Tokens (7-day expiry)
- **Deployment:** Vercel

## Security fixes vs. original

| Issue | Original | Fixed |
|---|---|---|
| Passwords | Plaintext in MongoDB | bcrypt (12 rounds) |
| JWT expiry | Never | 7 days |
| Score ownership | Client sends username | JWT payload used server-side |
| Input validation | None | Length + type checks |
| Mongoose API | Deprecated callbacks | Async/await, Mongoose 8 |

---

## Local setup

```bash
cd web
npm install
cp ../.env.example .env.local
# Fill in MONGODB_URI and JWT_SECRET in .env.local
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel. Vercel reads `vercel.json` and builds from `web/`.
3. Add environment variables in Vercel project settings:
   - `MONGODB_URI` (your MongoDB Atlas connection string)
   - `JWT_SECRET` (run `openssl rand -hex 32` to generate one)

---

## Controls

| Input | Action |
|---|---|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Space | Shoot |
| Enter | Start / restart |
| Touch buttons | Mobile controls |
