/**
 * @module useDeviceTilt
 * React hook for real-time phone tilt detection using the accelerometer gravity vector.
 */
import { useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';

/**
 * Tracks phone side-tilt using accelerometer gravity vector.
 * Phone held upright in portrait; lean angle = atan2(x, -y).
 * Full ±180° range, no gimbal-lock issues.
 *
 * @param {number} deadZone — angle (°) below which direction is null (rally straight_angle)
 * @returns {{ angleDeg: number, direction: 'L'|'R'|null, ready: boolean }}
 */
export function useDeviceTilt(deadZone = 3) {
  const [angleDeg, setAngleDeg] = useState(0);
  const [direction, setDirection] = useState(null);
  const [ready, setReady] = useState(false);
  const subRef = useRef(null);
  const dzRef = useRef(deadZone);
  dzRef.current = deadZone;
  const smoothRef = useRef(0); // EMA-smoothed lean angle (unwrapped, continuous)
  const prevRawRef = useRef(0); // previous raw atan2 reading
  const offsetRef = useRef(0); // accumulated unwrap offset

  // Smoothing factor: 0 = ignore new data, 1 = no smoothing. 0.5 = responsive but dampened.
  const ALPHA = 0.5;

  useEffect(() => {
    let mounted = true;

    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || !mounted) return;
      setReady(true);
      DeviceMotion.setUpdateInterval(80);

      subRef.current = DeviceMotion.addListener(({ accelerationIncludingGravity: accel }) => {
        if (!accel) return;
        // Upright phone: gravity along Y. atan2(x, -y) gives lean angle.
        // +ve = left, -ve = right, ±180° range.
        const rawDeg = Math.atan2(accel.x, -accel.y) * (180 / Math.PI);

        // Unwrap: detect ±180° boundary crossings and accumulate offset
        let delta = rawDeg - prevRawRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        offsetRef.current += delta;
        prevRawRef.current = rawDeg;

        // EMA on the unwrapped continuous angle
        smoothRef.current = ALPHA * offsetRef.current + (1 - ALPHA) * smoothRef.current;

        // Normalize back to ±180° so direction flips when crossing 180°
        let smoothed = smoothRef.current % 360;
        if (smoothed > 180) smoothed -= 360;
        if (smoothed < -180) smoothed += 360;
        const mag = Math.abs(smoothed);
        const dir = mag < dzRef.current ? null : smoothed > 0 ? 'L' : 'R';
        setAngleDeg(mag);
        setDirection(dir);
      });
    });

    return () => {
      mounted = false;
      subRef.current?.remove();
    };
  }, []);

  return { angleDeg, direction, ready };
}
