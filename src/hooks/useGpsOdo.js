/**
 * @module useGpsOdo
 * React hook that tracks GPS distance with two accumulators (total + resettable lap).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

/**
 * Computes the great-circle distance between two GPS coordinates using the haversine formula.
 * @param {{ latitude: number, longitude: number }} a
 * @param {{ latitude: number, longitude: number }} b
 * @returns {number} distance in metres
 */
function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Tracks two GPS distance accumulators:
 *   totalM — distance since the hook mounted (persistent for the screen session)
 *   lapM   — resettable via resetLap()
 *
 * Fires when the device moves ≥5 m (OS-level filter).
 */
export function useGpsOdo() {
  const [totalM, setTotalM] = useState(0);
  const [lapM, setLapM] = useState(0);
  const [ready, setReady] = useState(false);

  const lastPos = useRef(null);
  const totalRef = useRef(0);
  const lapRef = useRef(0);

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setReady(true);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          if (lastPos.current) {
            const d = haversineM(lastPos.current, loc.coords);
            totalRef.current += d;
            lapRef.current += d;
            setTotalM(totalRef.current);
            setLapM(lapRef.current);
          }
          lastPos.current = loc.coords;
        },
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  const resetLap = useCallback(() => {
    lapRef.current = 0;
    setLapM(0);
  }, []);

  return { totalM, lapM, resetLap, ready };
}
