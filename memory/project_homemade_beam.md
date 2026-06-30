---
name: project-homemade-beam
description: Homemade Beam - bill splitting mobile app built in this project directory
metadata:
  type: project
---

Full-stack bill splitting app built in /home/wilson/Desktop/code/homemade-beam.

**Why:** User requested full app build from build.md spec.

**Stack:**
- Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL (`backend/`)
- Mobile: React Native + Expo SDK 53 + Expo Router + Zustand (`mobile/`)
- UI designed via Google Stitch MCP (project ID: 15635644424898950700, design system: assets/9132001256312547063)

**Stitch screens generated:**
- Home Dashboard (screen 45105257e7494c50b6c83569b6861988)
- Login + Register (screens 4a2bdac6ae144b878ef2202ae88251dd, a954ce8444c94384a8c600dd1206520f)
- Groups (screen 9c2b28bd38d74c6793d11fe07ae036f9)

**How to apply:** To run: start Postgres, run `npm run db:migrate` in backend, then `npm run dev` in backend and `npm start` in mobile.
