import "./profileDefaultsSync";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SimpleHomeManagerV4 from "./SimpleHomeManagerV4";
import CalorieOffsetCoach from "./CalorieOffsetCoach";
import "./styles.css";
import "./simple-home.css";
import "./calorie-offset.css";
import "./ai-food.css";
import "./routineUploadEnhancer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimpleHomeManagerV4>
      <App />
      <CalorieOffsetCoach />
    </SimpleHomeManagerV4>
  </React.StrictMode>,
);
