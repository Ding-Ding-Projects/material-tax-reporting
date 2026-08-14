import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import * as SiteAppModule from "../app/SiteApp";
import "../app/globals.css";

const rootElement = document.getElementById("root");
const siteAppExports = SiteAppModule as {
  default?: ComponentType;
  SiteApp?: ComponentType;
};
const SiteApp = siteAppExports.default ?? siteAppExports.SiteApp;

if (!rootElement) {
  throw new Error("Missing #root element for the Pages entry point.");
}

if (!SiteApp) {
  throw new Error(
    "Missing a default or named SiteApp export for the Pages entry point.",
  );
}

createRoot(rootElement).render(<SiteApp />);
