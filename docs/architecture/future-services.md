# Future Services Architecture

This document defines the boundary for features that cannot be honestly delivered by the current static, local-first PWA.

## Multi-device sync

- IndexedDB remains the immediate source of truth; logging must continue to work offline.
- Sync transports existing record envelopes (`id`, `createdAt`, `updatedAt`, `deletedAt`, `schemaVersion`, `syncStatus`) without changing nutrition or training payloads.
- The server stores encrypted-at-rest per-user records and tombstones. A device uploads records changed since its last cursor, then downloads newer records and tombstones.
- Conflicts are resolved per record by `updatedAt`; equal timestamps keep the server copy and surface a conflict copy for manual review rather than silently merging nested set arrays.
- Authentication, account deletion, encryption keys, retention, and export must be implemented before enabling sync in the UI.

## AI food estimation

- Image or text analysis is opt-in and never runs during ordinary local logging.
- The client sends only the selected image/text after explicit submission. The backend does not retain images after inference.
- A future `POST /v1/food-estimates` returns candidate foods, serving assumptions, nutrients per 100g, confidence, and model/version metadata.
- AI output always opens the existing Food form as an editable draft. Nothing is saved until the user reviews and confirms it.
- Low-confidence estimates must state the uncertainty and request grams or serving size; they must not invent micronutrients as exact values.
- Rate limits, per-request cost ceilings, abuse controls, consent copy, and a privacy policy are release blockers.

## Delivery order

1. Add account and encrypted sync service behind the existing storage adapter boundary.
2. Add conflict and deletion tests across two simulated devices.
3. Add the AI endpoint with structured responses and retention logging.
4. Add an opt-in Food draft flow and verify that canceling sends no record to IndexedDB.
