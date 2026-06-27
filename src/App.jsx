import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Apple,
  ArrowRight,
  BarChart3,
  Beef,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Dumbbell,
  FileText,
  Flame,
  HeartPulse,
  Home,
  Info,
  LayoutDashboard,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  Upload,
  UserRound,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import {
  activityMultipliers,
  defaultMeals,
  defaultProfile,
  goalSettings,
  workoutDays,
} from "./data/seedData";

const STORAGE_KEY = "healthai-mvp-v1";

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // A corrupt local cache should never stop the app from opening.
  }

  return {
    profile: defaultProfile,
    meals: defaultMeals,
    extraFoods: [],
    mealChecks: {},
    exerciseChecks: {},
    routine: workoutDays,
    routineSource: "Built-in Phase 3 routine",
    weightHistory: [{ date: new Date().toISOString().slice(0, 10), weight: defaultProfile.weightKg }],
  };
}

function calculateTargets(profile) {
  const weight = Number(profile.weightKg) || 0;
  const height = Number(profile.heightCm) || 0;
  const age = Number(profile.age) || 0;
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const multiplier = activityMultipliers[profile.activity]?.factor || 1.2;
  const maintenance = bmr * multiplier;
  const adjustment = goalSettings[profile.goal]?.adjustment ?? 0;
  const calorieTarget = Math.max(1200, Math.round(maintenance + adjustment));
  const proteinPerKg = profile.goal === "build_muscle" ? 1.8 : 2;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round(weight * 0.75);
  const carbs = Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4));
  const bmi = height ? weight / ((height / 100) ** 2) : 0;
  const weeklyChange = adjustment < 0 ? Math.abs((adjustment * 7) / 7700) : -(adjustment * 7) / 7700;

  return {
    bmi: Number(bmi.toFixed(1)),
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    calorieTarget,
    protein,
    carbs,
    fat,
    weeklyChange: Number(weeklyChange.toFixed(2)),
  };
}

function macroTotals(items) {
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

function getBmiLabel(bmi) {
  if (!bmi) return "Not calculated";
  if (bmi < 18.5) return "Below standard range";
  if (bmi < 25) return "Standard range";
  if (bmi < 30) return "Above standard range";
  return "High range";
}

function generateStarterRoutine(profile) {
  const days = Number(profile.weeklyTrainingDays) || 3;
  const home = profile.equipment?.toLowerCase().includes("home");
  const db = home ? "Dumbbell" : "Machine or dumbbell";

  const templates = days <= 3
    ? [
        ["Monday", "Full Body A", [["Goblet Squat", "3", "8–12", "90 sec"], ["Incline Press", "3", "8–12", "90 sec"], ["Lat Pulldown", "3", "10–12", "75 sec"], ["Romanian Deadlift", "3", "8–12", "90 sec"], ["Pallof Press", "3", "12 each", "45 sec"]]],
        ["Wednesday", "Full Body B", [["Leg Press", "3", "10–15", "90 sec"], ["Seated Row", "3", "8–12", "75 sec"], [`${db} Shoulder Press`, "3", "8–12", "75 sec"], ["Split Squat", "3", "10 each", "75 sec"], ["Dead Bug", "3", "10 each", "45 sec"]]],
        ["Friday", "Full Body C", [["Hip Thrust", "3", "10–12", "90 sec"], ["Chest Press", "3", "8–12", "90 sec"], ["Assisted Pulldown", "3", "10–12", "75 sec"], ["Step-Up", "3", "10 each", "75 sec"], ["Farmer’s Carry", "3", "30 m", "60 sec"]]],
      ]
    : [
        ["Monday", "Upper A", [["Incline Press", "4", "8–12", "90 sec"], ["Lat Pulldown", "4", "8–12", "75 sec"], ["Seated Row", "3", "10–12", "75 sec"], ["Lateral Raise", "3", "12–15", "60 sec"], ["Rope Pushdown", "3", "12–15", "60 sec"]]],
        ["Tuesday", "Lower A", [["Leg Press", "4", "8–12", "90 sec"], ["Romanian Deadlift", "3", "8–12", "90 sec"], ["Leg Curl", "3", "10–15", "75 sec"], ["Calf Raise", "3", "12–15", "60 sec"], ["Dead Bug", "3", "10 each", "45 sec"]]],
        ["Thursday", "Upper B", [["Chest Press", "4", "8–12", "90 sec"], ["Cable Row", "4", "8–12", "75 sec"], ["Shoulder Press", "3", "8–12", "75 sec"], ["Face Pull", "3", "15–20", "60 sec"], ["Biceps Curl", "3", "10–15", "60 sec"]]],
        ["Friday", "Lower B", [["Goblet Squat", "4", "10–15", "90 sec"], ["Hip Thrust", "3", "10–12", "90 sec"], ["Split Squat", "3", "10 each", "75 sec"], ["Leg Extension", "3", "12–15", "60 sec"], ["Pallof Press", "3", "12 each", "45 sec"]]],
      ];

  const mapped = templates.map(([day, focus, exercises], index) => ({
    id: `generated-${index}`,
    day,
    short: day.slice(0, 3).toUpperCase(),
    focus,
    subtitle: `${profile.goal === "recomposition" ? "Fat loss + muscle retention" : goalSettings[profile.goal]?.label || "Personalised"}`,
    duration: Number(profile.workoutMinutes) || 55,
    estimatedCalories: 300,
    color: ["orange", "purple", "cyan", "green"][index % 4],
    warmup: "5–8 minutes easy cardio plus controlled mobility for the joints trained today.",
    exercises,
    cooldown: "5 minutes easy movement and comfortable stretching. Stop any movement that causes pain.",
  }));

  return mapped;
}

function App() {
  const [app, setApp] = useState(loadState);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [extraModal, setExtraModal] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState("post-gym");
  const [selectedWorkout, setSelectedWorkout] = useState(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : Math.min(jsDay - 1, 5);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
  }, [app]);

  const targets = useMemo(() => calculateTargets(app.profile), [app.profile]);
  const plannedItems = useMemo(() => app.meals.flatMap((meal) => meal.items.filter((item) => !item.optional || app.mealChecks[item.id])), [app.meals, app.mealChecks]);
  const plannedTotals = useMemo(() => macroTotals(plannedItems), [plannedItems]);
  const loggedPlannedItems = useMemo(
    () => app.meals.flatMap((meal) => meal.items.filter((item) => app.mealChecks[item.id])),
    [app.meals, app.mealChecks],
  );
  const consumed = useMemo(
    () => macroTotals([...loggedPlannedItems, ...app.extraFoods]),
    [loggedPlannedItems, app.extraFoods],
  );
  const remaining = targets.calorieTarget - consumed.calories;
  const progress = Math.min(100, Math.round((consumed.calories / Math.max(targets.calorieTarget, 1)) * 100));

  const updateProfile = (profile) => setApp((current) => ({ ...current, profile }));
  const toggleMealItem = (id) => setApp((current) => ({
    ...current,
    mealChecks: { ...current.mealChecks, [id]: !current.mealChecks[id] },
  }));
  const toggleExercise = (dayId, index) => {
    const key = `${dayId}-${index}`;
    setApp((current) => ({
      ...current,
      exerciseChecks: { ...current.exerciseChecks, [key]: !current.exerciseChecks[key] },
    }));
  };

  const nav = [
    { id: "dashboard", label: "Today", icon: LayoutDashboard },
    { id: "nutrition", label: "Nutrition", icon: Utensils },
    { id: "workout", label: "Workout", icon: Dumbbell },
    { id: "progress", label: "Progress", icon: BarChart3 },
    { id: "profile", label: "Profile", icon: UserRound },
  ];

  const view = {
    dashboard: <Dashboard app={app} targets={targets} consumed={consumed} plannedTotals={plannedTotals} remaining={remaining} progress={progress} setActiveTab={setActiveTab} setExtraModal={setExtraModal} />,
    nutrition: <Nutrition app={app} targets={targets} consumed={consumed} expandedMeal={expandedMeal} setExpandedMeal={setExpandedMeal} toggleMealItem={toggleMealItem} setExtraModal={setExtraModal} setApp={setApp} />,
    workout: <Workout app={app} selectedWorkout={selectedWorkout} setSelectedWorkout={setSelectedWorkout} toggleExercise={toggleExercise} setApp={setApp} />,
    progress: <Progress app={app} targets={targets} setApp={setApp} />,
    profile: <Profile profile={app.profile} targets={targets} editing={profileEditing} setEditing={setProfileEditing} onSave={updateProfile} resetApp={() => setApp(loadState())} />,
  }[activeTab];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><HeartPulse size={25} /></div>
          <div><strong>HealthAI</strong><span>Adaptive fitness coach</span></div>
        </div>

        <nav className="side-nav">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeTab === id ? "active" : ""} onClick={() => { setActiveTab(id); setMobileNavOpen(false); }}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="mini-icon"><Sparkles size={17} /></div>
          <strong>AI Coach</strong>
          <p>Your plan adapts to food, training and progress.</p>
          <button onClick={() => setActiveTab("dashboard")}>View recommendation <ArrowRight size={14} /></button>
        </div>
        <div className="medical-note"><Info size={15} /><span>Wellness guidance only. Not medical diagnosis or emergency care.</span></div>
      </aside>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div>
            <span className="eyebrow">{new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
            <h1>{nav.find((item) => item.id === activeTab)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="quick-add" onClick={() => setExtraModal(true)}><Plus size={17} /> Log food</button>
            <button className="avatar" onClick={() => setActiveTab("profile")}>{app.profile.name?.slice(0, 1).toUpperCase() || "U"}</button>
          </div>
        </header>
        <div className="content">{view}</div>
      </main>

      <nav className="mobile-tabs">
        {nav.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {extraModal && <ExtraFoodModal onClose={() => setExtraModal(false)} onAdd={(food) => {
        setApp((current) => ({ ...current, extraFoods: [...current.extraFoods, { ...food, id: crypto.randomUUID() }] }));
        setExtraModal(false);
      }} />}
    </div>
  );
}

function Dashboard({ app, targets, consumed, plannedTotals, remaining, progress, setActiveTab, setExtraModal }) {
  const todayIndex = new Date().getDay() === 0 ? 6 : Math.min(new Date().getDay() - 1, app.routine.length - 1);
  const todayWorkout = app.routine[todayIndex] || app.routine[0];
  const proteinProgress = Math.min(100, Math.round((consumed.protein / targets.protein) * 100));
  const calorieDifference = consumed.calories - targets.calorieTarget;
  const recoveryCalories = Math.max(0, calorieDifference);
  const recommendation = recoveryCalories > 0
    ? `You are about ${Math.round(recoveryCalories)} kcal above today’s target. Do not try to punish this with one extreme workout. Return to your plan and optionally add a 20–30 minute walk or spread a small adjustment across the next few days.`
    : consumed.protein < targets.protein * 0.65 && consumed.calories > targets.calorieTarget * 0.55
      ? `Protein is currently ${Math.round(targets.protein - consumed.protein)} g below target. Prioritise a lean protein serving in your next meal rather than cutting food aggressively.`
      : `You are currently on track. Complete the planned session, keep hydration steady and log anything extra so the weekly estimate stays useful.`;

  return (
    <>
      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="pill"><Sparkles size={14} /> PERSONAL PLAN</span>
            <h2>Good day, {app.profile.name}.</h2>
            <p>Your calorie, protein and training targets are ready. Log what actually happens; the plan adjusts from there.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setExtraModal(true)}><Plus size={17} /> Add food</button>
              <button className="secondary-button" onClick={() => setActiveTab("workout")}><Dumbbell size={17} /> Open workout</button>
            </div>
          </div>
          <div className="calorie-ring" style={{ "--progress": `${progress * 3.6}deg` }}>
            <div><strong>{consumed.calories}</strong><span>of {targets.calorieTarget} kcal</span></div>
          </div>
        </div>

        <div className="coach-card">
          <div className="card-title-row"><div><span className="eyebrow accent">AI COACH</span><h3>Today’s guidance</h3></div><div className="bot-icon"><Bot size={22} /></div></div>
          <p>{recommendation}</p>
          <div className="coach-safety"><CircleAlert size={15} /> Calorie burn and food estimates are approximate.</div>
        </div>
      </section>

      <section className="stat-grid">
        <MetricCard icon={Flame} label="Calories left" value={remaining >= 0 ? remaining : Math.abs(remaining)} unit="kcal" note={remaining >= 0 ? "remaining today" : "above target"} tone={remaining >= 0 ? "orange" : "red"} />
        <MetricCard icon={Beef} label="Protein" value={consumed.protein} unit={`g / ${targets.protein} g`} note={`${proteinProgress}% of target`} tone="purple" progress={proteinProgress} />
        <MetricCard icon={Scale} label="Current weight" value={app.profile.weightKg} unit="kg" note={`${Math.abs(app.profile.weightKg - app.profile.targetWeightKg).toFixed(1)} kg to target`} tone="cyan" />
        <MetricCard icon={Target} label="BMI screening" value={targets.bmi} unit="" note={getBmiLabel(targets.bmi)} tone="green" />
      </section>

      <section className="dashboard-lower">
        <div className="panel">
          <div className="panel-heading"><div><span className="eyebrow">NUTRITION PLAN</span><h3>Today’s planned intake</h3></div><button className="text-button" onClick={() => setActiveTab("nutrition")}>View meals <ChevronRight size={15} /></button></div>
          <div className="macro-overview">
            <MacroBar label="Calories" value={plannedTotals.calories} target={targets.calorieTarget} suffix="kcal" />
            <MacroBar label="Protein" value={plannedTotals.protein} target={targets.protein} suffix="g" />
            <MacroBar label="Carbs" value={plannedTotals.carbs} target={targets.carbs} suffix="g" />
            <MacroBar label="Fat" value={plannedTotals.fat} target={targets.fat} suffix="g" />
          </div>
          <div className="meal-preview-list">
            {app.meals.slice(0, 4).map((meal) => {
              const totals = macroTotals(meal.items.filter((item) => !item.optional));
              return <div className="meal-preview" key={meal.id}><span className="meal-emoji">{meal.icon}</span><div><strong>{meal.title}</strong><span>{meal.time}</span></div><b>{totals.calories} kcal</b></div>;
            })}
          </div>
        </div>

        <div className="panel workout-preview-panel">
          <div className="panel-heading"><div><span className="eyebrow">TODAY’S TRAINING</span><h3>{todayWorkout?.focus || "Recovery"}</h3></div><button className="text-button" onClick={() => setActiveTab("workout")}>Open <ChevronRight size={15} /></button></div>
          {todayWorkout?.rest ? (
            <div className="rest-state"><HeartPulse size={42} /><h4>Recovery day</h4><p>Easy movement, mobility and sleep support tomorrow’s training.</p></div>
          ) : (
            <>
              <div className="workout-meta"><span><CalendarDays size={15} /> {todayWorkout?.day}</span><span><Activity size={15} /> {todayWorkout?.duration} min</span><span><Flame size={15} /> ~{todayWorkout?.estimatedCalories} kcal</span></div>
              <div className="exercise-preview">
                {todayWorkout?.exercises.slice(0, 5).map((exercise, index) => <div key={exercise[0]}><span>{String(index + 1).padStart(2, "0")}</span><strong>{exercise[0]}</strong><b>{exercise[1]} × {exercise[2]}</b></div>)}
              </div>
              <button className="full-button" onClick={() => setActiveTab("workout")}><Zap size={17} /> Start workout</button>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, unit, note, tone, progress }) {
  return <div className={`metric-card tone-${tone}`}><div className="metric-icon"><Icon size={20} /></div><span>{label}</span><div className="metric-value"><strong>{value}</strong><b>{unit}</b></div>{progress !== undefined && <div className="tiny-progress"><i style={{ width: `${Math.min(progress, 100)}%` }} /></div>}<small>{note}</small></div>;
}

function MacroBar({ label, value, target, suffix }) {
  const percentage = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  return <div className="macro-row"><div><strong>{label}</strong><span>{Math.round(value)} / {target} {suffix}</span></div><div className="bar"><i style={{ width: `${percentage}%` }} /></div></div>;
}

function Nutrition({ app, targets, consumed, expandedMeal, setExpandedMeal, toggleMealItem, setExtraModal, setApp }) {
  const accuracyQuestions = app.meals.flatMap((meal) => meal.items).filter((item) => item.uncertain).length;
  return (
    <>
      <section className="page-intro"><div><span className="pill"><Apple size={14} /> DAILY FOOD LOG</span><h2>Your normal diet, made measurable.</h2><p>Confirm each item when eaten. The starting values are estimates until serving sizes and product labels are verified.</p></div><button className="primary-button" onClick={() => setExtraModal(true)}><Plus size={17} /> Add extra food</button></section>

      <section className="nutrition-summary">
        <div><span>Consumed</span><strong>{consumed.calories}</strong><small>kcal</small></div>
        <div><span>Remaining</span><strong>{targets.calorieTarget - consumed.calories}</strong><small>kcal</small></div>
        <div><span>Protein</span><strong>{consumed.protein}</strong><small>of {targets.protein} g</small></div>
        <div><span>Carbs</span><strong>{consumed.carbs}</strong><small>of {targets.carbs} g</small></div>
        <div><span>Fat</span><strong>{consumed.fat}</strong><small>of {targets.fat} g</small></div>
      </section>

      <div className="accuracy-banner"><CircleAlert size={19} /><div><strong>{accuracyQuestions} serving values still need confirmation</strong><p>Open each meal and edit the saved foods later when exact brands, weights and cooking methods are available.</p></div></div>

      <section className="nutrition-layout">
        <div className="meal-stack">
          {app.meals.map((meal) => {
            const totals = macroTotals(meal.items.filter((item) => !item.optional || app.mealChecks[item.id]));
            const isOpen = expandedMeal === meal.id;
            const completed = meal.items.filter((item) => !item.optional).every((item) => app.mealChecks[item.id]);
            return <div className={`meal-card ${completed ? "completed" : ""}`} key={meal.id}>
              <button className="meal-header" onClick={() => setExpandedMeal(isOpen ? null : meal.id)}>
                <span className="meal-emoji large">{meal.icon}</span><div><span>{meal.time}</span><h3>{meal.title}</h3><small>{totals.calories} kcal · {totals.protein} g protein</small></div><div className="meal-status">{completed && <i><Check size={13} /></i>}<ChevronDown size={18} className={isOpen ? "rotated" : ""} /></div>
              </button>
              {isOpen && <div className="meal-items">
                {meal.items.map((item) => <button key={item.id} className={`food-row ${app.mealChecks[item.id] ? "checked" : ""}`} onClick={() => toggleMealItem(item.id)}>
                  <span className="food-check">{app.mealChecks[item.id] && <Check size={14} />}</span><div><strong>{item.name}</strong><span>{item.serving}{item.optional ? " · optional" : ""}</span></div><div className="food-macros"><b>{item.calories} kcal</b><span>P {item.protein} · C {item.carbs} · F {item.fat}</span></div>
                </button>)}
              </div>}
            </div>;
          })}
        </div>

        <aside className="extra-food-panel">
          <div className="panel-heading"><div><span className="eyebrow">UNPLANNED FOOD</span><h3>Extras today</h3></div><button className="icon-button" onClick={() => setExtraModal(true)}><Plus size={18} /></button></div>
          {app.extraFoods.length === 0 ? <div className="empty-small"><Utensils size={30} /><p>No extra food logged.</p><button onClick={() => setExtraModal(true)}>Add something</button></div> : app.extraFoods.map((food) => <div className="extra-row" key={food.id}><div><strong>{food.name}</strong><span>{food.calories} kcal · {food.protein} g protein</span></div><button onClick={() => setApp((current) => ({ ...current, extraFoods: current.extraFoods.filter((item) => item.id !== food.id) }))}><Trash2 size={16} /></button></div>)}
          <div className="day-boundary"><Settings size={16} /><span>Daily log closes at <strong>{app.profile.dayEndsAt}</strong></span></div>
        </aside>
      </section>
    </>
  );
}

function Workout({ app, selectedWorkout, setSelectedWorkout, toggleExercise, setApp }) {
  const routine = app.routine;
  const current = routine[selectedWorkout] || routine[0];
  const [uploadNote, setUploadNote] = useState("");

  const importRoutine = async (file) => {
    if (!file) return;
    const isText = file.type.startsWith("text/") || file.name.endsWith(".json");
    if (isText) {
      const text = await file.text();
      setUploadNote(`Imported ${file.name}. The text is saved as a source note; structured AI parsing will be connected to the backend next.`);
      setApp((state) => ({ ...state, routineSource: file.name, importedRoutineText: text.slice(0, 50000) }));
    } else {
      setUploadNote(`${file.name} attached. PDF/image extraction requires the secure AI parsing service planned for the backend.`);
      setApp((state) => ({ ...state, routineSource: file.name }));
    }
  };

  const generate = () => {
    const generated = generateStarterRoutine(app.profile);
    setApp((state) => ({ ...state, routine: generated, routineSource: "AI starter routine generated from profile", exerciseChecks: {} }));
    setSelectedWorkout(0);
    setUploadNote("A starter routine was generated from your profile. Review it before training and replace painful movements.");
  };

  return (
    <>
      <section className="page-intro workout-intro"><div><span className="pill"><Dumbbell size={14} /> {app.routineSource}</span><h2>Your training week.</h2><p>Complete exercises, upload another routine or generate a new starter plan from your profile.</p></div><div className="intro-actions"><label className="secondary-button upload-label"><Upload size={17} /> Upload routine<input type="file" accept=".pdf,.txt,.json,image/*" onChange={(e) => importRoutine(e.target.files?.[0])} /></label><button className="primary-button" onClick={generate}><Sparkles size={17} /> Generate for me</button></div></section>
      {uploadNote && <div className="info-banner"><Info size={18} /><span>{uploadNote}</span><button onClick={() => setUploadNote("")}><X size={16} /></button></div>}

      <div className="week-strip">
        {routine.map((day, index) => <button key={day.id} className={`${index === selectedWorkout ? "active" : ""} ${day.rest ? "rest" : ""}`} onClick={() => setSelectedWorkout(index)}><span>{day.short}</span><strong>{day.rest ? "Rest" : day.focus.split(" ")[0]}</strong></button>)}
      </div>

      {current && <section className="workout-card">
        <div className={`workout-header color-${current.color}`}><div><span className="eyebrow">{current.day.toUpperCase()}</span><h2>{current.focus}</h2><p>{current.subtitle}</p></div><div className="workout-numbers"><div><strong>{current.duration}</strong><span>minutes</span></div><div><strong>{current.exercises.length}</strong><span>exercises</span></div><div><strong>~{current.estimatedCalories}</strong><span>kcal estimate</span></div></div></div>
        {current.rest ? <div className="rest-large"><HeartPulse size={52} /><h3>Recovery supports progress.</h3><p>{current.cooldown}</p></div> : <>
          <div className="warmup-box"><Flame size={18} /><div><strong>Warm-up</strong><p>{current.warmup}</p></div></div>
          <div className="exercise-table">
            <div className="exercise-table-head"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span><span>Done</span></div>
            {current.exercises.map((exercise, index) => {
              const key = `${current.id}-${index}`;
              const done = app.exerciseChecks[key];
              return <button key={key} className={`exercise-row ${done ? "done" : ""}`} onClick={() => toggleExercise(current.id, index)}><span className="exercise-name"><i>{String(index + 1).padStart(2, "0")}</i><strong>{exercise[0]}</strong></span><span>{exercise[1]}</span><span>{exercise[2]}</span><span>{exercise[3]}</span><span className="round-check">{done && <Check size={15} />}</span></button>;
            })}
          </div>
          <div className="cooldown-box"><Activity size={18} /><div><strong>Cool-down</strong><p>{current.cooldown}</p></div></div>
          <div className="workout-warning"><CircleAlert size={17} /><span>Stop if pain, dizziness, chest symptoms or unusual shortness of breath occurs. Exercise-calorie values are estimates, not credits that must be “earned”.</span></div>
        </>}
      </section>}
    </>
  );
}

function Progress({ app, targets, setApp }) {
  const [weight, setWeight] = useState(app.profile.weightKg);
  const history = [...app.weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const first = history[0]?.weight || app.profile.weightKg;
  const latest = history.at(-1)?.weight || app.profile.weightKg;
  const change = Number((latest - first).toFixed(1));
  const range = Math.max(4, Math.max(...history.map((x) => x.weight)) - Math.min(...history.map((x) => x.weight)));
  const max = Math.max(...history.map((x) => x.weight)) + 1;
  const min = max - range - 2;

  const addWeight = () => {
    const parsed = Number(weight);
    if (!parsed || parsed < 30 || parsed > 350) return;
    const today = new Date().toISOString().slice(0, 10);
    setApp((state) => ({
      ...state,
      profile: { ...state.profile, weightKg: parsed },
      weightHistory: [...state.weightHistory.filter((entry) => entry.date !== today), { date: today, weight: parsed }],
    }));
  };

  return <>
    <section className="page-intro"><div><span className="pill"><TrendingDown size={14} /> BODY PROGRESS</span><h2>Track the trend, not one reading.</h2><p>Weight naturally fluctuates. Weekly averages and consistent measurements are more useful than reacting to a single day.</p></div></section>
    <section className="progress-grid">
      <div className="panel progress-chart-panel"><div className="panel-heading"><div><span className="eyebrow">WEIGHT TREND</span><h3>{latest} kg</h3></div><span className={`change-badge ${change <= 0 ? "good" : ""}`}>{change > 0 ? "+" : ""}{change} kg</span></div>
        <div className="chart-area">
          {history.length === 1 ? <div className="single-point"><Scale size={34} /><p>Add more weigh-ins to build your trend.</p></div> : <svg viewBox="0 0 600 220" role="img" aria-label="Weight history chart"><polyline fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" points={history.map((entry, i) => `${20 + (i / (history.length - 1)) * 560},${195 - ((entry.weight - min) / (max - min)) * 165}`).join(" ")} />{history.map((entry, i) => <circle key={entry.date} cx={20 + (i / (history.length - 1)) * 560} cy={195 - ((entry.weight - min) / (max - min)) * 165} r="6" fill="currentColor" />)}</svg>}
        </div>
      </div>
      <div className="panel checkin-panel"><span className="eyebrow">NEW CHECK-IN</span><h3>Log today’s weight</h3><label>Weight (kg)<div className="input-with-action"><input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} /><button onClick={addWeight}><Save size={17} /> Save</button></div></label><div className="target-summary"><Target size={20} /><div><span>Target weight</span><strong>{app.profile.targetWeightKg} kg</strong></div></div><div className="target-summary"><Flame size={20} /><div><span>Estimated daily target</span><strong>{targets.calorieTarget} kcal</strong></div></div></div>
    </section>
    <section className="stat-grid progress-stats"><MetricCard icon={Scale} label="Starting weight" value={first} unit="kg" note="first saved reading" tone="purple" /><MetricCard icon={TrendingDown} label="Change" value={Math.abs(change)} unit="kg" note={change <= 0 ? "reduced" : "increased"} tone="green" /><MetricCard icon={Target} label="Distance to target" value={Math.abs(latest - app.profile.targetWeightKg).toFixed(1)} unit="kg" note="based on latest reading" tone="orange" /><MetricCard icon={CalendarDays} label="Check-ins" value={history.length} unit="" note="saved locally" tone="cyan" /></section>
  </>;
}

function Profile({ profile, targets, editing, setEditing, onSave, resetApp }) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const set = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const save = () => { onSave({ ...draft, age: Number(draft.age), heightCm: Number(draft.heightCm), weightKg: Number(draft.weightKg), targetWeightKg: Number(draft.targetWeightKg), weeklyTrainingDays: Number(draft.weeklyTrainingDays), workoutMinutes: Number(draft.workoutMinutes) }); setEditing(false); };

  return <>
    <section className="page-intro"><div><span className="pill"><UserRound size={14} /> PERSONAL PROFILE</span><h2>Your plan starts with your data.</h2><p>These values drive calorie, macro and routine calculations. All MVP data is stored in this browser.</p></div>{editing ? <div className="intro-actions"><button className="secondary-button" onClick={() => { setDraft(profile); setEditing(false); }}>Cancel</button><button className="primary-button" onClick={save}><Save size={17} /> Save profile</button></div> : <button className="primary-button" onClick={() => setEditing(true)}><Settings size={17} /> Edit profile</button>}</section>

    <section className="profile-layout">
      <div className="panel profile-form">
        <div className="form-grid">
          <FormField label="Name"><input disabled={!editing} value={draft.name} onChange={(e) => set("name", e.target.value)} /></FormField>
          <FormField label="Age"><input disabled={!editing} type="number" value={draft.age} onChange={(e) => set("age", e.target.value)} /></FormField>
          <FormField label="Sex used for BMR estimate"><select disabled={!editing} value={draft.sex} onChange={(e) => set("sex", e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other / neutral estimate</option></select></FormField>
          <FormField label="Height (cm)"><input disabled={!editing} type="number" value={draft.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></FormField>
          <FormField label="Current weight (kg)"><input disabled={!editing} type="number" step="0.1" value={draft.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></FormField>
          <FormField label="Target weight (kg)"><input disabled={!editing} type="number" step="0.1" value={draft.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} /></FormField>
          <FormField label="Goal"><select disabled={!editing} value={draft.goal} onChange={(e) => set("goal", e.target.value)}>{Object.entries(goalSettings).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></FormField>
          <FormField label="Activity level"><select disabled={!editing} value={draft.activity} onChange={(e) => set("activity", e.target.value)}>{Object.entries(activityMultipliers).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></FormField>
          <FormField label="Training days per week"><input disabled={!editing} type="number" min="2" max="7" value={draft.weeklyTrainingDays} onChange={(e) => set("weeklyTrainingDays", e.target.value)} /></FormField>
          <FormField label="Preferred session length"><input disabled={!editing} type="number" value={draft.workoutMinutes} onChange={(e) => set("workoutMinutes", e.target.value)} /></FormField>
          <FormField label="Equipment"><input disabled={!editing} value={draft.equipment} onChange={(e) => set("equipment", e.target.value)} /></FormField>
          <FormField label="Daily log closes"><input disabled={!editing} type="time" value={draft.dayEndsAt} onChange={(e) => set("dayEndsAt", e.target.value)} /></FormField>
          <FormField label="Injuries, pain or restrictions" wide><textarea disabled={!editing} rows="4" value={draft.injuries} onChange={(e) => set("injuries", e.target.value)} /></FormField>
        </div>
      </div>
      <aside className="profile-sidebar">
        <div className="panel calculation-card"><span className="eyebrow">ESTIMATED TARGETS</span><div className="calculation-list"><div><span>BMI</span><strong>{targets.bmi}</strong></div><div><span>Basal metabolic rate</span><strong>{targets.bmr} kcal</strong></div><div><span>Maintenance</span><strong>{targets.maintenance} kcal</strong></div><div className="highlight"><span>Daily target</span><strong>{targets.calorieTarget} kcal</strong></div><div><span>Protein</span><strong>{targets.protein} g</strong></div><div><span>Carbohydrate</span><strong>{targets.carbs} g</strong></div><div><span>Fat</span><strong>{targets.fat} g</strong></div></div><p className="fine-print">Mifflin–St Jeor and activity multipliers provide estimates. Real needs vary and should be adjusted using progress trends.</p></div>
        <button className="danger-ghost" onClick={() => { localStorage.removeItem(STORAGE_KEY); resetApp(); }}><RotateCcw size={17} /> Reset demonstration data</button>
      </aside>
    </section>
  </>;
}

function FormField({ label, children, wide }) { return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>; }

function ExtraFoodModal({ onClose, onAdd }) {
  const [food, setFood] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const set = (field, value) => setFood((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!food.name.trim() || !Number(food.calories)) return;
    onAdd({ name: food.name.trim(), calories: Number(food.calories), protein: Number(food.protein || 0), carbs: Number(food.carbs || 0), fat: Number(food.fat || 0) });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">QUICK LOG</span><h2>Add extra food</h2></div><button type="button" onClick={onClose}><X /></button></div><p>Enter the label values when known. AI text/photo estimation will connect through the backend service in the next build stage.</p><FormField label="Food or meal"><input autoFocus placeholder="e.g. chicken burger and fries" value={food.name} onChange={(e) => set("name", e.target.value)} /></FormField><div className="form-grid modal-grid"><FormField label="Calories"><input required type="number" min="1" placeholder="650" value={food.calories} onChange={(e) => set("calories", e.target.value)} /></FormField><FormField label="Protein (g)"><input type="number" min="0" placeholder="35" value={food.protein} onChange={(e) => set("protein", e.target.value)} /></FormField><FormField label="Carbs (g)"><input type="number" min="0" placeholder="70" value={food.carbs} onChange={(e) => set("carbs", e.target.value)} /></FormField><FormField label="Fat (g)"><input type="number" min="0" placeholder="25" value={food.fat} onChange={(e) => set("fat", e.target.value)} /></FormField></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={17} /> Add to today</button></div></form></div>;
}

export default App;
