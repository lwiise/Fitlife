/**
 * Demo-mode dish library. Hand-written Gulf dishes used ONLY when an account is
 * in demo mode (see ./index.ts) — never shown to a real account, never sent to
 * a model. Amounts are ONE base serving at `base_kcal`; the demo day builder
 * scales them to each member's share of their day target, so two people eating
 * the same dish differ only in amounts and the engine's own shared-meal assembly
 * merges them into one family batch, exactly as it does for model output.
 *
 * Every Arabic string carries an English twin so the housekeeper's translated
 * view has real text to show in demo mode. Steps never embed quantities (those
 * scale per person), so one step text serves every portion.
 */

import type { Ingredient } from "../schema";

export type DemoSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface DemoIngredient {
  ar: string;
  en: string;
  amount: number;
  unit: Ingredient["unit"];
}

export interface DemoDish {
  name_ar: string;
  name_en: string;
  slot: DemoSlot;
  base_kcal: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: DemoIngredient[];
  steps: Array<{ ar: string; en: string }>;
  notes_ar?: string;
}

export const DEMO_BREAKFASTS: DemoDish[] = [
  {
    name_ar: "بيض مخفوق بالطماطم والبصل الأخضر مع خبز البر",
    name_en: "Scrambled eggs with tomato and spring onion, wholewheat bread",
    slot: "breakfast",
    base_kcal: 420,
    prep_minutes: 5,
    cook_minutes: 8,
    ingredients: [
      { ar: "بيض", en: "Eggs", amount: 2, unit: "piece" },
      { ar: "طماطم مفرومة", en: "Diced tomato", amount: 80, unit: "g" },
      { ar: "بصل أخضر", en: "Spring onion", amount: 15, unit: "g" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 1, unit: "tsp" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 60, unit: "g" },
    ],
    steps: [
      { ar: "سخّني الزيت في مقلاة على نار متوسطة.", en: "Heat the oil in a pan over medium heat." },
      { ar: "أضيفي الطماطم والبصل الأخضر وقلّبي حتى تلين الطماطم.", en: "Add the tomato and spring onion and stir until the tomato softens." },
      { ar: "اخفقي البيض مع رشة ملح وأضيفيه إلى المقلاة مع التقليب حتى ينضج.", en: "Whisk the eggs with a pinch of salt, add to the pan and stir until cooked." },
      { ar: "قدّميه مع خبز البر.", en: "Serve with the wholewheat bread." },
    ],
  },
  {
    name_ar: "فول مدمس بزيت الزيتون والكمون",
    name_en: "Ful medames with olive oil and cumin",
    slot: "breakfast",
    base_kcal: 450,
    prep_minutes: 5,
    cook_minutes: 10,
    ingredients: [
      { ar: "فول مطبوخ", en: "Cooked fava beans", amount: 180, unit: "g" },
      { ar: "ليمون", en: "Lemon juice", amount: 1, unit: "tbsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
      { ar: "كمون", en: "Ground cumin", amount: 0.5, unit: "tsp" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 50, unit: "g" },
      { ar: "خيار وطماطم", en: "Cucumber and tomato", amount: 1, unit: "unlimited" },
    ],
    steps: [
      { ar: "سخّني الفول مع قليل من الماء حتى يغلي.", en: "Warm the beans with a little water until they simmer." },
      { ar: "اهرسي الفول جزئياً وأضيفي الكمون والليمون.", en: "Partly mash the beans and stir in the cumin and lemon." },
      { ar: "ضعيه في طبق التقديم ورشّي زيت الزيتون على الوجه.", en: "Spoon into a serving dish and drizzle the olive oil on top." },
      { ar: "قدّميه مع الخبز والخضار.", en: "Serve with the bread and vegetables." },
    ],
  },
  {
    name_ar: "شوفان بالحليب والتمر والقرفة",
    name_en: "Oats with milk, dates and cinnamon",
    slot: "breakfast",
    base_kcal: 400,
    prep_minutes: 3,
    cook_minutes: 7,
    ingredients: [
      { ar: "شوفان", en: "Rolled oats", amount: 50, unit: "g" },
      { ar: "حليب قليل الدسم", en: "Low-fat milk", amount: 250, unit: "ml" },
      { ar: "تمر منزوع النوى", en: "Pitted dates", amount: 2, unit: "piece" },
      { ar: "قرفة", en: "Cinnamon", amount: 0.5, unit: "tsp" },
      { ar: "لوز مجروش", en: "Crushed almonds", amount: 10, unit: "g" },
    ],
    steps: [
      { ar: "ضعي الشوفان والحليب في قدر صغير على نار هادئة.", en: "Put the oats and milk in a small pot over low heat." },
      { ar: "أضيفي التمر المقطّع والقرفة وحرّكي حتى يتماسك الخليط.", en: "Add the chopped dates and cinnamon and stir until thick." },
      { ar: "زيّنيه باللوز وقدّميه دافئاً.", en: "Top with the almonds and serve warm." },
    ],
  },
  {
    name_ar: "لبنة بالزعتر مع خيار وخبز البر",
    name_en: "Labneh with za'atar, cucumber and wholewheat bread",
    slot: "breakfast",
    base_kcal: 410,
    prep_minutes: 5,
    cook_minutes: 0,
    ingredients: [
      { ar: "لبنة قليلة الدسم", en: "Low-fat labneh", amount: 100, unit: "g" },
      { ar: "زعتر", en: "Za'atar", amount: 1, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 1, unit: "tsp" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 60, unit: "g" },
      { ar: "خيار", en: "Cucumber", amount: 1, unit: "unlimited" },
      { ar: "بيض مسلوق", en: "Boiled egg", amount: 1, unit: "piece" },
    ],
    steps: [
      { ar: "افردي اللبنة في طبق ورشّي عليها الزعتر وزيت الزيتون.", en: "Spread the labneh on a plate and sprinkle with za'atar and olive oil." },
      { ar: "قطّعي الخيار والبيضة المسلوقة.", en: "Slice the cucumber and the boiled egg." },
      { ar: "قدّميها مع خبز البر.", en: "Serve with the wholewheat bread." },
    ],
  },
  {
    name_ar: "شكشوكة بالفلفل الملوّن",
    name_en: "Shakshuka with mixed peppers",
    slot: "breakfast",
    base_kcal: 430,
    prep_minutes: 5,
    cook_minutes: 15,
    ingredients: [
      { ar: "بيض", en: "Eggs", amount: 2, unit: "piece" },
      { ar: "فلفل ملوّن مقطّع", en: "Chopped mixed peppers", amount: 100, unit: "g" },
      { ar: "صلصة طماطم", en: "Tomato sauce", amount: 120, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 40, unit: "g" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 1, unit: "tsp" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 40, unit: "g" },
    ],
    steps: [
      { ar: "شوّحي البصل والفلفل في الزيت حتى يذبلا.", en: "Sauté the onion and peppers in the oil until soft." },
      { ar: "أضيفي صلصة الطماطم واتركيها تغلي خمس دقائق.", en: "Add the tomato sauce and let it simmer for five minutes." },
      { ar: "اصنعي فجوات في الصلصة واكسري البيض فيها، ثم غطّي المقلاة حتى ينضج البيض.", en: "Make wells in the sauce, crack in the eggs, and cover the pan until the eggs set." },
      { ar: "قدّميها مع خبز البر.", en: "Serve with the wholewheat bread." },
    ],
  },
];

export const DEMO_LUNCHES: DemoDish[] = [
  {
    name_ar: "كبسة دجاج بالأرز البسمتي",
    name_en: "Chicken kabsa with basmati rice",
    slot: "lunch",
    base_kcal: 620,
    prep_minutes: 15,
    cook_minutes: 45,
    ingredients: [
      { ar: "صدر دجاج", en: "Chicken breast", amount: 150, unit: "g" },
      { ar: "أرز بسمتي", en: "Basmati rice", amount: 70, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 50, unit: "g" },
      { ar: "طماطم", en: "Tomato", amount: 80, unit: "g" },
      { ar: "بهارات الكبسة", en: "Kabsa spice mix", amount: 1, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
      { ar: "سلطة خضراء", en: "Green salad", amount: 1, unit: "unlimited" },
    ],
    steps: [
      { ar: "اغسلي الأرز وانقعيه عشرين دقيقة.", en: "Wash the rice and soak it for twenty minutes." },
      { ar: "شوّحي البصل في الزيت، ثم أضيفي الدجاج والبهارات وقلّبي حتى يتغيّر لونه.", en: "Sauté the onion in the oil, then add the chicken and spices and stir until it changes colour." },
      { ar: "أضيفي الطماطم والماء واتركي الدجاج ينضج على نار متوسطة.", en: "Add the tomato and water and let the chicken cook over medium heat." },
      { ar: "أضيفي الأرز المصفّى وغطّي القدر على نار هادئة حتى ينضج الأرز.", en: "Add the drained rice, cover and cook on low heat until the rice is done." },
      { ar: "قدّميها مع السلطة الخضراء.", en: "Serve with the green salad." },
    ],
  },
  {
    name_ar: "سمك هامور مشوي مع أرز صيادية",
    name_en: "Grilled hammour with sayadiyah rice",
    slot: "lunch",
    base_kcal: 580,
    prep_minutes: 15,
    cook_minutes: 35,
    ingredients: [
      { ar: "فيليه هامور", en: "Hammour fillet", amount: 170, unit: "g" },
      { ar: "أرز بسمتي", en: "Basmati rice", amount: 65, unit: "g" },
      { ar: "بصل مكرمل", en: "Caramelised onion", amount: 40, unit: "g" },
      { ar: "كمون وكركم", en: "Cumin and turmeric", amount: 1, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
      { ar: "ليمون", en: "Lemon", amount: 0.5, unit: "piece" },
    ],
    steps: [
      { ar: "تبّلي السمك بالكمون والكركم والليمون واتركيه عشر دقائق.", en: "Season the fish with cumin, turmeric and lemon and leave it for ten minutes." },
      { ar: "اطبخي الأرز مع البصل المكرمل حتى ينضج.", en: "Cook the rice with the caramelised onion until done." },
      { ar: "اشوي السمك في الفرن أو على الشواية حتى ينضج من الداخل.", en: "Grill the fish in the oven or on the grill until cooked through." },
      { ar: "قدّمي السمك فوق الأرز مع شريحة ليمون.", en: "Serve the fish over the rice with a slice of lemon." },
    ],
  },
  {
    name_ar: "مرقوق باللحم والخضار",
    name_en: "Margoog with lamb and vegetables",
    slot: "lunch",
    base_kcal: 600,
    prep_minutes: 20,
    cook_minutes: 50,
    ingredients: [
      { ar: "لحم غنم قليل الدهن", en: "Lean lamb", amount: 130, unit: "g" },
      { ar: "عجينة مرقوق من دقيق البر", en: "Wholewheat margoog dough", amount: 60, unit: "g" },
      { ar: "كوسا", en: "Zucchini", amount: 100, unit: "g" },
      { ar: "جزر", en: "Carrot", amount: 60, unit: "g" },
      { ar: "طماطم", en: "Tomato", amount: 80, unit: "g" },
      { ar: "بهارات مشكّلة", en: "Mixed spices", amount: 1, unit: "tsp" },
    ],
    steps: [
      { ar: "اسلقي اللحم مع البهارات حتى ينضج نصف نضج.", en: "Boil the lamb with the spices until half cooked." },
      { ar: "أضيفي الطماطم والخضار المقطّعة واتركيها تغلي.", en: "Add the tomato and chopped vegetables and bring to a boil." },
      { ar: "افردي العجينة رقيقة وقطّعيها مربعات وأضيفيها تدريجياً إلى المرق.", en: "Roll the dough thin, cut into squares and add them gradually to the broth." },
      { ar: "اتركيه على نار هادئة حتى تنضج العجينة ويتماسك المرق.", en: "Simmer until the dough is cooked and the broth thickens." },
    ],
  },
  {
    name_ar: "جريش بالدجاج واللبن",
    name_en: "Jareesh with chicken and yoghurt",
    slot: "lunch",
    base_kcal: 560,
    prep_minutes: 10,
    cook_minutes: 60,
    ingredients: [
      { ar: "جريش", en: "Cracked wheat (jareesh)", amount: 70, unit: "g" },
      { ar: "صدر دجاج", en: "Chicken breast", amount: 130, unit: "g" },
      { ar: "لبن قليل الدسم", en: "Low-fat laban", amount: 150, unit: "ml" },
      { ar: "بصل", en: "Onion", amount: 40, unit: "g" },
      { ar: "كمون", en: "Ground cumin", amount: 0.5, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 1, unit: "tsp" },
    ],
    steps: [
      { ar: "انقعي الجريش ساعة ثم صفّيه.", en: "Soak the jareesh for an hour, then drain." },
      { ar: "اسلقي الدجاج مع البصل والكمون، ثم أخرجيه وقطّعيه.", en: "Boil the chicken with the onion and cumin, then remove and shred it." },
      { ar: "اطبخي الجريش في مرق الدجاج على نار هادئة مع التحريك حتى ينضج.", en: "Cook the jareesh in the chicken broth on low heat, stirring, until soft." },
      { ar: "أضيفي اللبن والدجاج وحرّكي، وقدّميه مع رشة زيت زيتون.", en: "Stir in the laban and chicken and serve with a drizzle of olive oil." },
    ],
  },
  {
    name_ar: "صالونة خضار بالدجاج مع أرز",
    name_en: "Vegetable and chicken saloona with rice",
    slot: "lunch",
    base_kcal: 590,
    prep_minutes: 15,
    cook_minutes: 40,
    ingredients: [
      { ar: "صدر دجاج", en: "Chicken breast", amount: 140, unit: "g" },
      { ar: "أرز بسمتي", en: "Basmati rice", amount: 60, unit: "g" },
      { ar: "بطاطس", en: "Potato", amount: 80, unit: "g" },
      { ar: "كوسا وجزر", en: "Zucchini and carrot", amount: 120, unit: "g" },
      { ar: "صلصة طماطم", en: "Tomato sauce", amount: 100, unit: "g" },
      { ar: "بهارات الصالونة", en: "Saloona spice mix", amount: 1, unit: "tsp" },
    ],
    steps: [
      { ar: "شوّحي الدجاج مع البهارات حتى يتغيّر لونه.", en: "Sear the chicken with the spices until it changes colour." },
      { ar: "أضيفي الخضار وصلصة الطماطم والماء واتركيها تنضج على نار متوسطة.", en: "Add the vegetables, tomato sauce and water and cook over medium heat." },
      { ar: "اطبخي الأرز في قدر منفصل.", en: "Cook the rice in a separate pot." },
      { ar: "قدّمي الصالونة مع الأرز.", en: "Serve the saloona with the rice." },
    ],
  },
  {
    name_ar: "مندي دجاج بالفرن",
    name_en: "Oven-baked chicken mandi",
    slot: "lunch",
    base_kcal: 640,
    prep_minutes: 15,
    cook_minutes: 60,
    ingredients: [
      { ar: "دجاج منزوع الجلد", en: "Skinless chicken", amount: 170, unit: "g" },
      { ar: "أرز بسمتي", en: "Basmati rice", amount: 70, unit: "g" },
      { ar: "بهارات المندي", en: "Mandi spice mix", amount: 1, unit: "tsp" },
      { ar: "بصل", en: "Onion", amount: 40, unit: "g" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
      { ar: "صلصة طماطم حارة", en: "Spicy tomato dip", amount: 30, unit: "g" },
    ],
    steps: [
      { ar: "تبّلي الدجاج ببهارات المندي والزيت واتركيه نصف ساعة.", en: "Coat the chicken with mandi spices and oil and leave for half an hour." },
      { ar: "ضعي الأرز المنقوع مع البصل والماء في صينية عميقة.", en: "Put the soaked rice with the onion and water in a deep tray." },
      { ar: "ضعي الدجاج على شبك فوق الأرز وغطّي الصينية بورق القصدير.", en: "Place the chicken on a rack over the rice and cover the tray with foil." },
      { ar: "اخبزيه في فرن متوسط الحرارة ساعة، ثم قدّميه مع الصلصة.", en: "Bake in a medium oven for an hour, then serve with the dip." },
    ],
  },
  {
    name_ar: "برياني لحم بالزبادي",
    name_en: "Lamb biryani with yoghurt",
    slot: "lunch",
    base_kcal: 630,
    prep_minutes: 20,
    cook_minutes: 50,
    ingredients: [
      { ar: "لحم غنم قليل الدهن", en: "Lean lamb", amount: 130, unit: "g" },
      { ar: "أرز بسمتي", en: "Basmati rice", amount: 70, unit: "g" },
      { ar: "زبادي قليل الدسم", en: "Low-fat yoghurt", amount: 60, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 50, unit: "g" },
      { ar: "بهارات البرياني", en: "Biryani spice mix", amount: 1, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
    ],
    steps: [
      { ar: "تبّلي اللحم بالزبادي والبهارات واتركيه ساعة.", en: "Marinate the lamb in the yoghurt and spices for an hour." },
      { ar: "شوّحي البصل في الزيت ثم أضيفي اللحم واطبخيه حتى ينضج.", en: "Sauté the onion in the oil, then add the lamb and cook until tender." },
      { ar: "اسلقي الأرز نصف سلق وصفّيه.", en: "Parboil the rice and drain it." },
      { ar: "رتّبي الأرز فوق اللحم وغطّي القدر على نار هادئة عشرين دقيقة.", en: "Layer the rice over the lamb, cover and cook on low heat for twenty minutes." },
    ],
  },
];

export const DEMO_DINNERS: DemoDish[] = [
  {
    name_ar: "شوربة عدس مع سلطة فتوش",
    name_en: "Lentil soup with fattoush salad",
    slot: "dinner",
    base_kcal: 430,
    prep_minutes: 10,
    cook_minutes: 30,
    ingredients: [
      { ar: "عدس أحمر", en: "Red lentils", amount: 60, unit: "g" },
      { ar: "جزر", en: "Carrot", amount: 50, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 40, unit: "g" },
      { ar: "كمون", en: "Ground cumin", amount: 0.5, unit: "tsp" },
      { ar: "خضار الفتوش", en: "Fattoush vegetables", amount: 150, unit: "g" },
      { ar: "خبز البر المحمّص", en: "Toasted wholewheat bread", amount: 25, unit: "g" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
    ],
    steps: [
      { ar: "اسلقي العدس مع الجزر والبصل حتى ينضج، ثم اخلطيه حتى يصبح ناعماً.", en: "Boil the lentils with the carrot and onion until soft, then blend until smooth." },
      { ar: "أضيفي الكمون وقليلاً من الملح.", en: "Season with the cumin and a little salt." },
      { ar: "قطّعي خضار الفتوش وأضيفي الخبز المحمّص وزيت الزيتون.", en: "Chop the fattoush vegetables and add the toasted bread and olive oil." },
    ],
  },
  {
    name_ar: "دجاج مشوي بالليمون والثوم مع خضار سوتيه",
    name_en: "Lemon-garlic grilled chicken with sautéed vegetables",
    slot: "dinner",
    base_kcal: 450,
    prep_minutes: 10,
    cook_minutes: 25,
    ingredients: [
      { ar: "صدر دجاج", en: "Chicken breast", amount: 150, unit: "g" },
      { ar: "ثوم مهروس", en: "Crushed garlic", amount: 1, unit: "tsp" },
      { ar: "ليمون", en: "Lemon juice", amount: 1, unit: "tbsp" },
      { ar: "بروكلي وفلفل", en: "Broccoli and peppers", amount: 150, unit: "g" },
      { ar: "بطاطا حلوة", en: "Sweet potato", amount: 100, unit: "g" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
    ],
    steps: [
      { ar: "تبّلي الدجاج بالثوم والليمون ونصف الزيت.", en: "Season the chicken with the garlic, lemon and half the oil." },
      { ar: "اشوي الدجاج حتى ينضج من الداخل.", en: "Grill the chicken until cooked through." },
      { ar: "اخبزي البطاطا الحلوة في الفرن حتى تلين.", en: "Bake the sweet potato until tender." },
      { ar: "شوّحي الخضار في بقية الزيت وقدّميها مع الدجاج.", en: "Sauté the vegetables in the rest of the oil and serve with the chicken." },
    ],
  },
  {
    name_ar: "سلطة تونة بالحمص والخضار",
    name_en: "Tuna and chickpea salad",
    slot: "dinner",
    base_kcal: 420,
    prep_minutes: 10,
    cook_minutes: 0,
    ingredients: [
      { ar: "تونة بالماء", en: "Tuna in water", amount: 120, unit: "g" },
      { ar: "حمص مسلوق", en: "Cooked chickpeas", amount: 80, unit: "g" },
      { ar: "خس وخيار وطماطم", en: "Lettuce, cucumber and tomato", amount: 1, unit: "unlimited" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
      { ar: "ليمون", en: "Lemon juice", amount: 1, unit: "tbsp" },
    ],
    steps: [
      { ar: "صفّي التونة وفتّتيها بالشوكة.", en: "Drain the tuna and flake it with a fork." },
      { ar: "قطّعي الخضار وأضيفي الحمص والتونة.", en: "Chop the vegetables and add the chickpeas and tuna." },
      { ar: "تبّلي السلطة بالليمون وزيت الزيتون.", en: "Dress with the lemon and olive oil." },
    ],
  },
  {
    name_ar: "كفتة لحم بالفرن مع صلصة الطحينة",
    name_en: "Baked lamb kofta with tahini sauce",
    slot: "dinner",
    base_kcal: 460,
    prep_minutes: 15,
    cook_minutes: 25,
    ingredients: [
      { ar: "لحم مفروم قليل الدهن", en: "Lean minced meat", amount: 120, unit: "g" },
      { ar: "بصل وبقدونس مفروم", en: "Minced onion and parsley", amount: 40, unit: "g" },
      { ar: "طحينة", en: "Tahini", amount: 1, unit: "tbsp" },
      { ar: "زبادي قليل الدسم", en: "Low-fat yoghurt", amount: 50, unit: "g" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 40, unit: "g" },
      { ar: "سلطة خضراء", en: "Green salad", amount: 1, unit: "unlimited" },
    ],
    steps: [
      { ar: "اخلطي اللحم مع البصل والبقدونس والملح وشكّليه أصابع.", en: "Mix the meat with the onion, parsley and salt and shape into fingers." },
      { ar: "اخبزي الكفتة في فرن ساخن حتى تنضج.", en: "Bake the kofta in a hot oven until cooked." },
      { ar: "اخلطي الطحينة مع الزبادي وقليل من الليمون لعمل الصلصة.", en: "Mix the tahini with the yoghurt and a little lemon for the sauce." },
      { ar: "قدّمي الكفتة مع الصلصة والخبز والسلطة.", en: "Serve the kofta with the sauce, bread and salad." },
    ],
  },
  {
    name_ar: "روبيان مشوي مع كينوا بالخضار",
    name_en: "Grilled shrimp with vegetable quinoa",
    slot: "dinner",
    base_kcal: 440,
    prep_minutes: 10,
    cook_minutes: 20,
    ingredients: [
      { ar: "روبيان مقشّر", en: "Peeled shrimp", amount: 150, unit: "g" },
      { ar: "كينوا", en: "Quinoa", amount: 50, unit: "g" },
      { ar: "خضار مشكّلة", en: "Mixed vegetables", amount: 120, unit: "g" },
      { ar: "ثوم وبابريكا", en: "Garlic and paprika", amount: 1, unit: "tsp" },
      { ar: "زيت زيتون", en: "Olive oil", amount: 2, unit: "tsp" },
    ],
    steps: [
      { ar: "اسلقي الكينوا حتى تنضج وصفّيها.", en: "Boil the quinoa until tender and drain." },
      { ar: "تبّلي الروبيان بالثوم والبابريكا واشويه دقيقتين لكل جهة.", en: "Season the shrimp with garlic and paprika and grill two minutes per side." },
      { ar: "شوّحي الخضار في الزيت ثم اخلطيها مع الكينوا.", en: "Sauté the vegetables in the oil, then mix with the quinoa." },
      { ar: "قدّمي الروبيان فوق الكينوا.", en: "Serve the shrimp over the quinoa." },
    ],
  },
  {
    name_ar: "عجة خضار بالفرن مع جبن قريش",
    name_en: "Baked vegetable omelette with cottage cheese",
    slot: "dinner",
    base_kcal: 400,
    prep_minutes: 10,
    cook_minutes: 20,
    ingredients: [
      { ar: "بيض", en: "Eggs", amount: 2, unit: "piece" },
      { ar: "جبن قريش", en: "Cottage cheese", amount: 80, unit: "g" },
      { ar: "سبانخ وفلفل", en: "Spinach and peppers", amount: 120, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 30, unit: "g" },
      { ar: "خبز البر", en: "Wholewheat bread", amount: 40, unit: "g" },
    ],
    steps: [
      { ar: "اخفقي البيض مع جبن القريش والملح.", en: "Whisk the eggs with the cottage cheese and salt." },
      { ar: "أضيفي الخضار المقطّعة والبصل.", en: "Add the chopped vegetables and onion." },
      { ar: "صبّي الخليط في صينية صغيرة واخبزيه حتى يتماسك.", en: "Pour into a small tray and bake until set." },
      { ar: "قدّميها مع خبز البر.", en: "Serve with the wholewheat bread." },
    ],
  },
  {
    name_ar: "شوربة دجاج بالشوفان والخضار",
    name_en: "Chicken, oat and vegetable soup",
    slot: "dinner",
    base_kcal: 410,
    prep_minutes: 10,
    cook_minutes: 30,
    ingredients: [
      { ar: "صدر دجاج", en: "Chicken breast", amount: 120, unit: "g" },
      { ar: "شوفان", en: "Rolled oats", amount: 30, unit: "g" },
      { ar: "جزر وكوسا", en: "Carrot and zucchini", amount: 120, unit: "g" },
      { ar: "بصل", en: "Onion", amount: 30, unit: "g" },
      { ar: "بهارات مشكّلة", en: "Mixed spices", amount: 0.5, unit: "tsp" },
      { ar: "ليمون", en: "Lemon", amount: 0.5, unit: "piece" },
    ],
    steps: [
      { ar: "اسلقي الدجاج مع البصل والبهارات، ثم قطّعيه قطعاً صغيرة.", en: "Boil the chicken with the onion and spices, then cut it into small pieces." },
      { ar: "أضيفي الخضار والشوفان إلى المرق واتركيه يغلي عشر دقائق.", en: "Add the vegetables and oats to the broth and simmer for ten minutes." },
      { ar: "أعيدي الدجاج إلى الشوربة وقدّميها مع الليمون.", en: "Return the chicken to the soup and serve with the lemon." },
    ],
  },
];

export const DEMO_SNACKS: DemoDish[] = [
  {
    name_ar: "زبادي يوناني بالتوت والعسل",
    name_en: "Greek yoghurt with berries and honey",
    slot: "snack",
    base_kcal: 200,
    prep_minutes: 3,
    cook_minutes: 0,
    ingredients: [
      { ar: "زبادي يوناني قليل الدسم", en: "Low-fat Greek yoghurt", amount: 150, unit: "g" },
      { ar: "توت مشكّل", en: "Mixed berries", amount: 60, unit: "g" },
      { ar: "عسل", en: "Honey", amount: 1, unit: "tsp" },
    ],
    steps: [
      { ar: "ضعي الزبادي في كوب وأضيفي التوت ورشّي العسل.", en: "Spoon the yoghurt into a cup, add the berries and drizzle the honey." },
    ],
  },
  {
    name_ar: "تمر مع لوز",
    name_en: "Dates with almonds",
    slot: "snack",
    base_kcal: 190,
    prep_minutes: 1,
    cook_minutes: 0,
    ingredients: [
      { ar: "تمر", en: "Dates", amount: 3, unit: "piece" },
      { ar: "لوز نيء", en: "Raw almonds", amount: 15, unit: "g" },
    ],
    steps: [{ ar: "قدّمي التمر مع اللوز في صحن صغير.", en: "Serve the dates with the almonds on a small plate." }],
  },
  {
    name_ar: "حمص مع أصابع الخضار",
    name_en: "Hummus with vegetable sticks",
    slot: "snack",
    base_kcal: 180,
    prep_minutes: 5,
    cook_minutes: 0,
    ingredients: [
      { ar: "حمص بالطحينة", en: "Hummus", amount: 70, unit: "g" },
      { ar: "جزر وخيار", en: "Carrot and cucumber", amount: 120, unit: "g" },
    ],
    steps: [{ ar: "قطّعي الخضار أصابع وقدّميها مع الحمص.", en: "Cut the vegetables into sticks and serve with the hummus." }],
  },
  {
    name_ar: "تفاحة مع زبدة الفول السوداني",
    name_en: "Apple with peanut butter",
    slot: "snack",
    base_kcal: 200,
    prep_minutes: 2,
    cook_minutes: 0,
    ingredients: [
      { ar: "تفاح", en: "Apple", amount: 1, unit: "piece" },
      { ar: "زبدة الفول السوداني", en: "Peanut butter", amount: 1, unit: "tbsp" },
    ],
    steps: [{ ar: "قطّعي التفاحة شرائح وقدّميها مع زبدة الفول السوداني.", en: "Slice the apple and serve with the peanut butter." }],
  },
  {
    name_ar: "لبن مع حفنة مكسرات",
    name_en: "Laban with a handful of nuts",
    slot: "snack",
    base_kcal: 190,
    prep_minutes: 1,
    cook_minutes: 0,
    ingredients: [
      { ar: "لبن قليل الدسم", en: "Low-fat laban", amount: 200, unit: "ml" },
      { ar: "مكسرات مشكّلة غير مملّحة", en: "Unsalted mixed nuts", amount: 15, unit: "g" },
    ],
    steps: [{ ar: "قدّمي اللبن بارداً مع المكسرات.", en: "Serve the laban cold with the nuts." }],
  },
];

export const DEMO_DISHES_BY_SLOT: Record<DemoSlot, DemoDish[]> = {
  breakfast: DEMO_BREAKFASTS,
  lunch: DEMO_LUNCHES,
  dinner: DEMO_DINNERS,
  snack: DEMO_SNACKS,
};

const ALL_DISHES: DemoDish[] = [
  ...DEMO_BREAKFASTS,
  ...DEMO_LUNCHES,
  ...DEMO_DINNERS,
  ...DEMO_SNACKS,
];

export const DEMO_DISH_BY_NAME: ReadonlyMap<string, DemoDish> = new Map(
  ALL_DISHES.map((d) => [d.name_ar, d]),
);

/** Arabic → English for every demo string (names, ingredients, steps). */
export const DEMO_EN_BY_AR: ReadonlyMap<string, string> = new Map(
  ALL_DISHES.flatMap((d) => [
    [d.name_ar, d.name_en] as [string, string],
    ...d.ingredients.map((g) => [g.ar, g.en] as [string, string]),
    ...d.steps.map((s) => [s.ar, s.en] as [string, string]),
  ]),
);
