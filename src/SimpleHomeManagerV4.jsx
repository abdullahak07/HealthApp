import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Dumbbell,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { estimateFoodWithAI, isGeminiFoodEnabled } from "./aiFoodClient";

const STORAGE_KEY = "healthai-mvp-v1";

function readApp() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function total(items) {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + Number(item.calories || 0),
      protein: sum.protein + Number(item.protein || 0),
      carbs: sum.carbs + Number(item.carbs || 0),
      fat: sum.fat + Number(item.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function clickNavigation(label) {
  const buttons = [...document.querySelectorAll(".side-nav button, .mobile-tabs button")];
  buttons.find((button) => button.textContent.trim().toLowerCase() === label.toLowerCase())?.click();
}

function ConfidenceBadge({ value }) {
  return <span className={`ai-confidence confidence-${value}`}>{value} confidence</span>;
}

function EstimatePreview({ result, onAdd, onDiscard }) {
  if (result.needsClarification) {
    return (
      <div className="ai-clarification">
        <CircleAlert size={19} />
        <div>
          <strong>Gemini needs one more detail</strong>
          <p>{result.clarificationQuestion || "Please add a clearer portion or serving size."}</p>
        </div>
        <button type="button" onClick={onDiscard}><X size={16} /> Close</button>
      </div>
    );
  }

  return (
    <div className="ai-estimate-preview">
      <div className="ai-preview-top">
        <div>
          <span className="ai-preview-label"><Sparkles size={14} /> GEMINI ESTIMATE</span>
          <h4>{result.name}</h4>
          <p>{result.serving}</p>
        </div>
        <ConfidenceBadge value={result.confidence} />
      </div>

      <div className="ai-calorie-range">
        <div><small>Best estimate</small><strong>{result.calories}</strong><span>kcal</span></div>
        <div><small>Plausible range</small><strong>{result.calorieMin}–{result.calorieMax}</strong><span>kcal</span></div>
      </div>

      <div className="ai-macros">
        <span><strong>{result.protein} g</strong> protein</span>
        <span><strong>{result.carbs} g</strong> carbs</span>
        <span><strong>{result.fat} g</strong> fat</span>
      </div>

      {result.items.length > 1 && (
        <div className="ai-item-breakdown">
          <strong>Meal breakdown</strong>
          {result.items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <span>{item.name}<small>{item.serving}</small></span>
              <b>{Math.round(Number(item.calories || 0))} kcal</b>
            </div>
          ))}
        </div>
      )}

      {result.assumptions.length > 0 && (
        <div className="ai-assumptions">
          <strong>Assumptions affecting accuracy</strong>
          <ul>{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <div className="ai-preview-source"><ShieldCheck size={15} /> {result.source}</div>
      <div className="ai-preview-actions">
        <button type="button" className="ai-discard" onClick={onDiscard}><X size={17} /> Discard</button>
        <button type="button" className="ai-confirm" onClick={onAdd}><Plus size={17} /> Add to today</button>
      </div>
    </div>
  );
}

function SimpleHome({ app, onChange }) {
  const [foodText, setFoodText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const meals = app?.meals || [];
  const checks = app?.mealChecks || {};
  const extras = app?.extraFoods || [];
  const routine = app?.routine || [];
  const todayIndex = new Date().getDay() === 0
    ? 6
    : Math.min(new Date().getDay() - 1, Math.max(routine.length - 1, 0));
  const workout = routine[todayIndex] || routine[0];
  const mealIsSelected = (meal) => meal.items.filter((item) => !item.optional).every((item) => checks[item.id]);
  const selectedCount = meals.filter(mealIsSelected).length;
  const loggedItems = meals.flatMap((meal) => meal.items.filter((item) => checks[item.id]));
  const loggedTotal = total([...loggedItems, ...extras]);
  const aiEnabled = isGeminiFoodEnabled();

  const toggleMeal = (meal) => {
    const selected = mealIsSelected(meal);
    const nextChecks = { ...checks };
    meal.items.filter((item) => !item.optional).forEach((item) => {
      nextChecks[item.id] = !selected;
    });
    onChange({ ...app, mealChecks: nextChecks });
  };

  const estimateFood = async (event) => {
    event.preventDefault();
    if (!foodText.trim() || loading) return;
    setLoading(true);
    setPreview(null);
    setError("");

    try {
      const result = await estimateFoodWithAI(foodText, app.profile || {});
      setPreview(result);
    } catch (requestError) {
      setError(requestError.message || "The food could not be estimated.");
    } finally {
      setLoading(false);
    }
  };

  const addPreview = () => {
    if (!preview || preview.needsClarification) return;
    onChange({
      ...app,
      extraFoods: [...extras, { ...preview, id: crypto.randomUUID() }],
    });
    setPreview(null);
    setFoodText("");
    setError("");
  };

  const removeExtra = (id) => {
    onChange({ ...app, extraFoods: extras.filter((item) => item.id !== id) });
  };

  return (
    <div className="simple-home-portal">
      <section className="simple-welcome">
        <div>
          <span className="simple-kicker">TODAY</span>
          <h2>What did you eat?</h2>
          <p>Select your usual meals. Ask Gemini about anything different.</p>
        </div>
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
          return (
            <button key={meal.id} className={`simple-meal ${selected ? "selected" : ""}`} onClick={() => toggleMeal(meal)}>
              <span className="simple-meal-icon">{meal.icon}</span>
              <span className="simple-meal-copy"><small>{meal.time}</small><strong>{meal.title}</strong><em>{mealTotal.calories} kcal</em></span>
              <span className="simple-check">{selected && <Check size={18} />}</span>
            </button>
          );
        })}
      </section>

      <section className="simple-add-card ai-food-card">
        <div className="simple-add-heading">
          <div className="simple-add-icon"><BrainCircuit size={21} /></div>
          <div>
            <h3>Ask Gemini about other food</h3>
            <p>Gemini interprets the meal, portion and cooking method, then shows a calorie range before anything is saved.</p>
          </div>
          <span className={`ai-connection ${aiEnabled ? "connected" : "pending"}`}>{aiEnabled ? "AI connected" : "Backend not connected"}</span>
        </div>

        <form onSubmit={estimateFood} className="simple-food-form">
          <div className="simple-food-input-wrap">
            <Utensils size={18} />
            <input
              value={foodText}
              onChange={(event) => setFoodText(event.target.value)}
              placeholder="e.g. one plate chicken biryani with raita"
            />
          </div>
          <button disabled={!foodText.trim() || loading} type="submit">
            {loading ? <LoaderCircle className="food-spinner" size={18} /> : <Sparkles size={18} />}
            {loading ? "Estimating" : "Ask Gemini"}
          </button>
        </form>

        {error && <div className="ai-food-error"><CircleAlert size={17} /><span>{error}</span></div>}
        {preview && <EstimatePreview result={preview} onAdd={addPreview} onDiscard={() => setPreview(null)} />}

        {extras.length > 0 && (
          <div className="simple-extra-list">
            {extras.map((food) => (
              <div key={food.id}>
                <span>
                  <strong>{food.name}</strong>
                  <small>{food.calories} kcal · {food.serving || food.source || "Saved estimate"}</small>
                </span>
                <button aria-label={`Remove ${food.name}`} onClick={() => removeExtra(food.id)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="simple-workout-card">
        <div className="simple-workout-icon"><Dumbbell size={22} /></div>
        <div><small>TODAY'S WORKOUT</small><strong>{workout?.focus || "Recovery"}</strong><span>{workout?.rest ? "Rest and light movement" : `${workout?.duration || 0} minutes`}</span></div>
        <button onClick={() => clickNavigation("Workout")}>{workout?.rest ? "View week" : "Open workout"}<ChevronRight size={16} /></button>
      </section>

      <p className="simple-disclaimer">AI nutrition estimates are not exact. Review the interpreted serving, range and assumptions before adding the food.</p>
    </div>
  );
}

export default function SimpleHomeManagerV4({ children }) {
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
    return () => {
      observer.disconnect();
      document.body.classList.remove("simple-home-active");
    };
  }, [version]);

  const updateApp = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setApp(next);
    setVersion((value) => value + 1);
  };

  return (
    <>
      <div key={version}>{children}</div>
      {portalTarget && isToday && app && createPortal(<SimpleHome app={app} onChange={updateApp} />, portalTarget)}
    </>
  );
}
