import { createRoot } from "react-dom/client";
import App from "./App";
import { installAnalytics } from "./lib/analytics";
import "./index.css";

installAnalytics();
createRoot(document.getElementById("root")!).render(<App />);
