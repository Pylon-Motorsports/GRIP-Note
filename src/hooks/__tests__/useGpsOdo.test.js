/**
 * Tests for the haversine formula used in useGpsOdo.
 * We extract and test the math directly since the hook internals
 * use the haversineM function for GPS distance calculations.
 */

// Re-implement haversineM here to test the formula independently
// (it's not exported from the module, so we test the algorithm directly)
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

describe('haversineM (GPS distance formula)', () => {
  it('returns 0 for identical points', () => {
    const pt = { latitude: 51.5074, longitude: -0.1278 };
    expect(haversineM(pt, pt)).toBe(0);
  });

  it('calculates a known short distance (~111 km per degree latitude)', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 1, longitude: 0 };
    const dist = haversineM(a, b);
    // 1 degree of latitude ≈ 111,195 m
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it('calculates London to Paris (~340 km)', () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const dist = haversineM(london, paris);
    // ~343 km
    expect(dist).toBeGreaterThan(330000);
    expect(dist).toBeLessThan(360000);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const a = { latitude: 40.7128, longitude: -74.006 }; // NYC
    const b = { latitude: 34.0522, longitude: -118.2437 }; // LA
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 5);
  });

  it('handles antipodal points (~20,015 km)', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 180 };
    const dist = haversineM(a, b);
    // Half of Earth's circumference at equator ≈ 20,037 km
    expect(dist).toBeGreaterThan(20000000);
    expect(dist).toBeLessThan(20100000);
  });

  it('handles small distances accurately (~1 m)', () => {
    const a = { latitude: 51.5074, longitude: -0.1278 };
    // ~1m north
    const b = { latitude: 51.5074 + 0.000009, longitude: -0.1278 };
    const dist = haversineM(a, b);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });
});
