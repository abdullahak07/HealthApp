const configuredUrl = String(import.meta.env.VITE_AI_API_URL || "").trim().replace(/\/+$/, "");

export function isGeminiFoodEnabled() {
  return Boolean(configuredUrl);
}

function cleanResult(result, originalText) {
  const calories = Math.max(0, Math.round(Number(result.calories || 0)));
  const calorieMin = Math.max(0, Math.round(Number(result.calorieMin ?? calories)));
  const calorieMax = Math.max(calorieMin, Math.round(Number(result.calorieMax ?? calories)));

  return {
    name: String(result.name || originalText).trim(),
    serving: String(result.serving || "Estimated serving").trim(),
    calories,
    calorieMin: Math.min(calorieMin, calories),
    calorieMax: Math.max(calorieMax, calories),
    protein: Math.max(0, Math.round(Number(result.protein || 0) * 10) / 10),
    carbs: Math.max(0, Math.round(Number(result.carbs || 0) * 10) / 10),
    fat: Math.max(0, Math.round(Number(result.fat || 0) * 10) / 10),
    confidence: ["high", "medium", "low"].includes(result.confidence) ? result.confidence : "low",
    assumptions: Array.isArray(result.assumptions) ? result.assumptions.map(String).filter(Boolean) : [],
    needsClarification: Boolean(result.needsClarification),
    clarificationQuestion: String(result.clarificationQuestion || "").trim(),
    items: Array.isArray(result.items) ? result.items : [],
    source: String(result.source || "Gemini AI estimate"),
    sourceDetail: String(result.sourceDetail || result.serving || "AI-interpreted serving"),
    estimated: true,
  };
}

async function lookupBarcode(barcode) {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,serving_quantity,serving_size,nutriments`,
  );
  if (!response.ok) throw new Error("Barcode lookup failed.");

  const payload = await response.json();
  const product = payload.product;
  const nutrients = product?.nutriments;
  if (!nutrients) throw new Error("No nutrition information was found for that barcode.");

  const servingGrams = Number(product.serving_quantity || 100);
  const factor = servingGrams / 100;
  const calories = Math.round(Number(nutrients["energy-kcal_100g"] || 0) * factor);

  return cleanResult(
    {
      name: product.product_name || `Barcode ${barcode}`,
      serving: product.serving_size || `${servingGrams} g`,
      calories,
      calorieMin: calories,
      calorieMax: calories,
      protein: Number(nutrients.proteins_100g || 0) * factor,
      carbs: Number(nutrients.carbohydrates_100g || 0) * factor,
      fat: Number(nutrients.fat_100g || 0) * factor,
      confidence: "high",
      assumptions: ["The product database serving size was used."],
      needsClarification: false,
      clarificationQuestion: "",
      items: [],
      source: "Open Food Facts barcode",
      sourceDetail: product.serving_size || `${servingGrams} g serving`,
    },
    barcode,
  );
}

export async function estimateFoodWithAI(text, profile = {}) {
  const value = String(text || "").trim();
  if (!value) throw new Error("Enter a food or meal first.");

  const barcode = value.match(/^\d{8,14}$/)?.[0];
  if (barcode) return lookupBarcode(barcode);

  if (!configuredUrl) {
    const error = new Error("Gemini is ready in the code but the secure backend URL has not been connected yet.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`${configuredUrl}/api/food/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: value,
      country: "Australia",
      weightKg: Number(profile.weightKg || 0),
      dietaryPreference: "halal when relevant",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Gemini could not estimate this food.");
  }

  return cleanResult(payload, value);
}
