# Fitness PWA V2 Design

Date: 2026-07-08

## Status

User approved the visual direction after reviewing browser mockups:

- Information architecture combines option A and option C from brainstorming.
- Visual style uses medium-deep blue, orange accents, and glass-like cards.
- Green is not part of the core visual language.
- The 3D muscle model direction is approved, but the character should be a lean athletic Asian male, not an oversized bodybuilder.
- The first implementation can ship with a replaceable lightweight model asset if a production-quality GLB/GLTF asset is not ready.

## Goals

V2 improves the existing local-first PWA without changing the product into a native app yet.

Primary goals:

- Make daily logging faster on iPhone 15 Pro-sized screens.
- Reduce long scrolling by folding secondary nutrition and report details.
- Support opening existing food and training records, editing them, and saving changes.
- Move export and data deletion to Reports only.
- Add training history comparison to Overview.
- Add a 3D muscle map concept to Overview, with front/back rotation and recency color states.
- Use bilingual labels everywhere: English abbreviation or English label plus Chinese label and units where relevant.

## Visual Direction

The approved visual style is:

- Background: medium-deep blue gradient, lighter than the first dark concept and darker than the very pale blue concept.
- Cards: translucent glass-like white cards with blue shadows and soft blur.
- Primary accent: orange for actions, progress, and highlighted current training.
- Secondary status: deep blue or steel blue for muscles that need attention.
- Typography: compact labels, strong numeric hierarchy, no negative letter spacing.
- Target device: iPhone 15 Pro first, while keeping responsive desktop behavior.

The app should feel more energetic and modern than V1, but still usable for frequent logging.

## Label System

All visible field labels should combine English and Chinese.

Rules:

- Use common abbreviations when they are recognizable.
- If no good abbreviation exists, use uppercase English.
- Include Chinese beside the English label.
- Include units in the label when the field has units.

Examples:

- `CAL 热量(KCAL)`
- `PRO 蛋白(g)`
- `CARB 碳水(g)`
- `FAT 脂肪(g)`
- `GRAMS 克数(g)`
- `WGT 重量(KG)`
- `REP 次数`
- `DUR 时长(MIN)`
- `EXER 动作`
- `MUS 肌群`
- `HAND 器械方式`
- `MIC 微量元素`
- `VIT 维生素`
- `MIN 微量元素`

Food `GRAMS 克数(g)` is optional. Blank grams should be saved safely and should not block food entry creation.

## Navigation And Page Structure

The app keeps four tabs:

- Overview 总览
- Food 食物
- Training 训练
- Reports 报告

Export buttons should be removed from Overview, Food, and Training. Reports owns export and record cleanup actions.

## Overview

Overview becomes a shorter command center.

It should include:

- Daily date control.
- Goal card: selected body part, exercise, and weight goal.
- Best exercise note: user-defined preferred movement or reminder.
- Personal memo: user-defined standards, notes, or training rules.
- Key metrics: calories, protein, net calories, training load.
- 3D muscle map area.
- Recent food and training records, each tappable for edit/view.
- Training comparison for the selected exercise and muscle group, using the previous four matching sessions plus today.
- Collapsible micronutrient summary.

The selected exercise and muscle group for comparison come from same-day training records. If multiple records match, show the most recently updated strength exercise first.

## 3D Muscle Map

The target design is a realistic, rotatable 3D muscle map:

- Rendered with Three.js.
- Character direction: lean athletic Asian male, short dark hair, realistic head, fitted dark athletic shorts.
- Supports front/back rotation or a clear front/back toggle.
- Muscle groups are color-coded by recency:
  - Red: trained in the last 0-1 days.
  - Orange: trained in the last 2-3 days.
  - Deep blue / steel blue: not trained for 7 or more days, or needs attention.
  - Neutral skin tone: no relevant state.
- The implementation should keep the model asset replaceable. If a final GLB/GLTF model is unavailable, V2 can ship a lightweight model scene with the same data mapping and interaction boundary.

The model must not rely on a front-only view. Back muscles need a way to be inspected.

## Food

Food should be shorter and more editable.

Required changes:

- `GRAMS 克数(g)` becomes optional.
- Main food fields stay visible.
- Vitamins and micronutrients move into collapsible sections.
- Existing food entries become tappable list items.
- Tapping an entry opens an edit/view state using the same page or an inline detail panel.
- Edited entries can be saved.
- Delete remains available but should not be the only record action.

Suggested visible primary fields:

- DATE 日期
- MEAL 餐次
- FOOD 食物
- GRAMS 克数(g)
- CAL 热量(KCAL)
- PRO 蛋白(g)
- CARB 碳水(g)
- FAT 脂肪(g)
- SOURCE 来源

Collapsed fields:

- Fiber, sugar, sodium.
- Calcium, iron, magnesium, potassium, zinc.
- Vitamins A, C, D, B12.

## Training

Training becomes a single logging surface with a mode switch.

Modes:

- Strength 力量
- Outdoor 户外

Strength fields:

- DATE 日期
- EXER 动作
- MUS 肌群
- HAND 器械方式: single 单手 or double 双手
- DUR 时长(MIN)
- WGT 重量(KG), six optional boxes
- REP 次数, six optional boxes mapped to the same set indexes
- Notes 备注

The six weight boxes and six rep boxes represent up to six sets. All set boxes are optional. Empty pairs are ignored. A partial pair should still be handled predictably:

- Weight with blank reps counts as zero reps for volume.
- Reps with blank weight counts as zero weight for volume.
- Both blank means the set is ignored.

Exercise and muscle group should offer fixed common options while still allowing custom values later if needed.

Initial muscle group options:

- Chest 胸
- Back 背
- Shoulders 肩
- Biceps 二头
- Triceps 三头
- Core 核心
- Glutes 臀
- Quads 股四头
- Hamstrings 腘绳肌
- Calves 小腿
- Full body 全身

Initial exercise options can include common movements such as bench press, squat, deadlift, shoulder press, row, pull-up, curl, triceps pushdown, leg press, lunge, and plank.

Outdoor fields remain shorter:

- DATE 日期
- TYPE 类型
- DUR 时长(MIN)
- DIST 距离(KM)
- INT 强度
- Notes 备注

## Reports

Reports owns long-range management.

It should include:

- Excel export.
- Date-based deletion or cleanup.
- Weekly report charts.
- Collapsible macronutrient, vitamin, and micronutrient sections.
- Record management preview by date.

Date deletion should be guarded by confirmation and should clearly state the date or range being deleted.

## Data Model

V2 should preserve existing IndexedDB stores and support backward compatibility where possible.

Food entries:

- Allow grams to be blank or zero without breaking summary calculations.
- Preserve `nutrientsPer100g` for compatibility.

Training sessions:

- Strength exercises should store set arrays with per-set `weight` and `reps`, plus a session-level `handMode` of `single` or `double`.
- Existing V1 records with repeated uniform sets should still summarize correctly.
- New V2 records should support up to six independent set rows.

Settings or local metadata can later store:

- User fitness goals.
- Best exercise notes.
- Personal memo.
- Preferred exercise and muscle group options.

## Testing

Expected automated coverage:

- Food grams optional behavior.
- Bilingual label rendering for representative Food, Training, Overview, and Reports fields.
- Strength set matrix creation with blank and partial rows.
- Training volume calculation from independent sets.
- Existing records can open for edit and save changes.
- Reports owns export action.
- Date deletion removes selected date records and leaves other dates intact.
- Collapsed micronutrient and vitamin sections render in Overview, Food, and Reports.
- Existing V1 tests continue passing.

## Implementation Notes

Keep changes scoped:

- Do not rewrite the whole app framework.
- Preserve local-first IndexedDB behavior.
- Prefer incremental changes to the current `src/app.js` structure unless a small helper module clearly reduces complexity.
- Three.js model integration should be behind a small boundary so the final asset can be swapped later.

## Out Of Scope For This V2 Pass

- Native iOS or Android app packaging.
- Cloud sync.
- AI food recognition backend.
- Final commercial 3D model purchase or licensing.
- Account login.
