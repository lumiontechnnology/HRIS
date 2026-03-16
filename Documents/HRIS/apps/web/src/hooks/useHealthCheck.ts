'use client';

// Frontend Health Check Hook
// Monitors API connectivity and basic health

import { useEffect, useState } from 'react';

export interface HealthStatus {
  isHealthy: boolean;
  apiReachable: boolean;
  lastChecked: Date | null;
  error?: string;
}

export function useHealthCheck(interval: number = 60000) {
  const [health, setHealth] = useState<HealthStatus>({
    isHealthy: true,
    apiReachable: true,
    lastChecked: null,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/health`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          setHealth({
            isHealthy: true,
            apiReachable: true,
            lastChecked: new Date(),
          });
        } else {
          setHealth({
            isHealthy: false,
            apiReachable: true,
            lastChecked: new Date(),
            error: `API returned ${response.status}`,
          });
        }
      } catch (error) {
        setHealth({
          isHealthy: false,
          apiReachable: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    // Initial check
    checkHealth();

    // Set up interval
    const timer = setInterval(checkHealth, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return health;
}
