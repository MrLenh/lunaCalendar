import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Whether the calendar UI shows lunar day numbers, solar only, or both. */
export type CalendarDisplayMode = "lunar" | "solar" | "both";

const STORAGE_KEY = "luna.calendarDisplay";

interface CalendarDisplayContextValue {
  displayMode: CalendarDisplayMode;
  setDisplayMode: (mode: CalendarDisplayMode) => void;
  isLoaded: boolean;
}

const CalendarDisplayContext = createContext<CalendarDisplayContextValue | undefined>(undefined);

export function CalendarDisplayProvider({ children }: PropsWithChildren) {
  const [displayMode, setDisplayModeState] = useState<CalendarDisplayMode>("both");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "lunar" || stored === "solar" || stored === "both") {
          setDisplayModeState(stored);
        }
      } catch {
        // ignore - keep default "both"
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setDisplayMode = (mode: CalendarDisplayMode) => {
    setDisplayModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  };

  const value = useMemo(
    () => ({ displayMode, setDisplayMode, isLoaded }),
    [displayMode, isLoaded]
  );

  return (
    <CalendarDisplayContext.Provider value={value}>{children}</CalendarDisplayContext.Provider>
  );
}

export function useCalendarDisplay(): CalendarDisplayContextValue {
  const ctx = useContext(CalendarDisplayContext);
  if (!ctx) throw new Error("useCalendarDisplay must be used within a CalendarDisplayProvider");
  return ctx;
}
