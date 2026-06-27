import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bike, CircleAlert, Dumbbell, Footprints, Gauge, PersonStanding, Route, TimerReset } from "lucide-react";

const STORAGE_KEY = "healthai-mvp-v1";

function readState(raw = localStorage.getItem(STORAGE_KEY)) {
  try { return JSON.parse(raw || "null"); }
  catch { return null; }
}

function dailyTarget(profile = {}) {
  const weight = Number(profile.weightKg) || 0;
  const height = Number(profile.heightCm) || 0;
  const age = Number(profile.age) || 0;
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, athlete: 1.9 };
  const adjustments = { lose_weight: -500, recomposition: -350, build_muscle: 250, maintain: 0 };
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  return Math.max(1200, Math.round(bmr * (factors[profile.activity] || 1.2) + (adjustments[profile.goal] ?? 0)));
}

function consumedCalories(app) {
  const planned = (app.meals || []).flatMap((meal) =>
    (meal.items || []).filter((item) => app.mealChecks?.[item.id]),
  );
  return [...planned, ...(app.extraFoods || [])]
    .reduce((sum, item) => sum + Number(item.calories || 0), 0);
}

function burnMinutes(calories, weightKg, met) {
  if (!calories || !weightKg || !met) return 0;
  const kcalPerMinute = met * 3.5 * weightKg / 200;
  return Math.max(1, Math.round(calories / kcalPerMinute));
}

function equivalents(calories, weightKg) {
  const walkMinutes = burnMinutes(calories, weightKg, 4.8);
  return [
    { label: "Brisk walk", icon: Footprints, minutes: walkMinutes, detail: `≈ ${Math.round(walkMinutes * 110).toLocaleString()} steps` },
    { label: "Incline treadmill", icon: Route, minutes: burnMinutes(calories, weightKg, 6.0), detail: "moderate incline" },
    { label: "Moderate cycling", icon: Bike, minutes: burnMinutes(calories, weightKg, 6.8), detail: "steady effort" },
    { label: "Easy jogging", icon: PersonStanding, minutes: burnMinutes(calories, weightKg, 7.0), detail: "only if appropriate" },
  ];
}

function OffsetCard({ app }) {
  const data = useMemo(() => {
    const target = dailyTarget(app.profile);
    const consumed = consumedCalories(app);
    const balance = consumed - target;
    const netOver = Math.max(0, balance);
    const remaining = Math.max(0, -balance);
    const weight = Number(app.profile?.weightKg) || 70;
    return {
      target,
      consumed,
      netOver,
      remaining,
      weight,
      activities: equivalents(netOver, weight),
    };
  }, [app]);

  return (
    <section className="offset-card">
      <div className="offset-header">
        <div><span className="offset-kicker">CALORIE BALANCE</span><h3>Activity needed to balance the day</h3></div>
        <div className={`offset-balance ${data.netOver > 0 ? "over" : "under"}`}>
          <Gauge size={18} />
          <div>
            <strong>{data.netOver > 0 ? `${data.netOver} kcal over` : `${data.remaining} kcal remaining`}</strong>
            <span>net daily balance</span>
          </div>
        </div>
      </div>

      {data.netOver > 0 ? <>
        <div className="offset-explanation">
          <strong>NET SURPLUS TO OFFSET: {data.netOver} kcal</strong>
          <p>Your total logged intake is {data.netOver} kcal above your daily target. The options below estimate the activity required to offset only that net surplus.</p>
        </div>

        <div className="offset-activity-grid">
          {data.activities.map(({ label, icon: Icon, minutes, detail }) => <div key={label}>
            <span className="offset-activity-icon"><Icon size={20} /></span>
            <span><small>{label}</small><strong>{minutes} min</strong><em>{detail}</em></span>
          </div>)}
        </div>
      </> : <div className="offset-empty">
        <Dumbbell size={25} />
        <div>
          <strong>No balancing activity required</strong>
          <span>You are still {data.remaining} kcal below your daily target. Extra foods are already included in that total, so the correct offset is 0 kcal.</span>
        </div>
      </div>}

      <div className="offset-method">
        <TimerReset size={16} />
        <span>When a surplus exists, activity time is estimated from your saved weight ({data.weight} kg) using the MET equation: kcal/min = MET × 3.5 × body weight ÷ 200.</span>
      </div>
      <div className="offset-warning"><CircleAlert size={15} /> Exercise burn and food intake cannot be measured exactly from steps alone. These are estimates, not guarantees.</div>
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
