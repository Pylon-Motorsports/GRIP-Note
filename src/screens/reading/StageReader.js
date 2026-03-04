import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useFocusEffect } from '@react-navigation/native';
import { getPaceNotes, parseNote } from '../../db/paceNotes';
import { getRallyPrefsForSet } from '../../db/rallies';
import { renderNote, formatOdo } from '../../utils/renderNote';

export default function StageReader({ route }) {
  const { setId } = route.params ?? {};
  const [notes, setNotes] = useState([]);
  const [index, setIndex] = useState(0);
  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [odoUnit, setOdoUnit] = useState('metres');
  const [preNoteDecs, setPreNoteDecs] = useState(['!', '!!', '!!!', 'Care']);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const ttsRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => { Speech.stop(); };
    }, [setId])
  );

  // Keep ref in sync so speech callbacks don't close over stale state
  useEffect(() => { ttsRef.current = ttsEnabled; }, [ttsEnabled]);

  async function load() {
    setLoading(true);
    const [prefs, rows] = await Promise.all([
      getRallyPrefsForSet(setId),
      getPaceNotes(setId),
    ]);
    setDisplayOrder(prefs.displayOrder);
    setOdoUnit(prefs.odoUnit);
    setPreNoteDecs(prefs.preNoteDecs);
    setNotes(rows.map(parseNote));
    setIndex(0);
    setLoading(false);
  }

  function speak(note) {
    if (!ttsRef.current) return;
    Speech.stop();
    const text = renderNote(note, displayOrder, preNoteDecs);
    if (text) Speech.speak(text, { language: 'en', rate: 0.85, pitch: 1.0 });
  }

  function advance() {
    setIndex(i => {
      const next = Math.min(i + 1, notes.length - 1);
      if (next !== i) speak(notes[next]);
      return next;
    });
  }

  function retreat() {
    setIndex(i => {
      const prev = Math.max(i - 1, 0);
      if (prev !== i) speak(notes[prev]);
      return prev;
    });
  }

  function toggleTts() {
    setTtsEnabled(on => {
      if (on) {
        Speech.stop();
      } else {
        ttsRef.current = true;
        if (notes[index]) speak(notes[index]);
      }
      return !on;
    });
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No notes in this set.</Text>
      </View>
    );
  }

  // ── Compute visible window ─────────────────────────────────────────────────
  // prev1, CURRENT, next1, next2, next3
  const prev1 = index > 0             ? notes[index - 1] : null;
  const curr  = notes[index];
  const next1 = index + 1 < notes.length ? notes[index + 1] : null;
  const next2 = index + 2 < notes.length ? notes[index + 2] : null;
  const next3 = index + 3 < notes.length ? notes[index + 3] : null;

  const isFirst = index === 0;
  const isLast  = index === notes.length - 1;

  // Night mode colours
  const C = nightMode
    ? { main: '#ff3333', dim1: 'rgba(255,50,50,0.45)', dim2: 'rgba(255,50,50,0.25)', dim3: 'rgba(255,50,50,0.15)' }
    : { main: '#ffffff', dim1: 'rgba(255,255,255,0.45)', dim2: 'rgba(255,255,255,0.25)', dim3: 'rgba(255,255,255,0.15)' };

  const odo      = formatOdo(curr.index_odo, odoUnit);
  const landmark = curr.index_landmark;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Text style={[styles.odoText, { color: C.main }]}>{odo || '—'}</Text>
            {landmark ? <Text style={[styles.landmarkText, { color: C.dim1 }]}>{landmark}</Text> : null}
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity onPress={() => setNightMode(n => !n)} style={styles.iconBtn}>
              <Text style={[styles.iconBtnText, { opacity: nightMode ? 1 : 0.4 }]}>🌙</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTts} style={styles.iconBtn}>
              <Text style={[styles.iconBtnText, { opacity: ttsEnabled ? 1 : 0.4 }]}>
                {ttsEnabled ? '🔊' : '🔇'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Note window ─────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.noteArea} onPress={advance} activeOpacity={1}>

          {/* Previous note */}
          {prev1 && (
            <Text style={[styles.notePrev, { color: C.dim1 }]} numberOfLines={1}>
              {renderNote(prev1, displayOrder, preNoteDecs)}
            </Text>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: C.dim2 }]} />

          {/* Current note */}
          <Text style={[styles.noteCurrent, { color: C.main }]} adjustsFontSizeToFit numberOfLines={2}>
            {renderNote(curr, displayOrder, preNoteDecs)}
          </Text>
          {curr.notes ? (
            <Text style={[styles.noteAnnotation, { color: C.dim1 }]}>{curr.notes}</Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: C.dim2 }]} />

          {/* Upcoming notes */}
          {next1 && (
            <Text style={[styles.noteNext1, { color: C.dim1 }]} numberOfLines={1}>
              {renderNote(next1, displayOrder, preNoteDecs)}
            </Text>
          )}
          {next2 && (
            <Text style={[styles.noteNext2, { color: C.dim2 }]} numberOfLines={1}>
              {renderNote(next2, displayOrder, preNoteDecs)}
            </Text>
          )}
          {next3 && (
            <Text style={[styles.noteNext3, { color: C.dim3 }]} numberOfLines={1}>
              {renderNote(next3, displayOrder, preNoteDecs)}
            </Text>
          )}

        </TouchableOpacity>

        {/* ── Bottom bar ──────────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
            onPress={retreat}
            disabled={isFirst}
          >
            <Text style={[styles.navBtnText, { color: C.main }]}>◄</Text>
          </TouchableOpacity>

          <Text style={[styles.progress, { color: C.dim1 }]}>
            {index + 1} / {notes.length}{isLast ? '  ·  End' : ''}
          </Text>

          <TouchableOpacity
            style={[styles.navBtn, isLast && styles.navBtnDisabled]}
            onPress={advance}
            disabled={isLast}
          >
            <Text style={[styles.navBtnText, { color: C.main }]}>►</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  emptyText: { color: '#555', fontSize: 16, textAlign: 'center', marginTop: 40 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  topLeft: { flex: 1, gap: 2 },
  odoText: { fontSize: 18, fontWeight: '700' },
  landmarkText: { fontSize: 13 },
  topRight: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  iconBtnText: { fontSize: 22 },

  noteArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },

  notePrev: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  divider: {
    height: 1,
    marginVertical: 4,
  },

  noteCurrent: {
    fontSize: 58,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  noteAnnotation: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
  },

  noteNext1: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  noteNext2: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  noteNext3: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 20, paddingTop: 12,
  },
  navBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.15 },
  navBtnText: { fontSize: 20 },
  progress: { fontSize: 16, fontWeight: '600' },
});
