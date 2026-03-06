/**
 * @module DriveScreen
 * Drive mode — writes pace notes using phone tilt (compass dial) and voice input.
 * Tilt auto-detects direction + severity; voice fills remaining fields.
 * Route params: { setId, stageId?, rally? }
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  NativeModules,
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
import { parseVoiceNote, mergeVoiceResult } from '../../utils/parseVoiceNote';
import { useDeviceTilt } from '../../hooks/useDeviceTilt';
import GpsOdoBar from '../../components/GpsOdoBar';
import CompassDial from '../../components/CompassDial';

const ACCENT = '#00bcd4';

// Check once at module load — no native module = Expo Go or missing dev build
const SPEECH_AVAILABLE = !!NativeModules.ExpoSpeechRecognition;

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

// ── VoiceSection — only rendered when SPEECH_AVAILABLE ───────────────────────
// Keeps useSpeechRecognitionEvent hooks isolated so they're never called
// in environments where the native module doesn't exist.

function VoiceSection({ allChips, onResult, onTranscript, onListening, onCleanup }) {
  const {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
  } = require('expo-speech-recognition');

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    onListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    onListening(false);
  });
  useSpeechRecognitionEvent('error', () => {
    setListening(false);
    onListening(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    setTranscript(text);
    onTranscript(text);
    if (event.isFinal && text) {
      onResult(parseVoiceNote(text, allChips));
    }
  });

  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort();
      onCleanup();
    };
  }, []);

  async function startListening() {
    setTranscript('');
    onTranscript('');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  }

  function stopListening() {
    ExpoSpeechRecognitionModule.stop();
  }

  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity
        style={[styles.micBtn, listening && styles.micBtnActive]}
        onPress={listening ? stopListening : startListening}
      >
        <Text style={styles.micIcon}>{listening ? '■' : '🎤'}</Text>
        <Text style={styles.micLabel}>{listening ? 'Listening…' : 'Speak'}</Text>
      </TouchableOpacity>
      {transcript ? (
        <Text style={styles.transcript} numberOfLines={1}>
          {transcript}
        </Text>
      ) : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DriveScreen({ navigation, route }) {
  const { setId } = route.params;

  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [allChips, setAllChips] = useState({});
  const [angleMap, setAngleMap] = useState({});
  const [notes, setNotes] = useState([]);
  const [current, setCurrent] = useState({ ...EMPTY_NOTE });

  const [tiltLocked, setTiltLocked] = useState(false);
  const [voiceNoteReady, setVoiceNoteReady] = useState(false);
  const [deadZone, setDeadZone] = useState(3);
  const { angleDeg, direction, ready: tiltReady } = useDeviceTilt(deadZone);
  const historyRef = useRef(null);

  // Auto-fill direction + severity from tilt when not locked by voice input
  useEffect(() => {
    if (tiltLocked) return;
    const detSev = detectSeverity(angleDeg, angleMap);
    setCurrent((prev) => ({
      ...prev,
      direction: direction ?? prev.direction,
      severity: detSev ?? prev.severity,
    }));
  }, [angleDeg, direction, angleMap, tiltLocked]);

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

    // Build angle map directly from this rally's severity chips (angle stored per-chip).
    // Chips with angle == null are not shown on the dial.
    const map = {};
    for (const chip of chips.severity ?? []) {
      if (chip.angle != null) map[chip.value] = chip.angle;
    }
    if (Object.keys(map).length > 0) setAngleMap(map);
    setDeadZone(await getStraightAngle(rallyId));

    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
    setCurrent({ ...EMPTY_NOTE });
    setTiltLocked(false);
    setVoiceNoteReady(false);
  }

  function handleVoiceResult(parsed) {
    if (parsed.direction != null || parsed.severity != null) setTiltLocked(true);
    setCurrent((prev) => mergeVoiceResult(prev, parsed));
    setVoiceNoteReady(true);
  }

  async function saveNote() {
    if (!current.direction && !current.severity && !current.notes) return;
    const seq = await getNextSeq(setId);
    await upsertPaceNote({
      set_id: setId,
      seq,
      ...current,
      index_odo: null,
      recce_at: new Date().toISOString(),
    });
    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
    setCurrent({ ...EMPTY_NOTE });
    setTiltLocked(false);
    setVoiceNoteReady(false);
    setTimeout(() => historyRef.current?.scrollToEnd({ animated: true }), 50);
  }

  function clearNote() {
    setCurrent({ ...EMPTY_NOTE });
    setTiltLocked(false);
    setVoiceNoteReady(false);
  }

  function deleteNote(note) {
    Alert.alert('Delete note?', renderNote(note, displayOrder), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePaceNote(setId, note.seq);
          const rows = await getPaceNotes(setId);
          setNotes(rows.map(parseNote));
        },
      },
    ]);
  }

  const preview = renderNote(current, displayOrder);
  const detectedSev = detectSeverity(angleDeg, angleMap);

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
        <VoiceSection
          allChips={allChips}
          onResult={handleVoiceResult}
          onTranscript={() => {}}
          onListening={() => {}}
          onCleanup={() => {}}
        />
      ) : (
        <View style={styles.voiceRow}>
          <View style={styles.speechUnavail}>
            <Text style={styles.speechUnavailText}>Voice needs a dev build</Text>
            <Text style={styles.speechUnavailSub}>(not available in Expo Go)</Text>
          </View>
        </View>
      )}

      {voiceNoteReady && preview ? (
        <View style={styles.previewRow}>
          <Text style={styles.previewText} numberOfLines={2}>
            {preview}
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.clearBtn} onPress={clearNote}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !voiceNoteReady && styles.confirmBtnDisabled]}
          onPress={saveNote}
          disabled={!voiceNoteReady}
        >
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={historyRef}
        data={notes}
        keyExtractor={(n) => String(n.seq)}
        style={styles.history}
        ListEmptyComponent={<Text style={styles.historyEmpty}>No notes yet</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.historyItem} onLongPress={() => deleteNote(item)}>
            <Text style={styles.historyOdo}>
              {item.index_odo != null ? `${item.index_odo} m` : ''}
            </Text>
            <Text style={styles.historyNote} numberOfLines={1}>
              {renderNote(item, displayOrder)}
            </Text>
          </TouchableOpacity>
        )}
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

  previewRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    minHeight: 54,
  },
  previewText: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },

  voiceRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  micBtn: {
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
  transcript: { color: '#555', fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  speechUnavail: { alignItems: 'center', paddingVertical: 10 },
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
  clearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  clearBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

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
  historyOdo: { color: '#555', fontSize: 12, width: 56 },
  historyNote: { color: '#ccc', fontSize: 14, flex: 1 },
});
