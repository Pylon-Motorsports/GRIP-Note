/**
 * Tests for the tilt angle math used in useDeviceTilt.
 * The hook uses: leanDeg = atan2(accel.x, -accel.y) * (180 / PI)
 * Then: mag = min(180, abs(leanDeg))
 *       dir = mag < deadZone ? null : leanDeg > 0 ? 'L' : 'R'
 */

// Re-implement the tilt math to test independently
function computeTilt(accel, deadZone = 3) {
  const leanDeg = Math.atan2(accel.x, -accel.y) * (180 / Math.PI);
  const mag = Math.min(180, Math.abs(leanDeg));
  const dir = mag < deadZone ? null : leanDeg > 0 ? 'L' : 'R';
  return { angleDeg: mag, direction: dir };
}

describe('tilt angle math (atan2 formula)', () => {
  it('upright phone (x=0, y=-9.8) → 0°, null direction', () => {
    const { angleDeg, direction } = computeTilt({ x: 0, y: -9.8 });
    expect(angleDeg).toBeCloseTo(0, 1);
    expect(direction).toBeNull();
  });

  it('tilted left (x=9.8, y=0) → 90° L', () => {
    const { angleDeg, direction } = computeTilt({ x: 9.8, y: 0 });
    expect(angleDeg).toBeCloseTo(90, 0);
    expect(direction).toBe('L');
  });

  it('tilted right (x=-9.8, y=0) → 90° R', () => {
    const { angleDeg, direction } = computeTilt({ x: -9.8, y: 0 });
    expect(angleDeg).toBeCloseTo(90, 0);
    expect(direction).toBe('R');
  });

  it('slight left tilt within dead zone → null direction', () => {
    // 2° tilt with 3° dead zone
    const rad = (2 * Math.PI) / 180;
    const x = 9.8 * Math.sin(rad);
    const y = -9.8 * Math.cos(rad);
    const { angleDeg, direction } = computeTilt({ x, y }, 3);
    expect(angleDeg).toBeCloseTo(2, 0);
    expect(direction).toBeNull();
  });

  it('tilt just above dead zone → has direction', () => {
    const rad = (5 * Math.PI) / 180;
    const x = 9.8 * Math.sin(rad);
    const y = -9.8 * Math.cos(rad);
    const { angleDeg, direction } = computeTilt({ x, y }, 3);
    expect(angleDeg).toBeCloseTo(5, 0);
    expect(direction).toBe('L');
  });

  it('upside-down phone (y=9.8) → 180°', () => {
    const { angleDeg } = computeTilt({ x: 0, y: 9.8 });
    expect(angleDeg).toBeCloseTo(180, 0);
  });

  it('45° left tilt', () => {
    // At 45°: x = 9.8 * sin(45°), y = -9.8 * cos(45°)
    const val = 9.8 * Math.SQRT1_2;
    const { angleDeg, direction } = computeTilt({ x: val, y: -val });
    expect(angleDeg).toBeCloseTo(45, 0);
    expect(direction).toBe('L');
  });

  it('45° right tilt', () => {
    const val = 9.8 * Math.SQRT1_2;
    const { angleDeg, direction } = computeTilt({ x: -val, y: -val });
    expect(angleDeg).toBeCloseTo(45, 0);
    expect(direction).toBe('R');
  });

  it('custom dead zone (10°) — 8° tilt returns null', () => {
    const rad = (8 * Math.PI) / 180;
    const x = 9.8 * Math.sin(rad);
    const y = -9.8 * Math.cos(rad);
    const { direction } = computeTilt({ x, y }, 10);
    expect(direction).toBeNull();
  });
});
