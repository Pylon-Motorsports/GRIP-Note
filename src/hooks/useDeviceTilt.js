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

  useEffect(() => {
    let mounted = true;

    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || !mounted) return;
      setReady(true);
      DeviceMotion.setUpdateInterval(100);

      subRef.current = DeviceMotion.addListener(({ accelerationIncludingGravity: accel }) => {
        if (!accel) return;
        // Upright phone: gravity along Y. atan2(x, -y) gives lean angle.
        // +ve = left, -ve = right, ±180° range.
        const leanDeg = Math.atan2(accel.x, -accel.y) * (180 / Math.PI);
        const mag = Math.min(180, Math.abs(leanDeg));
        const dir = mag < dzRef.current ? null : leanDeg > 0 ? 'L' : 'R';
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
