"use client";

import { useSyncExternalStore } from "react";

type Greeting = "Good morning" | "Good afternoon" | "Good evening";

function getGreetingForHour(hour: number): Greeting {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getLocalGreeting(): Greeting {
  return getGreetingForHour(new Date().getHours());
}

function subscribeToLocalTime(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 60_000);
  window.addEventListener("focus", onStoreChange);
  document.addEventListener("visibilitychange", onStoreChange);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("focus", onStoreChange);
    document.removeEventListener("visibilitychange", onStoreChange);
  };
}

export function useLocalGreeting() {
  return useSyncExternalStore(
    subscribeToLocalTime,
    getLocalGreeting,
    () => "Welcome",
  );
}
