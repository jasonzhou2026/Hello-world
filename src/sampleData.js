export const defaultSettings = {
  bodyWeightKg: 70,
  calorieGoal: 2400,
  calorieGoalBand: { min: 250, max: 400, label: "增肌期" },
  preferredExercise: "squat 深蹲",
  preferredMuscleGroup: "quads 股四头",
  weightGoalKg: 100,
  bestExerciseNote: "Keep depth consistent 保持深度一致",
  personalMemo: "Progress slowly, recover fully 稳步加重，充分恢复",
  macroTargets: { protein: 140, carbs: 280, fat: 70 },
  micronutrientTargets: {
    calcium: 1000,
    iron: 12,
    magnesium: 400,
    potassium: 3500,
    zinc: 11,
    vitaminA: 900,
    vitaminC: 100,
    vitaminD: 15,
    vitaminB12: 2.4,
    sodium: 2000,
    fiber: 30
  }
};

export const sampleFoodEntries = [
  {
    id: "sample-food-1",
    date: "2026-06-04",
    meal: "breakfast",
    name: "燕麦鸡蛋早餐",
    grams: 260,
    source: "template",
    nutrientsPer100g: {
      calories: 155,
      protein: 9.6,
      carbs: 18,
      fat: 5.2,
      fiber: 2.6,
      sodium: 140,
      calcium: 75,
      iron: 1.8,
      magnesium: 52,
      potassium: 210,
      zinc: 1.2,
      vitaminA: 80,
      vitaminC: 0,
      vitaminD: 1.2,
      vitaminB12: 0.5
    }
  },
  {
    id: "sample-food-2",
    date: "2026-06-04",
    meal: "lunch",
    name: "鸡胸糙米饭",
    grams: 420,
    source: "template",
    nutrientsPer100g: {
      calories: 168,
      protein: 13.5,
      carbs: 20,
      fat: 3.1,
      fiber: 1.8,
      sodium: 220,
      calcium: 28,
      iron: 1.1,
      magnesium: 44,
      potassium: 260,
      zinc: 1.0,
      vitaminA: 35,
      vitaminC: 8,
      vitaminD: 0,
      vitaminB12: 0.2
    }
  },
  {
    id: "sample-food-3",
    date: "2026-06-04",
    meal: "dinner",
    name: "三文鱼蔬菜",
    grams: 360,
    source: "template",
    nutrientsPer100g: {
      calories: 190,
      protein: 16,
      carbs: 6,
      fat: 11,
      fiber: 2.2,
      sodium: 180,
      calcium: 46,
      iron: 0.9,
      magnesium: 38,
      potassium: 390,
      zinc: 0.8,
      vitaminA: 220,
      vitaminC: 22,
      vitaminD: 5,
      vitaminB12: 1.6
    }
  }
];

export const sampleTrainingSessions = [
  {
    id: "sample-training-1",
    date: "2026-06-04",
    category: "strength",
    activityType: "strength",
    durationMinutes: 55,
    bodyWeightKg: 70,
    intensity: "moderate",
    exercises: [
      {
        name: "深蹲",
        muscleGroup: "腿",
        equipment: "杠铃",
        sets: [
          { reps: 5, weight: 80 },
          { reps: 5, weight: 80 },
          { reps: 5, weight: 80 },
          { reps: 5, weight: 80 }
        ]
      },
      {
        name: "卧推",
        muscleGroup: "胸",
        equipment: "杠铃",
        sets: [
          { reps: 6, weight: 55 },
          { reps: 6, weight: 55 },
          { reps: 6, weight: 55 },
          { reps: 6, weight: 55 }
        ]
      }
    ]
  },
  {
    id: "sample-training-2",
    date: "2026-06-04",
    category: "outdoor",
    activityType: "running",
    durationMinutes: 32,
    distanceKm: 5.2,
    bodyWeightKg: 70,
    intensity: "moderate",
    notes: "轻松跑"
  }
];
