import { useEffect, useState } from "react";
import { Snowfall } from "falling-snow/react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getPrefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export default function SeasonalSnowOverlay() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event) => setPrefersReducedMotion(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-30 pointer-events-none overflow-hidden"
    >
      <Snowfall
        colors={["#94a3b8"]}
        count={75}
        flake="mixed"
        speed={0.8}
        wind={0.3}
        zIndex={30}
      />
    </div>
  );
}
