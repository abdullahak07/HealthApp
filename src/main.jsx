import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SimpleHomeManagerV3 from "./SimpleHomeManagerV3";
import CalorieOffsetCoach from "./CalorieOffsetCoach";
import "./styles.css";
import "./simple-home.css";
import "./calorie-offset.css";
import "./routineUploadEnhancer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimpleHomeManagerV3>
      <App />
      <CalorieOffsetCoach />
    </SimpleHomeManagerV3>
  </React.StrictMode>,
);
