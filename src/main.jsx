import React from "react"
import ReactDOM from "react-dom/client"
import { inject } from "@vercel/analytics"
import App from "./App.jsx"
import "./index.css"

// Cookie-free page view stats. Only reports on Vercel deployments with Web Analytics
// enabled in the project dashboard; in development it just logs to the console.
inject()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
