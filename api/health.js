export default {
  fetch() {
    return Response.json(
      {
        ok: true,
        service: "healthai-vercel-gemini",
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
};
