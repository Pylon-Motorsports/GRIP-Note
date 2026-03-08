/**
 * @module DriveScreen
 * Drive mode — writes pace notes using voice input with compass dial for reference.
 * Two voice modes: structured (parses chips, accumulates across presses, saves on
 * new direction/caution) and freeform (raw transcript → notes field).
 * Route params: { setId, stageId?, rally? }
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getRallyPrefsForSet, getRallyIdForSet, getStraightAngle } from '../../db/rallies';
import {
  upsertPaceNote,
  getPaceNotes,
  getNextSeq,
  parseNote,
  deletePaceNote,
} from '../../db/paceNotes';
import { getAllChips } from '../../db/rallyChips';
import { renderNote } from '../../utils/renderNote';
import { parseMultiNote, mergeVoiceResult } from '../../utils/parseVoiceNote';
import { useDeviceTilt } from '../../hooks/useDeviceTilt';
import { useGpsOdo } from '../../hooks/useGpsOdo';
import GpsOdoBar from '../../components/GpsOdoBar';
import CompassDial from '../../components/CompassDial';

const ACCENT = '#00bcd4';

// Joiners that immediately save the current note (the following note only needs severity).
const SAVE_JOINERS = /^[><]$|opens|tightens/i;

// Check once at module load — try to import the native module
let SPEECH_AVAILABLE = false;
try {
  const { ExpoSpeechRecognitionModule: mod } = require('expo-speech-recognition');
  SPEECH_AVAILABLE = !!mod;
} catch (_e) {
  // Native module not linked — Expo Go or missing dev build
}

const EMPTY_NOTE = {
  direction: null,
  severity: null,
  duration: null,
  decorators: [],
  joiner: null,
  joiner_decorators: [],
  notes: '',
  joiner_notes: '',
  index_odo: null,
  index_landmark: null,
  index_sequence: null,
};

function detectSeverity(angleDeg, angleMap) {
  let closest = null;
  let minDiff = Infinity;
  for (const [sev, angle] of Object.entries(angleMap)) {
    const diff = Math.abs(angleDeg - angle);
    if (diff < minDiff) {
      minDiff = diff;
      closest = sev;
    }
  }
  return closest;
}

// ── VoiceEngine — headless, only rendered when SPEECH_AVAILABLE ──────────────
// Keeps useSpeechRecognitionEvent hooks isolated. Exposes start/stop via controlRef.

function VoiceEngine({ onResult, onListening, controlRef }) {
  const {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
  } = require('expo-speech-recognition');

  useSpeechRecognitionEvent('start', () => onListening(true));
  useSpeechRecognitionEvent('end', () => onListening(false));
  useSpeechRecognitionEvent('error', () => onListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal && text) {
      onResult(text);
    }
  });

  useEffect(() => {
    controlRef.current = {
      start: async () => {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Microphone Permission', 'Voice input requires microphone access.');
          return;
        }
        ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
      },
      stop: () => ExpoSpeechRecognitionModule.stop(),
    };
    return () => {
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  return null;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DriveScreen({ navigation, route }) {
  const { setId } = route.params;

  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [allChips, setAllChips] = useState({});
  const [angleMap, setAngleMap] = useState({});
  const [notes, setNotes] = useState([]);

  const [autoOdo, setAutoOdo] = useState(true);
  const [listening, setListening] = useState(false);
  const [deadZone, setDeadZone] = useState(3);
  const { angleDeg, direction, ready: tiltReady } = useDeviceTilt(deadZone);
  const { lapM } = useGpsOdo();
  const historyRef = useRef(null);
  const voiceRef = useRef(null);
  const voiceModeRef = useRef('structured'); // 'structured' | 'freeform'
  const [current, setCurrent] = useState({ ...EMPTY_NOTE });

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [setId]),
  );

  async function loadAll() {
    const prefs = await getRallyPrefsForSet(setId);
    setDisplayOrder(prefs.displayOrder);
    const rallyId = await getRallyIdForSet(setId);
    const chips = await getAllChips(rallyId);
    setAllChips(chips);

    const map = {};
    for (const chip of chips.severity ?? []) {
      if (chip.angle != null) map[chip.value] = chip.angle;
    }
    if (Object.keys(map).length > 0) setAngleMap(map);
    setDeadZone(await getStraightAngle(rallyId));

    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
    setCurrent({ ...EMPTY_NOTE });
  }

  // ── Save helper ──────────────────────────────────────────────────────────────

  async function saveNote(note) {
    if (!note.direction && !note.severity && !note.notes) return;
    const seq = await getNextSeq(setId);
    await upsertPaceNote({
      set_id: setId,
      seq,
      ...note,
      index_odo: autoOdo ? Math.round(lapM) : null,
      recce_at: new Date().toISOString(),
    });
  }

  async function refreshAndScroll() {
    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
    setTimeout(() => historyRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
  }

  // ── Voice result handling ────────────────────────────────────────────────────

  function handleVoiceResult(transcript) {
    if (voiceModeRef.current === 'freeform') {
      handleFreeformResult(transcript);
    } else {
      handleStructuredResult(transcript);
    }
  }

  async function handleStructuredResult(transcript) {
    const parsed = parseMultiNote(transcript, allChips);
    if (parsed.length === 0) return;

    // Build caution value set for detecting caution triggers
    const cautionValues = new Set(
      (allChips.caution_decorator ?? []).map((c) => c.value),
    );

    let cur = { ...current };

    for (const note of parsed) {
      const startsNew =
        !!note.direction || note.decorators?.some((d) => cautionValues.has(d));

      if (startsNew && (cur.direction || cur.severity || cur.decorators?.length)) {
        await saveNote(cur);
        cur = { ...EMPTY_NOTE };
      }

      cur = mergeVoiceResult(cur, note);

      // Joiners like > / < (opens/tightens) immediately complete the note.
      // The following note only needs a severity (direction exempt).
      if (cur.joiner && SAVE_JOINERS.test(cur.joiner)) {
        await saveNote(cur);
        cur = { ...EMPTY_NOTE };
      }
    }

    setCurrent(cur);
    await refreshAndScroll();
  }

  async function handleFreeformResult(transcript) {
    if (!transcript.trim()) return;
    await saveNote({ ...EMPTY_NOTE, notes: transcript.trim() });
    await refreshAndScroll();
  }

  // ── Voice button handlers ────────────────────────────────────────────────────

  function startStructured() {
    voiceModeRef.current = 'structured';
    voiceRef.current?.start();
  }

  function startFreeform() {
    voiceModeRef.current = 'freeform';
    voiceRef.current?.start();
  }

  function stopVoice() {
    voiceRef.current?.stop();
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function quickDelete(note) {
    await deletePaceNote(setId, note.seq);
    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
  }

  const cautionSet = useMemo(
    () => new Set((allChips.caution_decorator ?? []).map((c) => c.value)),
    [allChips],
  );
  const detectedSev = detectSeverity(angleDeg, angleMap);
  const currentPreview = renderNote(current, displayOrder, null, cautionSet);
  const hasCurrentContent = !!(current.direction || current.severity || current.notes || current.decorators?.length);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drive</Text>
        <Text style={styles.tiltStatus}>{tiltReady ? '' : 'No sensor'}</Text>
      </View>

      <GpsOdoBar />

      <CompassDial
        angleDeg={angleDeg}
        direction={direction}
        angleMap={angleMap}
        detectedSev={detectedSev}
      />

      {/* Voice input — only mounted when native module is present */}
      {SPEECH_AVAILABLE ? (
        <>
          <VoiceEngine
            controlRef={voiceRef}
            onResult={handleVoiceResult}
            onListening={setListening}
          />
          <View style={styles.voiceRow}>
            <TouchableOpacity
              style={[styles.freeformBtn, listening && voiceModeRef.current === 'freeform' && styles.micBtnActive]}
              onPress={listening ? stopVoice : startFreeform}
            >
              <Text style={styles.micIcon}>📝</Text>
              <Text style={styles.micLabel}>Free</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.micBtn, listening && voiceModeRef.current === 'structured' && styles.micBtnActive]}
              onPress={listening ? stopVoice : startStructured}
            >
              <Text style={styles.micIcon}>{listening ? '■' : '🎤'}</Text>
              <Text style={styles.micLabel}>{listening ? 'Listening…' : 'Speak'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.voiceRow}>
          <View style={styles.speechUnavail}>
            <Text style={styles.speechUnavailText}>Voice needs a dev build</Text>
            <Text style={styles.speechUnavailSub}>(not available in Expo Go)</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.autoOdoBtn, autoOdo && styles.autoOdoBtnActive]}
          onPress={() => setAutoOdo((v) => !v)}
        >
          <Text style={[styles.autoOdoText, autoOdo && styles.autoOdoTextActive]}>
            ODO {autoOdo ? '✓' : '✗'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* In-progress note */}
      {hasCurrentContent ? (
        <View style={[styles.historyItem, styles.historyItemCurrent]}>
          <Text style={[styles.historyOdo, styles.historyOdoLatest]} />
          <Text style={[styles.historyNote, styles.historyNoteCurrent]} numberOfLines={2}>
            {currentPreview || '…'}
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setCurrent({ ...EMPTY_NOTE })}>
            <Text style={styles.deleteIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        ref={historyRef}
        data={[...notes].reverse()}
        keyExtractor={(n) => String(n.seq)}
        style={styles.history}
        ListEmptyComponent={
          !hasCurrentContent ? <Text style={styles.historyEmpty}>No notes yet</Text> : null
        }
        renderItem={({ item, index }) => {
          const isLatest = index === 0;
          return (
            <View style={[styles.historyItem, isLatest && styles.historyItemLatest]}>
              <Text style={[styles.historyOdo, isLatest && styles.historyOdoLatest]}>
                {item.index_odo != null ? `${item.index_odo} m` : ''}
              </Text>
              <Text
                style={[styles.historyNote, isLatest && styles.historyNoteLatest]}
                numberOfLines={isLatest ? 2 : 1}
              >
                {renderNote(item, displayOrder, null, cautionSet)}
              </Text>
              {isLatest ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => quickDelete(item)}>
                  <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 10,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  back: { color: ACCENT, fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tiltStatus: { color: '#555', fontSize: 11 },

  voiceRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  freeformBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
  },
  micBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
  },
  micBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(0,188,212,0.12)' },
  micIcon: { fontSize: 20 },
  micLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  speechUnavail: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  speechUnavailText: { color: '#444', fontSize: 14 },
  speechUnavailSub: { color: '#333', fontSize: 11, marginTop: 2 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  autoOdoBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  autoOdoBtnActive: { borderColor: ACCENT },
  autoOdoText: { color: '#555', fontSize: 12, fontWeight: '600' },
  autoOdoTextActive: { color: ACCENT },
  history: { flex: 1 },
  historyEmpty: { color: '#333', textAlign: 'center', marginTop: 24, fontSize: 13 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  historyItemCurrent: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#ff9800',
  },
  historyNoteCurrent: { color: '#ff9800', fontSize: 20, fontWeight: '700' },
  historyItemLatest: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  historyOdo: { color: '#555', fontSize: 12, width: 56 },
  historyOdoLatest: { fontSize: 14, color: '#888' },
  historyNote: { color: '#ccc', fontSize: 14, flex: 1 },
  historyNoteLatest: { color: '#fff', fontSize: 20, fontWeight: '700' },
  deleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  deleteIcon: { color: '#666', fontSize: 16 },
});
