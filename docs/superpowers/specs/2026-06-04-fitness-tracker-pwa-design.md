# Fitness Tracker PWA Design

Date: 2026-06-04

## Summary

Build a mobile-first Progressive Web App for tracking fitness, food, nutrition, and weekly progress. The first release focuses on fast manual entry, local-first storage, professional daily summaries, weekly charts, and Excel export. Future AI food recognition, cloud sync, food libraries, exercise libraries, and device imports are explicitly prepared for but are not required for the first release.

## Goals

- Let the user record food and training from a phone quickly.
- Calculate calorie intake from food entries.
- Calculate estimated calorie expenditure from training entries.
- Track macronutrients and common micronutrients.
- Track strength training volume and sport-specific metrics.
- Show a professional daily dashboard without making routine entry cumbersome.
- Generate weekly visual reports in the app.
- Export clean Excel workbooks for review and further analysis.
- Keep the first version local-first while preserving a path to cloud sync.

## Non-Goals For The First Release

- User accounts and cloud synchronization.
- Production AI food recognition.
- Barcode scanning.
- Wearable, Apple Health, Garmin, or Strava import.
- Full nutrition database coverage.
- Medical advice, diagnosis, or strict dietary recommendations.

## Product Shape

The app is a mobile-first PWA. The user can open it in a mobile browser and add it to the home screen. The first release stores data locally in the browser. The data model includes stable IDs, timestamps, and version fields so later cloud sync can reuse the same records.

The app has four bottom navigation tabs:

1. Overview
2. Food
3. Training
4. Reports

## Overview Page

The Overview page is the default first screen. It should show dense but scannable daily information:

- Date and quick actions.
- Calorie balance: intake, exercise expenditure, and net difference.
- Goal band for the current phase, such as fat loss, maintenance, or muscle gain.
- Macronutrient progress: protein, carbohydrate, fat.
- Micronutrient progress: calcium, iron, magnesium, potassium, zinc, vitamin A, vitamin C, vitamin D, vitamin B12, sodium, and fiber.
- Training load: strength volume, total sets, aerobic distance, aerobic duration.
- Recent food and training snippets.
- Weekly trend preview.
- Excel export entry point.

The visual density follows the approved professional dashboard mockup: higher information density than a casual diary, but still optimized for quick phone scanning.

## Food Recording

Food records are organized by day and meal. Supported meal labels are breakfast, lunch, dinner, snack, pre-workout, post-workout, and custom.

Each food entry stores:

- Date and meal label.
- Food name.
- Serving weight in grams.
- Optional serving description.
- Calories per 100g.
- Protein per 100g.
- Carbohydrate per 100g.
- Fat per 100g.
- Fiber per 100g.
- Sugar per 100g.
- Sodium per 100g.
- Calcium per 100g.
- Iron per 100g.
- Magnesium per 100g.
- Potassium per 100g.
- Zinc per 100g.
- Vitamin A per 100g.
- Vitamin C per 100g.
- Vitamin D per 100g.
- Vitamin B12 per 100g.
- Source, such as manual, template, imported, or ai-draft.
- Confidence score for future AI-generated entries.
- User confirmation state for future AI recognition.

The first release supports manual entry and reusable templates. A user can duplicate a previous food or save a custom food template.

## Training Recording

Training records support three major categories.

### Strength Training

Each strength session contains exercises. Each exercise contains sets.

Exercise fields:

- Exercise name.
- Target muscle group.
- Equipment type.
- Notes.

Set fields:

- Set number.
- Reps.
- Weight.
- Weight unit.
- RPE or effort, optional.
- Rest time, optional.

Strength calculations:

- Exercise volume equals sum of reps multiplied by weight.
- Session volume equals total exercise volume.
- Total sets equals count of work sets.
- Estimated calories use duration, body weight when available, and a MET-style strength training estimate.

### Other Training

For training such as HIIT, yoga, mobility, martial arts, rowing machine, stair climber, or sport practice, the record stores:

- Activity type.
- Duration.
- Intensity.
- Optional distance.
- Optional average heart rate.
- Optional activity-specific fields.
- Estimated calories from MET and user body weight if available.

### Outdoor Training

For running, cycling, walking, hiking, and similar outdoor activities, the record stores:

- Activity type.
- Duration.
- Distance.
- Pace or speed.
- Elevation gain, optional.
- Average heart rate, optional.
- Estimated calories from activity type, duration, body weight, and distance where appropriate.

## Calculations

Calculations are isolated in utility functions so UI components do not own business logic.

Food calculation:

- Nutrient amount equals per-100g value multiplied by serving grams divided by 100.
- Daily intake equals sum of all food entries for the day.
- Weekly intake equals grouped daily totals for the selected week.

Training calculation:

- Strength volume equals sum of set reps multiplied by set weight.
- Training calories use a configurable MET table by activity type and intensity.
- Formula: calories equals MET multiplied by body weight in kilograms multiplied by duration in hours.
- If body weight is unavailable, the app uses a configurable default and labels the result as estimated.

Goal calculation:

- Daily calorie balance equals food calories minus training calories.
- Macro progress compares daily intake with configured targets.
- Micronutrient progress compares daily intake with configured recommended intake values.

All calculation outputs retain units and source metadata.

## Reports

Reports are weekly-first. The report page includes:

- Daily calorie intake vs training expenditure.
- Net calorie balance by day.
- Protein intake by day.
- Macronutrient split.
- Micronutrient completion summary.
- Strength training volume by day.
- Aerobic duration and distance by day.
- Body weight and body fat trend section, shown only after the user records those values.

Charts should be responsive and readable on mobile. Initial chart types:

- Bar chart for daily calories.
- Line chart for body weight and future body fat trend.
- Bar chart for strength volume.
- Stacked or grouped chart for macronutrients.
- Compact progress list for micronutrients.

## Excel Export

The app exports an `.xlsx` workbook. The first release includes these sheets:

1. Daily Summary
2. Food Details
3. Training Details
4. Nutrition Stats
5. Weekly Report Data

Excel export prioritizes clean structured data. In-app charts are the source of visualization. Embedded Excel charts are optional later.

Daily Summary columns:

- Date
- Intake Calories
- Training Calories
- Net Calories
- Protein
- Carbohydrate
- Fat
- Fiber
- Strength Volume
- Training Duration
- Aerobic Distance

Food Details columns:

- Date
- Meal
- Food
- Serving Grams
- Calories
- Protein
- Carbohydrate
- Fat
- Fiber
- Sugar
- Sodium
- Calcium
- Iron
- Magnesium
- Potassium
- Zinc
- Vitamin A
- Vitamin C
- Vitamin D
- Vitamin B12
- Source

Training Details columns:

- Date
- Category
- Activity Or Exercise
- Muscle Group
- Sets
- Reps
- Weight
- Duration
- Distance
- Intensity
- Volume
- Estimated Calories
- Notes

## Local-First Storage

The first release stores data locally in the browser using IndexedDB. Records include:

- `id`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `schemaVersion`
- `syncStatus`

This allows future migration to cloud sync without replacing the record model. The UI should also provide backup export through Excel and later may add JSON export/import.

## Future AI Food Recognition

AI recognition is designed as a future workflow:

1. User uploads a photo or enters a text description.
2. AI proposes food items, estimated serving sizes, calories, macro values, and micronutrients where available.
3. The app shows an editable draft.
4. The user confirms or corrects the draft.
5. Confirmed items become normal food entries with source `ai-draft` or `ai-confirmed`.

The first release includes a non-blocking future feature card for AI food recognition. It does not open a production recognition flow until AI support is implemented.

## Error Handling

- Required fields show inline validation.
- Numeric fields reject invalid negative values except where explicitly meaningful.
- Missing optional body weight causes training calories to be marked as estimated.
- Export failures show a retryable error.
- Local storage failures show a clear message and suggest exporting data if possible.
- Calculation functions tolerate partial records and return warnings instead of breaking the page.

## Testing Strategy

Core calculation utilities need focused tests:

- Food nutrient scaling by serving weight.
- Daily and weekly nutrition aggregation.
- Strength volume calculation.
- MET-based calorie calculation.
- Excel export row shaping.

UI verification should cover:

- Creating a food entry.
- Creating a strength training entry.
- Creating an outdoor training entry.
- Viewing daily dashboard totals.
- Viewing weekly report charts.
- Exporting an Excel workbook.

## Acceptance Criteria

- The app runs as a mobile-first PWA.
- The user can manually create, edit, and delete food entries.
- Food entries calculate calories, macros, and selected micronutrients.
- The user can manually create, edit, and delete strength training entries.
- Strength entries calculate training volume.
- The user can record other and outdoor training entries.
- Training entries estimate calories.
- The Overview page shows the approved professional dashboard information.
- Weekly charts render from stored records.
- Excel export produces a workbook with the defined sheets.
- Data persists locally after page refresh.
- Calculation utilities are covered by tests.
