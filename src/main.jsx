import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SimpleHomeManagerV2 from "./SimpleHomeManagerV2";
import AdaptiveNutritionCoach from "./AdaptiveNutritionCoach";
import "./styles.css";
import "./simple-home.css";
import "./adaptive-nutrition-coach.css";
import "./routineUploadEnhancer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimpleHomeManagerV2>
      <App />
      <AdaptiveNutritionCoach />
    </SimpleHomeManagerV2>
  </React.StrictMode>,
);
