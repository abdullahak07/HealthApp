import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, ArrowRight, Beef, CircleAlert, Dumbbell, Flame } from "lucide-react";

const STORAGE_KEY = "healthai-mvp-v1";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function readState(raw = localStorage.getItem(STORAGE_KEY)) {
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

function calculateTargets(profile = {}) {
  const weight = Number(profile.weightKg) || 0;
  const height = Number(profile.heightCm) || 0;
  const age = Number(profile.age) || 0;
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, athlete: 1.9 };
  const adjustments = { lose_weight: -500, recomposition: -350, build_muscle: 250, maintain: 0 };
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const calories = Math.max(1200, Math.round(bmr * (factors[profile.activity] || 1.2) + (adjustments[profile.goal] ?? 0)));
  const protein = Math.round(weight * (profile.goal === "build_muscle" ? 1.8 : 2));
  const fat = Math.round(weight * 0.75);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, fat, carbs };
}

function totals(app) {
  const selected = (app.meals || []).flatMap((meal) => (meal.items || []).filter((item) => app.mealChecks?.[item.id]));
  const foods = [...selected, ...(app.extraFoods || [])];
  return foods.reduce((sum, item) => ({
    calories: sum.calories + Number(item.calories || 0),
    protein: sum.protein + Number(item.protein || 0),
    carbs: sum.carbs + Number(item.carbs || 0),
    fat: sum.fat + Number(item.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function tomorrowWorkout(app) {
  const tomorrowName = DAY_NAMES[(new Date().getDay() + 1) % 7];
  const routine = app.routine || [];
  const workout = routine.find((day) => String(day.day).toLowerCase() === tomorrowName.toLowerCase())
    || routine[new Date().getDay() % Math.max(routine.length, 1)];
  return { name: tomorrowName, workout };
}

function buildGuidance(app) {
  const target = calculateTargets(app.profile);
  const consumed = totals(app);
  const calorieDifference = consumed.calories - target.calories;
  const proteinGap = target.protein - consumed.protein;
  const fatDifference = consumed.fat - target.fat;
  const { name: tomorrowName, workout } = tomorrowWorkout(app);

  let headline;
  let gymAction;
  let adjustment;
  let tone = "steady";

  if (calorieDifference <= -300) {
    headline = `${Math.abs(calorieDifference)} kcal below today’s target`;
    gymAction = "Keep the planned workout. No extra cardio or food compensation is needed.";
    adjustment = "Do not cut tomorrow’s food further. Fuel the session normally.";
    tone = "good";
  } else if (calorieDifference < 200) {
    headline = calorieDifference >= 0
      ? `${calorieDifference} kcal above today’s target`
      : `${Math.abs(calorieDifference)} kcal below today’s target`;
    gymAction = "Follow the normal session exactly as planned.";
    adjustment = "This difference is small; no special correction is needed tomorrow.";
  } else if (calorieDifference <= 500) {
    headline = `${calorieDifference} kcal above today’s target`;
    gymAction = "Keep the planned strength workout. Add only 10–20 minutes of easy walking or low-intensity cardio if you feel recovered.";
    adjustment = "Avoid an aggressive food cut. Return to your normal meal plan tomorrow.";
    tone = "watch";
  } else {
    headline = `${calorieDifference} kcal above today’s target`;
    gymAction = "Keep the planned workout. An optional 20–30 minute easy walk is enough; do not try to burn everything off in one session.";
    adjustment = "Spread any correction across the next 2–3 days with small food adjustments, not one extreme day.";
    tone = "watch";
  }

  const nutritionActions = [];
  if (proteinGap > 20) nutritionActions.push(`Protein is ${proteinGap} g below target: add about 25–40 g of lean protein around tomorrow’s workout.`);
  if (fatDifference > 10) nutritionActions.push(`Fat is ${fatDifference} g above target: choose leaner protein and lighter sauces tomorrow.`);
  if (consumed.carbs < target.carbs * 0.55 && !workout?.rest) nutritionActions.push("Carbohydrate intake is relatively low: include a normal carb serving before or after training.");
  if (!nutritionActions.length) nutritionActions.push("Your macro balance does not require a special change tomorrow.");

  return { tomorrowName, workout, headline, gymAction, adjustment, nutritionActions, tone };
}

function GuidanceCard({ app }) {
  const guidance = useMemo(() => buildGuidance(app), [app]);
  const workout = guidance.workout;

  return (
    <section className={`adaptive-next-card tone-${guidance.tone}`}>
      <div className="adaptive-next-header">
        <div>
          <span className="adaptive-next-kicker">ADAPTIVE NEXT-DAY PLAN</span>
          <h3>What to do tomorrow</h3>
        </div>
        <div className="adaptive-next-score"><Flame size={18} /><strong>{guidance.headline}</strong></div>
      </div>

      <div className="adaptive-next-grid">
        <div className="adaptive-next-workout">
          <div className="adaptive-next-icon"><Dumbbell size={21} /></div>
          <div>
            <small>{guidance.tomorrowName.toUpperCase()} WORKOUT</small>
            <strong>{workout?.focus || "Recovery"}</strong>
            <span>{workout?.rest ? "Recovery day" : `${workout?.duration || 0} minutes · ${workout?.exercises?.length || 0} exercises`}</span>
          </div>
        </div>

        <div className="adaptive-next-action">
          <span><Activity size={17} /> Gym action</span>
          <p>{guidance.gymAction}</p>
          <small>{guidance.adjustment}</small>
        </div>
      </div>

      <div className="adaptive-next-nutrition">
        <span><Beef size={17} /> Nutrition before tomorrow’s session</span>
        {guidance.nutritionActions.map((item) => <p key={item}><ArrowRight size={14} /> {item}</p>)}
      </div>

      <div className="adaptive-next-safety"><CircleAlert size={15} /> Extra food should not be “punished” with extreme exercise. Recommendations use estimated food values and should be adjusted for recovery, pain and medical advice.</div>
    </section>
  );
}

export default function AdaptiveNutritionCoach() {
  const initialRaw = localStorage.getItem(STORAGE_KEY) || "";
  const lastRaw = useRef(initialRaw);
  const [app, setApp] = useState(() => readState(initialRaw));
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    const refresh = () => {
      const title = document.querySelector(".topbar h1")?.textContent?.trim();
      const summary = document.querySelector(".nutrition-summary");
      let target = document.getElementById("adaptive-nutrition-coach-slot");

      if (title === "Nutrition" && summary) {
        if (!target) {
          target = document.createElement("div");
          target.id = "adaptive-nutrition-coach-slot";
          summary.insertAdjacentElement("afterend", target);
        }
        setSlot((current) => current === target ? current : target);
      } else {
        target?.remove();
        setSlot((current) => current ? null : current);
      }

      const raw = localStorage.getItem(STORAGE_KEY) || "";
      if (raw !== lastRaw.current) {
        lastRaw.current = raw;
        setApp(readState(raw));
      }
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(refresh, 700);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document.getElementById("adaptive-nutrition-coach-slot")?.remove();
    };
  }, []);

  return slot && app ? createPortal(<GuidanceCard app={app} />, slot) : null;
}
