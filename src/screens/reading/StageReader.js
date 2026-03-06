/**
 * @module StageReader
 * Note reading screen with multi-note context window (4 prev + current + 4 next),
 * TTS speech output, night mode, and GPS odometer bar.
 * Route params: { setId } — UUID of the note set to read.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useFocusEffect } from '@react-navigation/native';
import { getPaceNotes, parseNote } from '../../db/paceNotes';
import { getRallyPrefsForSet, getRallyIdForSet } from '../../db/rallies';
import { getAudibleMap } from '../../db/rallyChips';
import { renderNote, formatOdo } from '../../utils/renderNote';
import GpsOdoBar from '../../components/GpsOdoBar';

const START_NOTE = { _start: true, decorators: [], joiner_decorators: [] };

export default function StageReader({ route }) {
  const { setId } = route.params ?? {};
  const [notes, setNotes] = useState([]);
  const [index, setIndex] = useState(0);
  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [odoUnit, setOdoUnit] = useState('metres');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audibleMap, setAudibleMap] = useState({});
  const ttsRef = useRef(false);

  // All displayable notes: START + real notes
  const allNotes = useMemo(() => [START_NOTE, ...notes], [notes]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        Speech.stop();
      };
    }, [setId]),
  );

  useEffect(() => {
    ttsRef.current = ttsEnabled;
  }, [ttsEnabled]);

  async function load() {
    setLoading(true);
    const [prefs, rallyId, rows] = await Promise.all([
      getRallyPrefsForSet(setId),
      getRallyIdForSet(setId),
      getPaceNotes(setId),
    ]);
    setDisplayOrder(prefs.displayOrder);
    setOdoUnit(prefs.odoUnit);
    setNotes(rows.map(parseNote));
    setIndex(0);
    if (rallyId) setAudibleMap(await getAudibleMap(rallyId));
    setLoading(false);
  }

  function speak(note) {
    if (!ttsRef.current) return;
    Speech.stop();
    if (note._start) {
      Speech.speak('Go', { language: 'en', rate: 0.85, pitch: 1.0 });
      return;
    }
    const text = renderNote(note, displayOrder, audibleMap);
    if (text) Speech.speak(text, { language: 'en', rate: 0.85, pitch: 1.0 });
  }

  function advance() {
    const next = Math.min(index + 1, allNotes.length - 1);
    if (next !== index) {
      speak(allNotes[next]);
      setIndex(next);
    }
  }

  function retreat() {
    const prev = Math.max(index - 1, 0);
    if (prev !== index) {
      speak(allNotes[prev]);
      setIndex(prev);
    }
  }

  function toggleTts() {
    setTtsEnabled((on) => {
      if (on) {
        Speech.stop();
      } else {
        ttsRef.current = true;
        speak(allNotes[index]);
      }
      return !on;
    });
  }

  // Odo + landmark parts for a real note
  function odoParts(note) {
    if (note._start) return [];
    return [formatOdo(note.index_odo, odoUnit), note.index_landmark].filter(Boolean);
  }

  function currText(note) {
    if (note._start) return 'START';
    return renderNote(note, displayOrder);
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

  const curr = allNotes[index];
  const isFirst = index === 0;
  const isLast = index === allNotes.length - 1;

  const at = (offset) => {
    const i = index + offset;
    return i >= 0 && i < allNotes.length ? allNotes[i] : null;
  };

  const prev4 = at(-4);
  const prev3 = at(-3);
  const prev2 = at(-2);
  const prev1 = at(-1);
  const next1 = at(1);
  const next2 = at(2);
  const next3 = at(3);
  const next4 = at(4);

  const main = nightMode ? '#ff3333' : '#ffffff';
  const dim = nightMode ? 'rgba(255,50,50,0.5)' : 'rgba(255,255,255,0.45)';

  const currOdoParts = odoParts(curr);

  // Progress: "Start" at index 0, "N / total" for real notes
  const progressText = curr._start
    ? `Start  ·  ${notes.length} notes`
    : `${index} / ${notes.length}${isLast ? '  ·  End' : ''}`;

  function NoteRow({ note, textStyle }) {
    const parts = odoParts(note);
    return (
      <View style={styles.noteRowWrap}>
        {parts.length > 0 && (
          <Text style={[styles.noteRowOdo, { color: dim }]} numberOfLines={1}>
            {parts.join('  ')}
          </Text>
        )}
        <Text style={[textStyle, { color: dim }]} numberOfLines={1}>
          {currText(note)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.safe}>
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <Text style={[styles.progress, { color: dim }]}>{progressText}</Text>
          <View style={styles.topRight}>
            <TouchableOpacity onPress={() => setNightMode((n) => !n)} style={styles.iconBtn}>
              <Text style={[styles.iconBtnText, { opacity: nightMode ? 1 : 0.4 }]}>🌙</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTts} style={styles.iconBtn}>
              <Text style={[styles.iconBtnText, { opacity: ttsEnabled ? 1 : 0.4 }]}>
                {ttsEnabled ? '🔊' : '🔇'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── GPS Odometers ───────────────────────────────────────────── */}
        <GpsOdoBar />

        {/* ── Note window ─────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.noteArea} onPress={advance} activeOpacity={1}>
          {prev4 && <NoteRow note={prev4} textStyle={styles.notePrev4} />}
          {prev3 && <NoteRow note={prev3} textStyle={styles.notePrev3} />}
          {prev2 && <NoteRow note={prev2} textStyle={styles.notePrev2} />}
          {prev1 && <NoteRow note={prev1} textStyle={styles.notePrev1} />}

          <View style={[styles.divider, { backgroundColor: dim }]} />

          {currOdoParts.length > 0 && (
            <Text style={[styles.currOdo, { color: dim }]}>{currOdoParts.join('  ')}</Text>
          )}
          <Text
            style={[styles.noteCurrent, { color: main }]}
            adjustsFontSizeToFit
            numberOfLines={2}
          >
            {currText(curr)}
          </Text>

          <View style={[styles.divider, { backgroundColor: dim }]} />

          {next1 && <NoteRow note={next1} textStyle={styles.noteNext1} />}
          {next2 && <NoteRow note={next2} textStyle={styles.noteNext2} />}
          {next3 && <NoteRow note={next3} textStyle={styles.noteNext3} />}
          {next4 && <NoteRow note={next4} textStyle={styles.noteNext4} />}
        </TouchableOpacity>

        {/* ── Bottom bar ──────────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
            onPress={retreat}
            disabled={isFirst}
          >
            <Text style={[styles.navBtnText, { color: main }]}>◄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, isLast && styles.navBtnDisabled]}
            onPress={advance}
            disabled={isLast}
          >
            <Text style={[styles.navBtnText, { color: main }]}>►</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progress: { fontSize: 14, fontWeight: '600' },
  topRight: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  iconBtnText: { fontSize: 22 },

  noteArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },

  noteRowWrap: { gap: 1 },
  noteRowOdo: { fontSize: 11, textAlign: 'center', letterSpacing: 0.3 },

  notePrev4: { fontSize: 12, textAlign: 'center' },
  notePrev3: { fontSize: 15, textAlign: 'center' },
  notePrev2: { fontSize: 19, textAlign: 'center' },
  notePrev1: { fontSize: 24, fontWeight: '600', textAlign: 'center' },

  divider: { height: 1, marginVertical: 2 },

  currOdo: { fontSize: 14, textAlign: 'center', letterSpacing: 0.5 },
  noteCurrent: {
    fontSize: 58,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },

  noteNext1: { fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  noteNext2: { fontSize: 24, fontWeight: '600', textAlign: 'center' },
  noteNext3: { fontSize: 19, textAlign: 'center' },
  noteNext4: { fontSize: 15, textAlign: 'center' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 20,
    paddingTop: 12,
  },
  navBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.15 },
  navBtnText: { fontSize: 24 },
});
