import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bike, CircleAlert, Dumbbell, Footprints, Gauge, PersonStanding, Route, TimerReset } from "lucide-react";

const STORAGE_KEY = "healthai-mvp-v1";

function readState(raw = localStorage.getItem(STORAGE_KEY)) {
  try { return JSON.parse(raw || "null"); }
  catch { return null; }
}

function targets(profile = {}) {
  const weight = Number(profile.weightKg) || 0;
  const height = Number(profile.heightCm) || 0;
  const age = Number(profile.age) || 0;
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, athlete: 1.9 };
  const adjustments = { lose_weight: -500, recomposition: -350, build_muscle: 250, maintain: 0 };
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  return Math.max(1200, Math.round(bmr * (factors[profile.activity] || 1.2) + (adjustments[profile.goal] ?? 0)));
}

function consumed(app) {
  const planned = (app.meals || []).flatMap((meal) => (meal.items || []).filter((item) => app.mealChecks?.[item.id]));
  const extras = app.extraFoods || [];
  const calories = [...planned, ...extras].reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const extraCalories = extras.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  return { calories, extraCalories };
}

function burnMinutes(calories, weightKg, met) {
  if (!calories || !weightKg || !met) return 0;
  const kcalPerMinute = met * 3.5 * weightKg / 200;
  return Math.max(1, Math.round(calories / kcalPerMinute));
}

function equivalents(calories, weightKg) {
  const walkMinutes = burnMinutes(calories, weightKg, 4.8);
  return [
    { label: "Brisk walk", icon: Footprints, minutes: walkMinutes, detail: `about ${Math.round(walkMinutes * 100 / 100) * 1000 / 10}k steps`, steps: walkMinutes * 100 },
    { label: "Incline treadmill", icon: Route, minutes: burnMinutes(calories, weightKg, 6.0), detail: "moderate incline" },
    { label: "Moderate cycling", icon: Bike, minutes: burnMinutes(calories, weightKg, 6.8), detail: "steady effort" },
    { label: "Easy jogging", icon: PersonStanding, minutes: burnMinutes(calories, weightKg, 7.0), detail: "only if appropriate" },
  ];
}

function OffsetCard({ app }) {
  const data = useMemo(() => {
    const target = targets(app.profile);
    const intake = consumed(app);
    const netOver = Math.max(0, intake.calories - target);
    const remaining = Math.max(0, target - intake.calories);
    const weight = Number(app.profile?.weightKg) || 70;
    return {
      target,
      ...intake,
      netOver,
      remaining,
      weight,
      balanceActivities: equivalents(netOver, weight),
      extraActivities: equivalents(intake.extraCalories, weight),
    };
  }, [app]);

  const burnTarget = data.netOver > 0 ? data.netOver : data.extraCalories;
  const activities = data.netOver > 0 ? data.balanceActivities : data.extraActivities;
  const mode = data.netOver > 0 ? "NET OVER TARGET" : "EXTRA-FOOD EQUIVALENT";

  return (
    <section className="offset-card">
      <div className="offset-header">
        <div><span className="offset-kicker">CALORIE BALANCE</span><h3>Activity needed to balance it</h3></div>
        <div className={`offset-balance ${data.netOver > 0 ? "over" : "under"}`}>
          <Gauge size={18} />
          <div><strong>{data.netOver > 0 ? `${data.netOver} kcal over` : `${data.remaining} kcal remaining`}</strong><span>daily target balance</span></div>
        </div>
      </div>

      {data.extraCalories > 0 ? <>
        <div className="offset-explanation">
          <strong>{mode}: {burnTarget} kcal</strong>
          <p>{data.netOver > 0
            ? `You are ${data.netOver} kcal above your full-day target. These options estimate the activity needed to offset that net amount.`
            : `You logged ${data.extraCalories} kcal as extra food, but your full day is still ${data.remaining} kcal below target. No activity is required for daily balance; the options below show the equivalent of the extras only.`}</p>
        </div>

        <div className="offset-activity-grid">
          {activities.map(({ label, icon: Icon, minutes, detail, steps }) => <div key={label}>
            <span className="offset-activity-icon"><Icon size={20} /></span>
            <span><small>{label}</small><strong>{minutes} min</strong><em>{steps ? `≈ ${Math.round(steps).toLocaleString()} steps` : detail}</em></span>
          </div>)}
        </div>
      </> : <div className="offset-empty"><Dumbbell size={25} /><div><strong>No extra food logged</strong><span>Add an extra food to see its walking, steps, cycling and jogging equivalents.</span></div></div>}

      <div className="offset-method">
        <TimerReset size={16} />
        <span>Calculated from your saved weight ({data.weight} kg) using standard MET energy-cost estimates. Real burn can differ by pace, fitness, terrain, heart rate and device accuracy.</span>
      </div>
      <div className="offset-warning"><CircleAlert size={15} /> These are activity equivalents, not guarantees. Stop for pain, dizziness, chest symptoms or unusual breathlessness.</div>
    </section>
  );
}

export default function CalorieOffsetCoach() {
  const firstRaw = localStorage.getItem(STORAGE_KEY) || "";
  const lastRaw = useRef(firstRaw);
  const [app, setApp] = useState(() => readState(firstRaw));
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    const refresh = () => {
      const title = document.querySelector(".topbar h1")?.textContent?.trim();
      const summary = document.querySelector(".nutrition-summary");
      let target = document.getElementById("calorie-offset-slot");

      if (title === "Nutrition" && summary) {
        if (!target) {
          target = document.createElement("div");
          target.id = "calorie-offset-slot";
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
      document.getElementById("calorie-offset-slot")?.remove();
    };
  }, []);

  return slot && app ? createPortal(<OffsetCard app={app} />, slot) : null;
}
