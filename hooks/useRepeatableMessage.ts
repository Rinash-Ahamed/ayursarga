"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export function useRepeatableMessage(initialValue: string | null = null): [string | null, Dispatch<SetStateAction<string | null>>] {
  const [state, setState] = useState({ value: initialValue, sequence: 0 });
  const setValue = useCallback<Dispatch<SetStateAction<string | null>>>((nextValue) => {
    setState((current) => ({
      value: typeof nextValue === "function" ? nextValue(current.value) : nextValue,
      sequence: current.sequence + 1,
    }));
  }, []);
  return [state.value, setValue];
}
