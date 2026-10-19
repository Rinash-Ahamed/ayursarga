"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { createToastNotification, type ToastNotification } from "@/utils/toastNotifications";

export function useRepeatableMessage(initialValue: string | null = null): [string | null, Dispatch<SetStateAction<string | null>>, ToastNotification | null] {
  const [state, setState] = useState(() => ({ value: initialValue, notification: initialValue ? createToastNotification(initialValue) : null }));
  const setValue = useCallback<Dispatch<SetStateAction<string | null>>>((nextValue) => {
    // Allocate once per setter call, outside React's replayable updater.
    const event = createToastNotification("");
    setState((current) => {
      const value = typeof nextValue === "function" ? nextValue(current.value) : nextValue;
      return { value, notification: value ? { ...event, message: value } : null };
    });
  }, []);
  return [state.value, setValue, state.notification];
}
