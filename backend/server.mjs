import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const port = Number(process.env.PORT || 8080);
const geminiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS || "https://abdullahak07.github.io,http://localhost:5173",
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const requestsByIp = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);

const foodSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Short user-friendly name for the complete food or meal.",
    },
    serving: {
      type: "string",
      description: "Interpreted serving size, including count, household unit, grams, or millilitres.",
    },
    calories: {
      type: "integer",
      description: "Best estimate of total food energy in kcal for the interpreted serving.",
    },
    calorieMin: {
      type: "integer",
      description: "Plausible lower bound in kcal for the serving.",
    },
    calorieMax: {
      type: "integer",
      description: "Plausible upper bound in kcal for the serving.",
    },
    protein: {
      type: "number",
      description: "Estimated total protein in grams.",
    },
    carbs: {
      type: "number",
      description: "Estimated total carbohydrate in grams.",
    },
    fat: {
      type: "number",
      description: "Estimated total fat in grams.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence based on portion specificity, brand information, and cooking-method detail.",
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
      description: "Important assumptions that materially affect the estimate.",
    },
    needsClarification: {
      type: "boolean",
      description: "True only when a useful estimate cannot be made without one essential missing detail.",
    },
    clarificationQuestion: {
      type: "string",
      description: "One concise question when needsClarification is true; otherwise an empty string.",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          serving: { type: "string" },
          calories: { type: "integer" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["name", "serving", "calories", "protein", "carbs", "fat"],
      },
      description: "Breakdown of individual foods when the entry contains multiple components.",
    },
  },
  required: [
    "name",
    "serving",
    "calories",
    "calorieMin",
    "calorieMax",
    "protein",
    "carbs",
    "fat",
    "confidence",
    "assumptions",
    "needsClarification",
    "clarificationQuestion",
    "items",
  ],
};

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const current = requestsByIp.get(ip);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestsByIp.set(ip, { startedAt: now, count: 1 });
    next();
    return;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "Too many food estimates. Please wait one minute and try again." });
    return;
  }

  current.count += 1;
  next();
}

function cleanNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normaliseResult(result, originalText) {
  const calories = Math.round(cleanNumber(result.calories));
  let calorieMin = Math.round(cleanNumber(result.calorieMin, calories));
  let calorieMax = Math.round(cleanNumber(result.calorieMax, calories));

  if (calorieMin > calorieMax) [calorieMin, calorieMax] = [calorieMax, calorieMin];
  calorieMin = Math.min(calorieMin, calories);
  calorieMax = Math.max(calorieMax, calories);

  return {
    name: String(result.name || originalText).trim(),
    serving: String(result.serving || "Estimated serving").trim(),
    calories,
    calorieMin,
    calorieMax,
    protein: Math.round(cleanNumber(result.protein) * 10) / 10,
    carbs: Math.round(cleanNumber(result.carbs) * 10) / 10,
    fat: Math.round(cleanNumber(result.fat) * 10) / 10,
    confidence: ["high", "medium", "low"].includes(result.confidence)
      ? result.confidence
      : "low",
    assumptions: Array.isArray(result.assumptions)
      ? result.assumptions.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 5)
      : [],
    needsClarification: Boolean(result.needsClarification),
    clarificationQuestion: String(result.clarificationQuestion || "").trim(),
    items: Array.isArray(result.items)
      ? result.items.slice(0, 12).map((item) => ({
          name: String(item.name || "Food").trim(),
          serving: String(item.serving || "Estimated serving").trim(),
          calories: Math.round(cleanNumber(item.calories)),
          protein: Math.round(cleanNumber(item.protein) * 10) / 10,
          carbs: Math.round(cleanNumber(item.carbs) * 10) / 10,
          fat: Math.round(cleanNumber(item.fat) * 10) / 10,
        }))
      : [],
    source: `Gemini ${geminiModel}`,
    estimated: true,
  };
}

async function estimateWithGemini(text, context = {}) {
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the backend.");
  }

  const prompt = `
You are the nutrition estimation engine for HealthAI, an Australian routine-first health application.

Estimate the food described by the user. Support everyday Australian, halal, South Asian and Middle Eastern foods, including homemade and restaurant meals. Interpret natural phrases such as "pizza 1 slice", "one plate chicken biryani", "2 rotis with chicken karahi", or "large halal snack pack".

Rules:
- Use the quantity, brand, restaurant, preparation method and serving description supplied by the user.
- Do not silently interpret one slice as a whole pizza or one piece as 100 grams.
- For multi-food entries, estimate each component and return an item breakdown.
- Return the best estimate plus a realistic minimum and maximum range.
- Use high confidence only for a precise branded/labelled item or a clearly specified weighed serving.
- Use medium confidence for a common food with a clear household portion.
- Use low confidence for restaurant, homemade mixed dishes, unspecified oil, or unclear plate/bowl sizes.
- Mention assumptions that materially affect energy, especially oil, sauces, cheese, meat cut, serving weight and cooking method.
- Ask one clarification question only when the description is too ambiguous to give a useful estimate. Otherwise estimate with an uncertainty range.
- Calories are nutritional kilocalories.
- Do not provide medical advice.

User profile context (may be incomplete):
${JSON.stringify(context)}

Food entry:
${JSON.stringify(text)}
`.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema: foodSchema,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini returned HTTP ${response.status}`;
    throw new Error(message);
  }

  const outputText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!outputText) throw new Error("Gemini returned no food estimate.");
  return normaliseResult(JSON.parse(outputText), text);
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed."));
    },
    methods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(rateLimit);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "healthai-gemini-food-estimator",
    model: geminiModel,
    geminiConfigured: Boolean(geminiKey),
  });
});

app.post("/api/food/estimate", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (text.length < 2 || text.length > 500) {
    res.status(400).json({ error: "Food description must contain between 2 and 500 characters." });
    return;
  }

  try {
    const result = await estimateWithGemini(text, {
      country: req.body?.country || "Australia",
      weightKg: cleanNumber(req.body?.weightKg),
      dietaryPreference: req.body?.dietaryPreference || "halal when relevant",
    });
    res.json(result);
  } catch (error) {
    console.error("Gemini food estimate failed", error);
    res.status(502).json({
      error: "AI food estimation failed.",
      detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error),
    });
  }
});

app.use((error, _req, res, _next) => {
  console.error("HealthAI backend error", error);
  res.status(500).json({ error: "The HealthAI backend could not process this request." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`HealthAI Gemini backend listening on port ${port}`);
});
