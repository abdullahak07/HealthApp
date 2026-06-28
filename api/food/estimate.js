const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const foodSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    serving: { type: "string" },
    calories: { type: "integer" },
    calorieMin: { type: "integer" },
    calorieMax: { type: "integer" },
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    assumptions: { type: "array", items: { type: "string" } },
    needsClarification: { type: "boolean" },
    clarificationQuestion: { type: "string" },
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
        additionalProperties: false,
      },
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
  additionalProperties: false,
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
      ? result.assumptions.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 6)
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
    source: `Gemini ${MODEL}`,
    sourceDetail: "AI-interpreted serving and preparation",
    estimated: true,
  };
}

function buildPrompt(text, context) {
  return `
You are the nutrition estimation engine for HealthAI, an Australian routine-first nutrition and workout app.

Estimate the user's food accurately enough for practical calorie tracking. Support Australian, halal, South Asian and Middle Eastern foods, including homemade dishes, restaurant meals and mixed plates.

Rules:
- Respect the exact quantity, count, household unit, brand, restaurant and cooking method stated by the user.
- Never interpret one slice as a whole pizza, one piece as 100 grams, or one plate as a fixed universal weight.
- For mixed meals, estimate each component and return an item breakdown.
- Return a best estimate plus a realistic minimum and maximum calorie range.
- Use high confidence only for a weighed serving, clear nutrition label, barcode or exact branded product.
- Use medium confidence for a common food with a clear household portion.
- Use low confidence for homemade or restaurant mixed dishes, unspecified oil, sauces or unclear plate/bowl size.
- State assumptions that materially affect the estimate, especially oil, sauces, cheese, meat cut, portion weight and preparation.
- Ask one short clarification question only when the description is too ambiguous to make a useful estimate. Otherwise estimate and expose uncertainty.
- Calories are nutritional kilocalories.
- Do not provide medical advice.

User context:
${JSON.stringify(context)}

Food entry:
${JSON.stringify(text)}
`.trim();
}

async function callGemini(prompt, apiKey, useJsonSchema = true) {
  const generationConfig = {
    temperature: 0.15,
    responseMimeType: "application/json",
  };

  if (useJsonSchema) generationConfig.responseJsonSchema = foodSchema;
  else generationConfig.responseSchema = foodSchema;

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
}

async function estimateFood(text, context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Vercel.");

  const prompt = buildPrompt(text, context);
  let response = await callGemini(prompt, apiKey, true);

  if (!response.ok && response.status === 400) {
    const firstError = await response.clone().json().catch(() => ({}));
    const message = String(firstError?.error?.message || "");
    if (/responseJsonSchema|unknown field|invalid json schema/i.test(message)) {
      response = await callGemini(prompt, apiKey, false);
    }
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini returned HTTP ${response.status}`);
  }

  const outputText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!outputText) throw new Error("Gemini returned no nutrition estimate.");
  return normaliseResult(JSON.parse(outputText), text);
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 20_000) return json({ error: "Request is too large." }, 413);
      body = JSON.parse(raw || "{}");
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }

    const text = String(body?.text || "").trim();
    if (text.length < 2 || text.length > 500) {
      return json({ error: "Food description must contain between 2 and 500 characters." }, 400);
    }

    try {
      const result = await estimateFood(text, {
        country: body?.country || "Australia",
        weightKg: cleanNumber(body?.weightKg),
        dietaryPreference: body?.dietaryPreference || "halal when relevant",
      });
      return json(result);
    } catch (error) {
      console.error("Gemini food estimate failed", error);
      return json(
        {
          error: "Gemini could not estimate this food.",
          detail: process.env.VERCEL_ENV === "production" ? undefined : String(error?.message || error),
        },
        502,
      );
    }
  },
};
