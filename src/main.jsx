import "./profileDefaultsSync";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountCloudManager from "./AccountCloudManager";
import SimpleHomeManagerV4 from "./SimpleHomeManagerV4";
import CalorieOffsetCoach from "./CalorieOffsetCoach";
import "./styles.css";
import "./simple-home.css";
import "./calorie-offset.css";
import "./ai-food.css";
import "./account-cloud.css";
import "./routineUploadEnhancer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AccountCloudManager>
      <SimpleHomeManagerV4>
        <App />
        <CalorieOffsetCoach />
      </SimpleHomeManagerV4>
    </AccountCloudManager>
  </React.StrictMode>,
);
