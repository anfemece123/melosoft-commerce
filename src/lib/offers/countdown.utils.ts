import { useState, useEffect, useRef } from 'react';

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  expired: boolean;
}

function calculateRemaining(expiresAt: string | null): CountdownTime {
  if (!expiresAt) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }
  const total = new Date(expiresAt).getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours   = Math.floor((total / 1000 / 60 / 60) % 24);
  const days    = Math.floor(total / 1000 / 60 / 60 / 24);
  return { days, hours, minutes, seconds, total, expired: false };
}

export function useCountdown(expiresAt: string | null): CountdownTime {
  const [countdown, setCountdown] = useState<CountdownTime>(() => calculateRemaining(expiresAt));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!expiresAt) {
      setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true });
      return;
    }

    setCountdown(calculateRemaining(expiresAt));

    intervalRef.current = setInterval(() => {
      const next = calculateRemaining(expiresAt);
      setCountdown(next);
      if (next.expired && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  return countdown;
}
