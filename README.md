# Voxento Multiplayer Demo Frontend

Modern Phaser 3 + React client for the Voxento multiplayer prototype. The game connects to a Colyseus backend, renders a shared tilemap world, and layers quiz-driven health rewards on top of a stamina-like movement system.

![screenshot](screenshot.png)

## Feature Highlights

- Real-time multiplayer locomotion synchronized via Colyseus snapshots.
- 1,000 HP health economy rendered as `0% – 1000%` to emphasize stamina depletion.
- Animated gold and red coins that heal 10% (100 HP) and 15% (150 HP) respectively.
- Quiz overlay powered by React + MUI with fallback general-knowledge MCQs and +100 HP rewards for correct answers.
- Remote player labels showing live health percentages and tint to match server palette.

## Repository Layout

```text
game_backend/   ← Colyseus room + schema
game_frontend/  ← This React / Phaser client
```

This README only covers the frontend. See `game_backend/README.md` (or create one) for server specifics.

## Requirements

- [Node.js 20+](https://nodejs.org/) for both frontend and backend work.
- npm (bundled with Node) for dependency management.

## Install & Run

From the repository root:

```bash
# Backend setup
cd game_backend
npm install
npm run dev

# Frontend setup (new shell/tab)
cd ../game_frontend
npm install
npm run dev
```

- Backend dev server defaults to `ws://localhost:2567`.
- Frontend dev server defaults to `http://localhost:5173` (standard Vite port).

## Environment Variables

The frontend optionally consumes `VITE_QUIZ_API_URL` to fetch remote quiz questions. When the variable is unset, the bundled fallback MCQs (including several general trivia questions) are used.

Create a `.env.local` file in `game_frontend` if you need to override the defaults:

```ini
VITE_QUIZ_API_URL=https://example.com/quiz
```

## Gameplay Notes

- Movement spends 2 HP on every discrete cost tick; when health hits 0 the player is rooted until they heal.
- Coins spawn across the tilemap with spacing constraints to prevent clusters. Pickups play a sparkle effect and heal instantly without waiting for server confirmation.
- Quiz prompts lock the player in place while the overlay is visible. Correct answers restore 100 HP (10%).
- Both local HUD and remote name labels display health as a clamped value between `0%` and `1000%`.

## Project Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch Vite in development mode with hot module reload |
| `npm run build` | Produce a production bundle in `dist/` |
| `npm run preview` | Serve the built bundle locally for smoke tests |

## Tech Stack

- Phaser 3.90 for rendering and physics.
- React 19 for UI overlays and state management.
- Vite 6 for bundling and dev tooling.
- TypeScript 5 for type safety across Phaser, React, and shared types.

## Conventions

- Shared TypeScript types between client and server live in `game_frontend/src/types` and mirror the Colyseus schema.
- Helper modules for the main scene live in `game_frontend/src/game/scenes/helpers` (coin spawning, quiz event wiring, etc.).
- Health-related UI logic is centralized in `LocalHealthController` to keep the scene lean.

## Credits

This project began from the official Phaser React TypeScript template. Large portions of the original documentation and tooling remain intact—thanks to Phaser Studio Inc. for the excellent starter kit.

Created by the Voxento team.
