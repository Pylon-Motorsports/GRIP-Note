import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useFocusEffect } from '@react-navigation/native';
import { getPaceNotes, parseNote } from '../../db/paceNotes';
import { getSetting } from '../../db/database';
import { renderNote, formatOdo } from '../../utils/renderNote';

const BG = require('../../../assets/bg-winter.png');

export default function StageReader({ route, navigation }) {
  const { setId } = route.params ?? {};
  const [notes, setNotes] = useState([]);
  const [index, setIndex] = useState(0);
  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [odoUnit, setOdoUnit] = useState('metres');
  const [ttsEnabled, setTtsEnabled] = useState(false);
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
    const [order, unit, rows] = await Promise.all([
      getSetting('display_order'),
      getSetting('odo_unit'),
      getPaceNotes(setId),
    ]);
    if (order) setDisplayOrder(order);
    if (unit)  setOdoUnit(unit);
    setNotes(rows.map(parseNote));
    setIndex(0);
    setLoading(false);
  }

  // Speak a note if TTS is on
  function speak(note) {
    if (!ttsRef.current) return;
    Speech.stop();
    const text = renderNote(note, displayOrder);
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
        // Speak current note immediately on enable
        if (notes[index]) {
          ttsRef.current = true;
          speak(notes[index]);
        }
      }
      return !on;
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>No notes in this set.</Text>
      </View>
    );
  }

  const note = notes[index];
  const noteText = renderNote(note, displayOrder);
  const odo = formatOdo(note.index_odo, odoUnit);
  const landmark = note.index_landmark;
  const isFirst = index === 0;
  const isLast = index === notes.length - 1;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        {/* ── Top bar: odo / landmark ───────────────────────────── */}
        <View style={styles.topBar}>
          <Text style={styles.odoText}>{odo || '—'}</Text>
          {landmark ? <Text style={styles.landmarkText}>{landmark}</Text> : null}
          <TouchableOpacity onPress={toggleTts} style={styles.ttsBtn}>
            <Text style={[styles.ttsBtnText, ttsEnabled && styles.ttsBtnActive]}>
              {ttsEnabled ? '🔊' : '🔇'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Main tap area ─────────────────────────────────────── */}
        <TouchableOpacity style={styles.noteArea} onPress={advance} activeOpacity={1}>
          <Text style={styles.noteText} adjustsFontSizeToFit numberOfLines={3}>
            {noteText || '—'}
          </Text>
          {note.notes ? (
            <Text style={styles.noteAnnotation}>{note.notes}</Text>
          ) : null}
        </TouchableOpacity>

        {/* ── Bottom controls ───────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
            onPress={retreat}
            disabled={isFirst}
          >
            <Text style={styles.navBtnText}>◄</Text>
          </TouchableOpacity>

          <Text style={styles.progress}>
            {index + 1} / {notes.length}
            {isLast ? '  ·  End' : ''}
          </Text>

          <TouchableOpacity
            style={[styles.navBtn, isLast && styles.navBtnDisabled]}
            onPress={advance}
            disabled={isLast}
          >
            <Text style={styles.navBtnText}>►</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  loadingContainer: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#555', fontSize: 16 },

  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  odoText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 80,
  },
  landmarkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    flex: 1,
  },
  ttsBtn: { padding: 8 },
  ttsBtnText: { fontSize: 22, opacity: 0.4 },
  ttsBtnActive: { opacity: 1 },

  noteArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noteText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  noteAnnotation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
  },
  navBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.2 },
  navBtnText: { color: '#fff', fontSize: 20 },
  progress: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
});
