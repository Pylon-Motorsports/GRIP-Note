/**
 * @module GpsOdoBar
 * Horizontal bar showing GPS total distance and resettable lap distance.
 * Renders nothing until GPS permission is granted and location is available.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGpsOdo } from '../hooks/useGpsOdo';

/**
 * Formats a distance in metres for display (auto-switches to km above 1000 m).
 * @param {number} m — distance in metres
 * @returns {string}
 */
function fmtM(m) {
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return Math.round(m) + ' m';
}

/**
 * GPS odometer bar with TOTAL and LAP displays.
 * Tap LAP to reset it. Returns null when GPS is unavailable.
 * @returns {React.ReactElement|null}
 */
export default function GpsOdoBar() {
  const { totalM, lapM, resetLap, ready } = useGpsOdo();

  if (!ready) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.cell}>
        <Text style={styles.label}>TOTAL</Text>
        <Text style={styles.value}>{fmtM(totalM)}</Text>
      </View>
      <View style={styles.sep} />
      <TouchableOpacity style={styles.cell} onPress={resetLap} activeOpacity={0.6}>
        <Text style={styles.label}>LAP ↺</Text>
        <Text style={styles.value}>{fmtM(lapM)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  sep: {
    width: 1,
    backgroundColor: '#1c1c1c',
    marginVertical: 2,
  },
  label: {
    color: '#555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  value: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
});
