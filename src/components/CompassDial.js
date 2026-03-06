/**
 * @module CompassDial
 * Circular compass dial for Drive mode showing severity labels at configured angles.
 * The ring and labels stay fixed; a red needle rotates with phone tilt.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const DIAL_SIZE = Math.min(SCREEN_W - 40, 240);
const DIAL_R = DIAL_SIZE / 2;
const RING_R = DIAL_R - 4;
const LABEL_R = DIAL_R - 22;
const TICK_OUTER = RING_R - 2;
const TICK_INNER = RING_R - 14;
const TICK_MID = (TICK_OUTER + TICK_INNER) / 2;
const TICK_LEN = TICK_OUTER - TICK_INNER;

const ACCENT = '#e63946';

/**
 * Compass dial with fixed severity labels and a rotating needle.
 * Centre displays the currently detected direction + severity (e.g. "L 3") or "Straight".
 *
 * @param {Object} props
 * @param {number}  [props.angleDeg=0]     — 0–180° magnitude of current tilt
 * @param {'L'|'R'|null} [props.direction=null] — detected tilt direction
 * @param {import('../types').AngleMap} [props.angleMap={}] — { severityValue: degrees }
 * @param {string|null}  [props.detectedSev=null] — currently matched severity value
 * @returns {React.ReactElement}
 */
export default function CompassDial({
  angleDeg = 0,
  direction = null,
  angleMap = {},
  detectedSev = null,
}) {
  // Needle rotates: positive = clockwise (right tilt), negative = CCW (left tilt)
  const needleAngle = direction === 'R' ? angleDeg : direction === 'L' ? -angleDeg : 0;

  const { labels, ticks } = useMemo(() => {
    const labels = [];
    const ticks = [];

    for (const [sev, angle] of Object.entries(angleMap)) {
      if (angle === 0) {
        labels.push({ key: `straight-${sev}`, sev, a: 0, side: null });
      } else {
        labels.push({ key: `R-${sev}`, sev, a: angle, side: 'R' });
        labels.push({ key: `L-${sev}`, sev, a: -angle, side: 'L' });
        ticks.push({ key: `Rt-${sev}`, a: angle });
        ticks.push({ key: `Lt-${sev}`, a: -angle });
      }
    }
    return { labels, ticks };
  }, [angleMap]);

  const centreText = direction ? `${direction}  ${detectedSev ?? '--'}` : 'Straight';

  return (
    <View style={styles.wrapper}>
      <View style={styles.dialOuter}>
        {/* ── Fixed ring with labels and ticks ────────────────────────── */}
        <View style={styles.dial}>
          <View style={styles.ring} />

          {ticks.map(({ key, a }) => {
            const rad = (a * Math.PI) / 180;
            const cx = DIAL_R + TICK_MID * Math.sin(rad);
            const cy = DIAL_R - TICK_MID * Math.cos(rad);
            return (
              <View
                key={key}
                style={[
                  styles.tick,
                  {
                    left: cx - 1,
                    top: cy - TICK_LEN / 2,
                    height: TICK_LEN,
                    transform: [{ rotate: `${a}deg` }],
                    transformOrigin: 'center center',
                  },
                ]}
              />
            );
          })}

          {labels.map(({ key, sev, a, side }) => {
            const rad = (a * Math.PI) / 180;
            const cx = DIAL_R + LABEL_R * Math.sin(rad);
            const cy = DIAL_R - LABEL_R * Math.cos(rad);
            const active = detectedSev === sev && (side === null || direction === side);
            return (
              <Text
                key={key}
                style={[styles.label, { left: cx - 14, top: cy - 9 }, active && styles.labelActive]}
              >
                {sev}
              </Text>
            );
          })}
        </View>

        {/* ── Fixed: detected value in centre ─────────────────────────── */}
        <View style={styles.centreBox} pointerEvents="none">
          <Text style={styles.centreText}>{centreText}</Text>
        </View>

        {/* ── Rotating needle — whole container spins around dial centre ─ */}
        <View
          style={[styles.needleContainer, { transform: [{ rotate: `${needleAngle}deg` }] }]}
          pointerEvents="none"
        >
          <View style={styles.needle} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingVertical: 8,
  },

  dialOuter: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    position: 'relative',
  },

  dial: {
    position: 'absolute',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  },

  ring: {
    position: 'absolute',
    left: DIAL_R - RING_R,
    top: DIAL_R - RING_R,
    width: RING_R * 2,
    height: RING_R * 2,
    borderRadius: RING_R,
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    backgroundColor: 'rgba(10,10,10,0.6)',
  },

  tick: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#333',
    borderRadius: 1,
  },

  label: {
    position: 'absolute',
    width: 28,
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },

  centreBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreText: {
    color: ACCENT,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Fills dialOuter exactly — rotation around its own centre = dial centre
  needleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  },

  // Downward-pointing triangle (▼) at top-centre of the container
  needle: {
    position: 'absolute',
    top: 0,
    left: DIAL_R - 8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ACCENT,
  },
});
