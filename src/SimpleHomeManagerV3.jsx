import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Database, Dumbbell, LoaderCircle, Plus, Trash2, Utensils } from "lucide-react";

const STORAGE_KEY = "healthai-mvp-v1";
const USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_KEY = "DEMO_KEY";

const FALLBACKS = [
  { keys: ["pizza"], calories: 266, protein: 11, carbs: 33, fat: 10, grams: 107, portion: "slice" },
  { keys: ["chicken burger", "chicken sandwich"], calories: 250, protein: 14, carbs: 24, fat: 11, grams: 220, portion: "burger" },
  { keys: ["beef burger", "burger"], calories: 236, protein: 13, carbs: 20, fat: 12, grams: 220, portion: "burger" },
  { keys: ["fries", "chips"], calories: 312, protein: 3, carbs: 41, fat: 15, grams: 117, portion: "serving" },
  { keys: ["egg", "eggs"], calories: 143, protein: 13, carbs: 1, fat: 10, grams: 50, portion: "egg" },
  { keys: ["banana"], calories: 89, protein: 1, carbs: 23, fat: 0, grams: 118, portion: "banana" },
  { keys: ["apple"], calories: 52, protein: 0, carbs: 14, fat: 0, grams: 182, portion: "apple" },
  { keys: ["rice"], calories: 130, protein: 3, carbs: 28, fat: 0, grams: 158, portion: "cup" },
  { keys: ["bread", "toast"], calories: 265, protein: 9, carbs: 49, fat: 3, grams: 28, portion: "slice" },
  { keys: ["chicken breast", "cooked chicken", "chicken"], calories: 165, protein: 31, carbs: 0, fat: 4, grams: 100, portion: "100 g" },
  { keys: ["whey", "protein shake"], calories: 400, protein: 80, carbs: 10, fat: 7, grams: 30, portion: "scoop" },
  { keys: ["oats", "oatmeal"], calories: 380, protein: 13, carbs: 68, fat: 7, grams: 60, portion: "60 g" },
  { keys: ["chocolate"], calories: 535, protein: 8, carbs: 59, fat: 30, grams: 12, portion: "piece" },
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

function clickNavigation(label) {
  const buttons = [...document.querySelectorAll(".side-nav button, .mobile-tabs button")];
  buttons.find((button) => button.textContent.trim().toLowerCase() === label.toLowerCase())?.click();
}

function parseQuantity(text) {
  const lower = text.toLowerCase();
  const grams = lower.match(/(\d+(?:\.\d+)?)\s*g\b/);
  const ml = lower.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  const count = lower.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:slices?|pieces?|servings?|scoops?|cups?|cans?|tubs?|eggs?|bananas?|apples?|burgers?|wraps?|bars?|biscuits?|cookies?)\b/);
  const unit = lower.match(/\b(slice|piece|serving|scoop|cup|can|tub|egg|banana|apple|burger|wrap|bar|biscuit|cookie)s?\b/)?.[1];
  const query = lower
    .replace(/\d+(?:\.\d+)?\s*(?:g|ml|kg)\b/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:x\s*)?(?:slices?|pieces?|servings?|scoops?|cups?|cans?|tubs?|eggs?|bananas?|apples?|burgers?|wraps?|bars?|biscuits?|cookies?)\b/g, " ")
    .replace(/\b(?:slice|piece|serving|scoop|cup|can|tub)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    grams: grams ? Number(grams[1]) : null,
    ml: ml ? Number(ml[1]) : null,
    count: count ? Number(count[1]) : 1,
    unit,
    query: query || lower,
  };
}

function nutrient(food, matcher) {
  const item = (food.foodNutrients || []).find((value) => matcher(String(value.nutrientName || value.nutrient?.name || ""), String(value.unitName || value.nutrient?.unitName || "")));
  return Number(item?.value ?? item?.amount ?? 0);
}

function chooseFood(foods, query) {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return [...foods].sort((a, b) => {
    const score = (food) => {
      const description = String(food.description || "").toLowerCase();
      const type = String(food.dataType || "");
      let value = words.reduce((sum, word) => sum + (description.includes(word) ? 3 : 0), 0);
      if (/Foundation|SR Legacy|Survey/.test(type)) value += 4;
      if (/Branded/.test(type)) value -= 1;
      return value;
    };
    return score(b) - score(a);
  })[0];
}

function fallbackEstimate(text, quantity) {
  const match = FALLBACKS
    .flatMap((item) => item.keys.filter((key) => text.toLowerCase().includes(key)).map((key) => ({ item, key })))
    .sort((a, b) => b.key.length - a.key.length)[0]?.item;
  const item = match || { calories: 200, protein: 8, carbs: 25, fat: 8, grams: 150, portion: "serving" };
  const grams = quantity.grams || item.grams * quantity.count;
  const factor = grams / 100;
  return {
    name: text.trim(),
    calories: Math.round(item.calories * factor),
    protein: Math.round(item.protein * factor),
    carbs: Math.round(item.carbs * factor),
    fat: Math.round(item.fat * factor),
    source: "Local fallback estimate",
    sourceDetail: `${Math.round(grams)} g estimated portion`,
    estimated: true,
  };
}

async function lookupBarcode(barcode, quantity) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,serving_quantity,nutriments`);
  if (!response.ok) throw new Error("Open Food Facts lookup failed");
  const data = await response.json();
  const product = data.product;
  if (!product?.nutriments) throw new Error("No barcode nutrition found");
  const grams = quantity.grams || Number(product.serving_quantity || 100) * quantity.count;
  const factor = grams / 100;
  return {
    name: product.product_name || barcode,
    calories: Math.round(Number(product.nutriments["energy-kcal_100g"] || 0) * factor),
    protein: Math.round(Number(product.nutriments.proteins_100g || 0) * factor),
    carbs: Math.round(Number(product.nutriments.carbohydrates_100g || 0) * factor),
    fat: Math.round(Number(product.nutriments.fat_100g || 0) * factor),
    source: "Open Food Facts",
    sourceDetail: `${Math.round(grams)} g from barcode`,
    estimated: true,
  };
}

async function lookupUSDA(text, quantity) {
  const url = new URL(USDA_SEARCH);
  url.searchParams.set("api_key", USDA_KEY);
  url.searchParams.set("query", quantity.query);
  url.searchParams.set("pageSize", "10");
  const response = await fetch(url);
  if (!response.ok) throw new Error("USDA lookup failed");
  const data = await response.json();
  const food = chooseFood(data.foods || [], quantity.query);
  if (!food) throw new Error("No USDA result");

  const energy = nutrient(food, (name, unit) => name === "Energy" && /KCAL/i.test(unit));
  const protein = nutrient(food, (name) => /^Protein$/i.test(name));
  const carbs = nutrient(food, (name) => /Carbohydrate, by difference/i.test(name));
  const fat = nutrient(food, (name) => /Total lipid \(fat\)/i.test(name));
  if (!energy) throw new Error("USDA result had no calorie value");

  const fallback = FALLBACKS
    .flatMap((item) => item.keys.filter((key) => text.toLowerCase().includes(key)).map(() => item))[0];
  const grams = quantity.grams
    || (quantity.ml ? quantity.ml : null)
    || (Number(food.servingSize) && String(food.servingSizeUnit).toLowerCase() === "g" ? Number(food.servingSize) * quantity.count : null)
    || (fallback?.grams || 100) * quantity.count;
  const factor = grams / 100;

  return {
    name: text.trim(),
    calories: Math.max(1, Math.round(energy * factor)),
    protein: Math.max(0, Math.round(protein * factor)),
    carbs: Math.max(0, Math.round(carbs * factor)),
    fat: Math.max(0, Math.round(fat * factor)),
    source: "USDA FoodData Central",
    sourceDetail: `${food.description} · ${Math.round(grams)} g portion`,
    estimated: true,
  };
}

async function lookupFood(text) {
  const quantity = parseQuantity(text);
  const barcode = text.trim().match(/^\d{8,14}$/)?.[0];
  try {
    return barcode ? await lookupBarcode(barcode, quantity) : await lookupUSDA(text, quantity);
  } catch (error) {
    console.warn("Live food lookup unavailable; using fallback", error);
    return fallbackEstimate(text, quantity);
  }
}

function SimpleHome({ app, onChange }) {
  const [foodText, setFoodText] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
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

  const addFood = async (event) => {
    event.preventDefault();
    if (!foodText.trim() || loading) return;
    setLoading(true);
    const result = await lookupFood(foodText);
    const next = { ...app, extraFoods: [...extras, { ...result, id: crypto.randomUUID() }] };
    onChange(next);
    setLastResult(result);
    setFoodText("");
    setLoading(false);
  };

  return <div className="simple-home-portal">
    <section className="simple-welcome"><div><span className="simple-kicker">TODAY</span><h2>What did you eat?</h2><p>Select your usual meals. Add anything different below.</p></div><button className="simple-details" onClick={() => clickNavigation("Nutrition")}>Full details <ChevronRight size={16} /></button></section>
    <section className="simple-summary"><div><strong>{selectedCount}</strong><span>of {meals.length} planned meals selected</span></div><div><strong>{loggedTotal.calories}</strong><span>kcal logged today</span></div></section>
    <section className="simple-meal-grid">{meals.map((meal) => { const mealTotal = total(meal.items.filter((item) => !item.optional)); const selected = mealIsSelected(meal); return <button key={meal.id} className={`simple-meal ${selected ? "selected" : ""}`} onClick={() => toggleMeal(meal)}><span className="simple-meal-icon">{meal.icon}</span><span className="simple-meal-copy"><small>{meal.time}</small><strong>{meal.title}</strong><em>{mealTotal.calories} kcal</em></span><span className="simple-check">{selected && <Check size={18} />}</span></button>; })}</section>

    <section className="simple-add-card live-food-card">
      <div className="simple-add-heading"><div className="simple-add-icon"><Database size={20} /></div><div><h3>Add other food</h3><p>Live nutrition lookup from USDA FoodData Central; barcode lookup uses Open Food Facts.</p></div></div>
      <form onSubmit={addFood} className="simple-food-form"><div className="simple-food-input-wrap"><Utensils size={18} /><input value={foodText} onChange={(event) => setFoodText(event.target.value)} placeholder="e.g. pizza 1 slice, chicken 200 g, or barcode" /></div><button disabled={!foodText.trim() || loading} type="submit">{loading ? <LoaderCircle className="food-spinner" size={18} /> : <Plus size={18} />}{loading ? "Finding" : "Find & add"}</button></form>
      {lastResult && <div className="live-food-result"><strong>{lastResult.name}: {lastResult.calories} kcal</strong><span>{lastResult.protein} g protein · {lastResult.carbs} g carbs · {lastResult.fat} g fat</span><small>{lastResult.source} · {lastResult.sourceDetail}</small></div>}
      {extras.length > 0 && <div className="simple-extra-list">{extras.map((food) => <div key={food.id}><span><strong>{food.name}</strong><small>{food.calories} kcal · {food.source || "Saved estimate"}</small></span><button onClick={() => onChange({ ...app, extraFoods: extras.filter((item) => item.id !== food.id) })}><Trash2 size={16} /></button></div>)}</div>}
    </section>

    <section className="simple-workout-card"><div className="simple-workout-icon"><Dumbbell size={22} /></div><div><small>TODAY'S WORKOUT</small><strong>{workout?.focus || "Recovery"}</strong><span>{workout?.rest ? "Rest and light movement" : `${workout?.duration || 0} minutes`}</span></div><button onClick={() => clickNavigation("Workout")}>{workout?.rest ? "View week" : "Open workout"}<ChevronRight size={16} /></button></section>
    <p className="simple-disclaimer">Database values and exercise burn remain estimates because brands, portions, cooking methods and individual energy use vary.</p>
  </div>;
}

export default function SimpleHomeManagerV3({ children }) {
  const [portalTarget, setPortalTarget] = useState(null);
  const [isToday, setIsToday] = useState(true);
  const [app, setApp] = useState(readApp);
  const [version, setVersion] = useState(0);

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
  }, [version]);

  const updateApp = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setApp(next);
    setVersion((value) => value + 1);
  };

  return <><div key={version}>{children}</div>{portalTarget && isToday && app && createPortal(<SimpleHome app={app} onChange={updateApp} />, portalTarget)}</>;
}
