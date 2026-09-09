// hooks/useWeather.js — React Hook for Real-Time Antarctic Weather (Open-Meteo)
// Indian Antarctic Research Stations (Bharati & Maitri)

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchStationWeather,
  fetchAllStationsWeather,
  getFallbackWeather,
} from "../services/weatherService.js";
import { getStation, DEFAULT_STATION_ID } from "../data/stations.js";

// Requirement 5: Automatic refresh every 5 minutes (5 * 60 * 1000 ms = 300,000 ms)
export const DEFAULT_WEATHER_REFRESH_MS = 5 * 60 * 1000;

/**
 * Custom React hook to fetch, cache, and automatically refresh real-time
 * Open-Meteo weather for Antarctic research stations.
 *
 * @param {string} stationId - "BHARATI" | "MAITRI" (defaults to "BHARATI")
 * @param {object} options - Configuration options
 * @param {number} [options.refreshIntervalMs=300000] - Polling interval in ms (default 5 min)
 * @param {boolean} [options.autoRefresh=true] - Whether to automatically refresh
 * @param {boolean} [options.enabled=true] - Master toggle for fetching
 * @param {boolean} [options.fetchBothStations=true] - Pre-fetch and cache both stations
 */
export function useWeather(stationId = DEFAULT_STATION_ID, options = {}) {
  const {
    refreshIntervalMs = DEFAULT_WEATHER_REFRESH_MS,
    autoRefresh = true,
    enabled = true,
    fetchBothStations = true,
  } = options;

  const currentStation = getStation(stationId);
  const currentStationId = currentStation.id;

  const [stationsWeather, setStationsWeather] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefreshTime, setNextRefreshTime] = useState(null);

  // Keep ref to latest state to avoid stale closures in timers
  const stationsWeatherRef = useRef(stationsWeather);
  stationsWeatherRef.current = stationsWeather;

  const abortControllerRef = useRef(null);

  /**
   * Performs the weather fetch.
   * @param {boolean} isManual - Whether triggered by user action vs background interval
   */
  const executeFetch = useCallback(
    async (isManual = false) => {
      if (!enabled) return;

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const hasExistingData = Boolean(stationsWeatherRef.current[currentStationId]);
      if (!hasExistingData || isManual) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        if (fetchBothStations) {
          // Fetch both Bharati & Maitri concurrently for seamless station toggling
          const weatherMap = await fetchAllStationsWeather({ signal });
          setStationsWeather(weatherMap);
        } else {
          // Fetch only the active station
          const singleStationWeather = await fetchStationWeather(currentStationId, { signal });
          setStationsWeather((prev) => ({
            ...prev,
            [currentStationId]: singleStationWeather,
          }));
        }

        const now = new Date();
        setLastUpdated(now);
        setNextRefreshTime(new Date(now.getTime() + refreshIntervalMs));
        setError(null);
      } catch (err) {
        if (err.name === "AbortError") {
          // Ignore aborted requests
          return;
        }

        console.error(`[useWeather] Error fetching weather for ${currentStationId}:`, err);
        setError(err.message || "Failed to load real-time weather data");

        // Fallback gracefully: If no data exists yet, inject fallback so UI stays functional
        if (!stationsWeatherRef.current[currentStationId]) {
          const fallback = getFallbackWeather(currentStationId, err.message);
          setStationsWeather((prev) => ({
            ...prev,
            [currentStationId]: fallback,
          }));
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [enabled, fetchBothStations, currentStationId, refreshIntervalMs]
  );

  // Initial fetch on mount or when station/options change
  useEffect(() => {
    executeFetch(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [executeFetch]);

  // Requirement 5: Automatic refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh || !enabled || refreshIntervalMs <= 0) return;

    const intervalId = setInterval(() => {
      executeFetch(false);
    }, refreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [autoRefresh, enabled, refreshIntervalMs, executeFetch]);

  // Active weather object for the requested station
  const weather = stationsWeather[currentStationId] || null;

  const refetch = useCallback(() => {
    return executeFetch(true);
  }, [executeFetch]);

  return {
    weather,
    stationsWeather,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    nextRefreshTime,
    refreshIntervalMs,
    refetch,
    station: currentStation,
  };
}

export default useWeather;
