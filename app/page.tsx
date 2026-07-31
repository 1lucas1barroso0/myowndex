"use client";

import App from "../src/App.jsx";
import ErrorBoundary from "../src/components/ErrorBoundary.jsx";

export default function Home() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
