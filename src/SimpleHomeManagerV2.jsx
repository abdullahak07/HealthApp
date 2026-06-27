import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Dumbbell, Plus, Sparkles, Trash2, Utensils } from "lucide-react";

const STORAGE_KEY = "healthai-mvp-v1";

const FOOD_DATABASE = [
  { keys: ["whole pizza", "large pizza", "medium pizza"], calories: 850, protein: 36, carbs: 105, fat: 32, label: "whole pizza" },
  { keys: ["pizza"], calories: 285, protein: 12, carbs: 36, fat: 10, label: "slice" },
  { keys: ["chicken burger", "chicken sandwich"], calories: 550, protein: 30, carbs: 52, fat: 24 },
  { keys: ["beef burger", "burger"], calories: 520, protein: 28, carbs: 45, fat: 27 },
  { keys: ["fries", "chips"], calories: 365, protein: 5, carbs: 48, fat: 17 },
  { keys: ["biryani"], calories: 650, protein: 32, carbs: 78, fat: 22 },
  { keys: ["shawarma", "kebab"], calories: 620, protein: 35, carbs: 58, fat: 27 },
  { keys: ["chicken breast", "cooked chicken", "chicken"], calories: 165, protein: 31, carbs: 0, fat: 4, basisGrams: 100, label: "100 g" },
  { keys: ["steak", "beef"], calories: 250, protein: 26, carbs: 0, fat: 17, basisGrams: 100, label: "100 g" },
  { keys: ["salmon"], calories: 208, protein: 20, carbs: 0, fat: 13, basisGrams: 100, label: "100 g" },
  { keys: ["tuna can", "can of tuna"], calories: 150, protein: 32, carbs: 0, fat: 2, label: "can" },
  { keys: ["rice"], calories: 205, protein: 4, carbs: 45, fat: 0, label: "cup" },
  { keys: ["pasta"], calories: 500, protein: 18, carbs: 82, fat: 12 },
  { keys: ["naan"], calories: 260, protein: 8, carbs: 45, fat: 6, label: "naan" },
  { keys: ["lebanese bread", "pita bread"], calories: 180, protein: 6, carbs: 35, fat: 2, label: "round" },
  { keys: ["bread", "toast"], calories: 90, protein: 3, carbs: 17, fat: 1, label: "slice" },
  { keys: ["wrap", "tortilla"], calories: 200, protein: 6, carbs: 35, fat: 5, label: "wrap" },
  { keys: ["egg", "eggs"], calories: 72, protein: 6, carbs: 0, fat: 5, label: "egg" },
  { keys: ["banana"], calories: 105, protein: 1, carbs: 27, fat: 0, label: "banana" },
  { keys: ["apple"], calories: 95, protein: 0, carbs: 25, fat: 0, label: "apple" },
  { keys: ["oats", "oatmeal"], calories: 380, protein: 13, carbs: 68, fat: 7, basisGrams: 100, label: "100 g" },
  { keys: ["whey", "protein shake", "protein scoop"], calories: 120, protein: 24, carbs: 3, fat: 2, label: "scoop" },
  { keys: ["yoghurt", "yogurt"], calories: 170, protein: 8, carbs: 28, fat: 3, label: "tub" },
  { keys: ["milk"], calories: 120, protein: 9, carbs: 12, fat: 5, basisMl: 250, label: "250 ml" },
  { keys: ["almonds"], calories: 580, protein: 21, carbs: 22, fat: 50, basisGrams: 100, label: "100 g" },
  { keys: ["peanut butter"], calories: 95, protein: 4, carbs: 3, fat: 8, label: "tablespoon" },
  { keys: ["chocolate piece", "piece of chocolate", "chocolate"], calories: 30, protein: 0, carbs: 4, fat: 2, label: "piece" },
  { keys: ["chocolate bar"], calories: 240, protein: 3, carbs: 28, fat: 14, label: "bar" },
  { keys: ["samosa"], calories: 260, protein: 6, carbs: 30, fat: 13, label: "samosa" },
  { keys: ["latte"], calories: 160, protein: 8, carbs: 16, fat: 7 },
  { keys: ["cappuccino"], calories: 120, protein: 6, carbs: 10, fat: 6 },
  { keys: ["black coffee", "espresso"], calories: 5, protein: 0, carbs: 1, fat: 0 },
  { keys: ["ice cream"], calories: 140, protein: 2, carbs: 18, fat: 7, label: "scoop" },
  { keys: ["cookie"], calories: 150, protein: 2, carbs: 20, fat: 7, label: "cookie" },
  { keys: ["biscuit"], calories: 70, protein: 1, carbs: 10, fat: 3, label: "biscuit" },
];

function readApp() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}

function total(items) {
  return items.reduce((sum, item) => ({
    calories: sum.calories + Number(item.calories || 0),
    protein: sum.protein + Number(item.protein || 0),
    carbs: sum.carbs + Number(item.carbs || 0),
    fat: sum.fat + Number(item.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function quantityFor(segment, item) {
  const grams = segment.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (grams && item.basisGrams) return Number(grams[1]) / item.basisGrams;

  const ml = segment.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml && item.basisMl) return Number(ml[1]) / item.basisMl;

  if (/\bhalf\b/i.test(segment)) return 0.5;
  if (/\bquarter\b/i.test(segment)) return 0.25;

  const unitQuantity = segment.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:slices?|pieces?|servings?|portions?|scoops?|cups?|cans?|tubs?|burgers?|wraps?|eggs?|bananas?|apples?|cookies?|biscuits?|samosas?|naans?|bars?|rounds?|tablespoons?|tbsp)\b/i);
  if (unitQuantity) return Number(unitQuantity[1]);

  const leadingQuantity = segment.match(/^\s*(\d+(?:\.\d+)?)\s+(?!g\b|ml\b)/i);
  if (leadingQuantity) return Number(leadingQuantity[1]);

  return 1;
}

function estimateFood(text) {
  const source = text.toLowerCase().trim();
  if (!source) return null;

  const segments = source.split(/\s+(?:and|with|plus)\s+|[,+&]/i).map((part) => part.trim()).filter(Boolean);
  const found = [];

  for (const segment of segments) {
    const match = FOOD_DATABASE
      .flatMap((item) => item.keys.filter((key) => segment.includes(key)).map((key) => ({ item, key })))
      .sort((a, b) => b.key.length - a.key.length)[0];
    if (!match) continue;
    found.push({ ...match, multiplier: quantityFor(segment, match.item) });
  }

  if (!found.length) {
    return { name: text.trim(), calories: 350, protein: 18, carbs: 42, fat: 14, confidence: "rough", detail: "rough estimate" };
  }

  const result = found.reduce((sum, { item, multiplier }) => ({
    calories: sum.calories + item.calories * multiplier,
    protein: sum.protein + item.protein * multiplier,
    carbs: sum.carbs + item.carbs * multiplier,
    fat: sum.fat + item.fat * multiplier,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const first = found[0];
  const detail = found.length === 1
    ? `${first.multiplier % 1 === 0 ? first.multiplier : first.multiplier.toFixed(2)} ${first.item.label || "serving"}${first.multiplier === 1 ? "" : "s"}`
    : `${found.length} foods matched`;

  return {
    name: text.trim(),
    calories: Math.max(1, Math.round(result.calories)),
    protein: Math.max(0, Math.round(result.protein)),
    carbs: Math.max(0, Math.round(result.carbs)),
    fat: Math.max(0, Math.round(result.fat)),
    confidence: found.length === segments.length ? "matched" : "partial",
    detail,
  };
}

function clickNavigation(label) {
  const buttons = [...document.querySelectorAll(".side-nav button, .mobile-tabs button")];
  buttons.find((button) => button.textContent.trim().toLowerCase() === label.toLowerCase())?.click();
}

function SimpleHome({ app, onChange }) {
  const [foodText, setFoodText] = useState("");
  const estimate = useMemo(() => estimateFood(foodText), [foodText]);
  const meals = app?.meals || [];
  const checks = app?.mealChecks || {};
  const extras = app?.extraFoods || [];
  const routine = app?.routine || [];
  const todayIndex = new Date().getDay() === 0 ? 6 : Math.min(new Date().getDay() - 1, Math.max(routine.length - 1, 0));
  const workout = routine[todayIndex] || routine[0];

  const mealIsSelected = (meal) => meal.items.filter((item) => !item.optional).every((item) => checks[item.id]);
  const selectedCount = meals.filter(mealIsSelected).length;
  const loggedItems = meals.flatMap((meal) => meal.items.filter((item) => checks[item.id]));
  const loggedTotal = total([...loggedItems, ...extras]);

  const toggleMeal = (meal) => {
    const selected = mealIsSelected(meal);
    const nextChecks = { ...checks };
    meal.items.filter((item) => !item.optional).forEach((item) => { nextChecks[item.id] = !selected; });
    onChange({ ...app, mealChecks: nextChecks });
  };

  const addEstimatedFood = (event) => {
    event.preventDefault();
    if (!estimate) return;
    onChange({ ...app, extraFoods: [...extras, { ...estimate, id: crypto.randomUUID(), estimated: true }] });
    setFoodText("");
  };

  const removeExtra = (id) => onChange({ ...app, extraFoods: extras.filter((item) => item.id !== id) });

  return (
    <div className="simple-home-portal">
      <section className="simple-welcome">
        <div><span className="simple-kicker">TODAY</span><h2>What did you eat?</h2><p>Select your usual meals. Add anything different below.</p></div>
        <button className="simple-details" onClick={() => clickNavigation("Nutrition")}>Full details <ChevronRight size={16} /></button>
      </section>

      <section className="simple-summary">
        <div><strong>{selectedCount}</strong><span>of {meals.length} planned meals selected</span></div>
        <div><strong>{loggedTotal.calories}</strong><span>kcal logged today</span></div>
      </section>

      <section className="simple-meal-grid" aria-label="Today's planned meals">
        {meals.map((meal) => {
          const mealTotal = total(meal.items.filter((item) => !item.optional));
          const selected = mealIsSelected(meal);
          return <button key={meal.id} className={`simple-meal ${selected ? "selected" : ""}`} onClick={() => toggleMeal(meal)}>
            <span className="simple-meal-icon">{meal.icon}</span>
            <span className="simple-meal-copy"><small>{meal.time}</small><strong>{meal.title}</strong><em>{mealTotal.calories} kcal</em></span>
            <span className="simple-check">{selected && <Check size={18} />}</span>
          </button>;
        })}
      </section>

      <section className="simple-add-card">
        <div className="simple-add-heading"><div className="simple-add-icon"><Sparkles size={20} /></div><div><h3>Add other food</h3><p>Type what you ate. Calories and macros are estimated automatically.</p></div></div>
        <form onSubmit={addEstimatedFood} className="simple-food-form">
          <div className="simple-food-input-wrap"><Utensils size={18} /><input value={foodText} onChange={(event) => setFoodText(event.target.value)} placeholder="e.g. pizza 1 slice" />{estimate && <span className="simple-estimate">≈ {estimate.calories} kcal · {estimate.detail}</span>}</div>
          <button disabled={!estimate} type="submit"><Plus size={18} /> Add</button>
        </form>
        {estimate?.confidence === "rough" && <p className="simple-estimate-note">No close match was found, so this is a rough generic estimate. You can correct it on the Nutrition page.</p>}
        {extras.length > 0 && <div className="simple-extra-list">{extras.map((food) => <div key={food.id}><span><strong>{food.name}</strong><small>≈ {food.calories} kcal</small></span><button aria-label={`Remove ${food.name}`} onClick={() => removeExtra(food.id)}><Trash2 size={16} /></button></div>)}</div>}
      </section>

      <section className="simple-workout-card">
        <div className="simple-workout-icon"><Dumbbell size={22} /></div>
        <div><small>TODAY'S WORKOUT</small><strong>{workout?.focus || "Recovery"}</strong><span>{workout?.rest ? "Rest and light movement" : `${workout?.duration || 0} minutes`}</span></div>
        <button onClick={() => clickNavigation("Workout")}>{workout?.rest ? "View week" : "Open workout"}<ChevronRight size={16} /></button>
      </section>
      <p className="simple-disclaimer">Food estimates are approximate. Use package labels or weighed portions when accuracy matters.</p>
    </div>
  );
}

export default function SimpleHomeManagerV2({ children }) {
  const [portalTarget, setPortalTarget] = useState(null);
  const [isToday, setIsToday] = useState(true);
  const [app, setApp] = useState(readApp);
  const [appVersion, setAppVersion] = useState(0);

  useEffect(() => {
    const updatePage = () => {
      const content = document.querySelector(".content");
      const title = document.querySelector(".topbar h1")?.textContent?.trim();
      setPortalTarget(content);
      setIsToday(title === "Today");
      document.body.classList.toggle("simple-home-active", title === "Today");
    };
    updatePage();
    const observer = new MutationObserver(updatePage);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); document.body.classList.remove("simple-home-active"); };
  }, [appVersion]);

  const updateApp = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setApp(next);
    setAppVersion((value) => value + 1);
  };

  return <><div key={appVersion}>{children}</div>{portalTarget && isToday && app && createPortal(<SimpleHome app={app} onChange={updateApp} />, portalTarget)}</>;
}
