import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SimpleHomeManager from "./SimpleHomeManager";
import "./styles.css";
import "./simple-home.css";
import "./routineUploadEnhancer";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimpleHomeManager>
      <App />
    </SimpleHomeManager>
  </React.StrictMode>,
);
