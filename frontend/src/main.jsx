import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 1. If index.css is in the 'src' folder, this is correct. 
// If you don't have an index.css, just delete this line.
import "./index.css"; 

// 2. Point to the new location of App.jsx
import App from "./pages/App.jsx"; 

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);