import { useEffect, useState } from "react";

/** The current time, updated on each minute boundary — enough for clocks and countdowns. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const current = new Date();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
