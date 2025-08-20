"use client";

import { DependencyList, EffectCallback } from "react";
import { useEffect } from "react";

type Destructor = () => void;
type AsyncDestructor = () => Promise<void>;
type AsyncEffectCallback = () => Promise<void | Destructor | AsyncDestructor>;

export function useAsyncEffect(
  callback: EffectCallback | AsyncEffectCallback,
  deps?: DependencyList,
) {
  useEffect(() => {
    const mayPromise = callback();

    if (mayPromise instanceof Promise) {
      return () =>
        void mayPromise.then((cleanup) => {
          if (typeof cleanup === "function") cleanup?.();
        });
    }
    return mayPromise;
  }, deps);
}
