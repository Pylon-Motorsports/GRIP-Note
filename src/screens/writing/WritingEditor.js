/**
 * @module WritingEditor
 * Full-featured Recce note editor with chip-based input rows, GPS odo bar,
 * note list with inline editing, and insert-before/after support.
 * Route params: { setId, mode? } — mode='recce' shows a recce banner.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPaceNotes,
  upsertPaceNote,
  deletePaceNote,
  shiftSeqsUp,
  getNextSeq,
  parseNote,
} from '../../db/paceNotes';
import { getRallyPrefsForSet, getRallyIdForSet } from '../../db/rallies';
import { getChips, addChip } from '../../db/rallyChips';
import { renderNote, formatOdo } from '../../utils/renderNote';
import GpsOdoBar from '../../components/GpsOdoBar';

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

const CATEGORY_COLORS = {
  caution_decorator: '#ffb300',
  direction: '#e63946',
  severity: '#ff9800',
  duration: '#9c27b0',
  decorator: '#2196f3',
  joiner: '#4caf50',
  joiner_decorator: '#009688',
};

export default function WritingEditor({ route, navigation }) {
  const { setId, mode } = route.params ?? {};
  const isRecce = mode === 'recce';

  const [rallyId, setRallyId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [current, setCurrent] = useState({ ...EMPTY_NOTE });
  const [editingSeq, setEditingSeq] = useState(null);
  const [insertAt, setInsertAt] = useState(null);
  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [odoUnit, setOdoUnit] = useState('metres');
  const [odoInput, setOdoInput] = useState('');
  const listRef = useRef(null);
  const prevNoteCount = useRef(0);
  const dirScrollRef = useRef(null);
  const cautionScrollRef = useRef(null);
  const sevScrollRef = useRef(null);
  const durScrollRef = useRef(null);
  const decScrollRef = useRef(null);
  const joinScrollRef = useRef(null);
  const jdScrollRef = useRef(null);
  const panelScrollRef = useRef(null);

  function resetScrolls() {
    [
      cautionScrollRef,
      dirScrollRef,
      sevScrollRef,
      durScrollRef,
      decScrollRef,
      joinScrollRef,
      jdScrollRef,
    ].forEach((r) => {
      r.current?.scrollTo({ x: 0, animated: false });
    });
    panelScrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  // Chip lists loaded from DB
  const [cautionChips, setCautionChips] = useState([]);
  const [dirChips, setDirChips] = useState([]);
  const [sevChips, setSevChips] = useState([]);
  const [durChips, setDurChips] = useState([]);
  const [decChips, setDecChips] = useState([]);
  const [joinChips, setJoinChips] = useState([]);
  const [joinDecChips, setJoinDecChips] = useState([]);

  // Add chip modal
  const [addModal, setAddModal] = useState(null); // category key or null
  const [addValue, setAddValue] = useState('');
  const [addAudible, setAddAudible] = useState('');

  useEffect(() => {
    if (isRecce) navigation.setOptions({ title: 'Recce Edit' });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [setId]),
  );

  async function loadAll() {
    const [prefs, rid, rows] = await Promise.all([
      getRallyPrefsForSet(setId),
      getRallyIdForSet(setId),
      getPaceNotes(setId),
    ]);
    setDisplayOrder(prefs.displayOrder);
    setOdoUnit(prefs.odoUnit);
    setRallyId(rid);
    setNotes(rows.map(parseNote));
    if (rid) await loadChips(rid);
  }

  async function loadChips(rid) {
    const id = rid ?? rallyId;
    if (!id) return;
    const [cau, d, s, dur, dec, j, jd] = await Promise.all([
      getChips(id, 'caution_decorator'),
      getChips(id, 'direction'),
      getChips(id, 'severity'),
      getChips(id, 'duration'),
      getChips(id, 'decorator'),
      getChips(id, 'joiner'),
      getChips(id, 'joiner_decorator'),
    ]);
    setCautionChips(cau);
    setDirChips(d);
    // Sort severity: numeric values ascending first, then non-numeric in DB order
    const numeric = s.filter((c) => /^\d+$/.test(c.value));
    const nonNumeric = s.filter((c) => !/^\d+$/.test(c.value));
    numeric.sort((a, b) => Number(a.value) - Number(b.value));
    setSevChips([...numeric, ...nonNumeric]);
    setDurChips(dur);
    setDecChips(dec);
    setJoinChips(j);
    setJoinDecChips(jd);
  }

  async function loadNotes() {
    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  function setField(field, value) {
    setCurrent((prev) => ({ ...prev, [field]: prev[field] === value ? null : value }));
  }

  function toggleDecorator(dec) {
    setCurrent((prev) => {
      const has = prev.decorators.includes(dec);
      return {
        ...prev,
        decorators: has ? prev.decorators.filter((d) => d !== dec) : [...prev.decorators, dec],
      };
    });
  }

  function toggleJoinerDecorator(dec) {
    setCurrent((prev) => {
      const has = prev.joiner_decorators.includes(dec);
      return {
        ...prev,
        joiner_decorators: has
          ? prev.joiner_decorators.filter((d) => d !== dec)
          : [...prev.joiner_decorators, dec],
      };
    });
  }

  // ── Add chip to DB ─────────────────────────────────────────────────────────
  function openAddModal(category) {
    setAddValue('');
    setAddAudible('');
    setAddModal(category);
  }

  async function confirmAddChip() {
    const val = addValue.trim();
    if (!val || !rallyId) {
      setAddModal(null);
      return;
    }
    const cat = addModal;
    await addChip(rallyId, cat, val, addAudible.trim() || null);
    setAddModal(null);
    await loadChips();
    // Auto-select the newly added chip
    if (cat === 'caution_decorator') toggleDecorator(val);
    else if (cat === 'decorator') toggleDecorator(val);
    else if (cat === 'joiner_decorator') toggleJoinerDecorator(val);
    else {
      const f = {
        direction: 'direction',
        severity: 'severity',
        duration: 'duration',
        joiner: 'joiner',
      }[cat];
      if (f) setField(f, val);
    }
  }

  // ── Save / clear ───────────────────────────────────────────────────────────
  async function saveNote() {
    const odoMetres = odoInput ? parseInt(odoInput, 10) : null;
    let seq;
    if (editingSeq != null) {
      seq = editingSeq;
    } else if (insertAt != null) {
      await shiftSeqsUp(setId, insertAt);
      seq = insertAt;
    } else {
      seq = await getNextSeq(setId);
    }
    await upsertPaceNote({
      set_id: setId,
      seq,
      ...current,
      index_odo: odoMetres,
      recce_at: new Date().toISOString(),
    });
    clearCurrent();
    resetScrolls();
    loadNotes();
  }

  function clearCurrent() {
    setCurrent({ ...EMPTY_NOTE });
    setEditingSeq(null);
    setInsertAt(null);
    setOdoInput('');
  }

  // ── Edit / delete / insert ─────────────────────────────────────────────────
  function startEdit(note) {
    setCurrent({
      direction: note.direction,
      severity: note.severity,
      duration: note.duration,
      decorators: [...note.decorators],
      joiner: note.joiner,
      joiner_decorators: [...(note.joiner_decorators ?? [])],
      notes: note.notes ?? '',
      joiner_notes: note.joiner_notes ?? '',
      index_landmark: note.index_landmark,
      index_sequence: note.index_sequence,
    });
    setOdoInput(note.index_odo != null ? String(note.index_odo) : '');
    setInsertAt(null);
    setEditingSeq(note.seq);
  }

  function noteActions(note) {
    Alert.alert(`Note #${note.seq}`, renderNote(note, displayOrder, null, cautionSet) || '—', [
      {
        text: 'Insert Before',
        onPress: () => {
          clearCurrent();
          setInsertAt(note.seq);
        },
      },
      {
        text: 'Insert After',
        onPress: () => {
          clearCurrent();
          setInsertAt(note.seq + 1);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete Note', 'Remove this pacenote?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deletePaceNote(setId, note.seq);
                loadNotes();
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const cautionSet = useMemo(
    () => new Set(cautionChips.map((c) => c.value)),
    [cautionChips],
  );
  const preview = renderNote(current, displayOrder, null, cautionSet) || '—';

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isRecce && (
          <View style={styles.recceBanner}>
            <Text style={styles.recceBannerText}>Recce Edit — new copy of original</Text>
          </View>
        )}

        {/* ── GPS Odometers ───────────────────────────────────────────── */}
        <GpsOdoBar />

        {/* ── Note history ────────────────────────────────────────────── */}
        <View style={styles.historyBox}>
          <FlatList
            ref={listRef}
            data={notes}
            keyExtractor={(n) => String(n.seq)}
            style={styles.historyList}
            onContentSizeChange={() => {
              if (notes.length > prevNoteCount.current) {
                listRef.current?.scrollToEnd({ animated: false });
              }
              prevNoteCount.current = notes.length;
            }}
            ListEmptyComponent={
              <Text style={styles.historyEmpty}>No notes yet — start below.</Text>
            }
            ListFooterComponent={
              <TouchableOpacity style={styles.newNoteFooter} onPress={clearCurrent}>
                <Text style={styles.newNoteFooterText}>+ New Note</Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.historyItem, editingSeq === item.seq && styles.historyItemActive]}
                onPress={() => startEdit(item)}
                onLongPress={() => noteActions(item)}
              >
                <Text style={styles.historyOdo}>
                  {formatOdo(item.index_odo, odoUnit) || `#${item.seq}`}
                </Text>
                <Text style={styles.historyNote} numberOfLines={1}>
                  {renderNote(item, displayOrder, null, cautionSet)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* ── Preview ─────────────────────────────────────────────────── */}
        <View style={styles.previewBox}>
          {(editingSeq != null || insertAt != null) && (
            <View style={styles.editingBanner}>
              <Text style={styles.editingLabel}>
                {editingSeq != null ? `Editing #${editingSeq}` : `Inserting before #${insertAt}`}
              </Text>
              <TouchableOpacity onPress={clearCurrent}>
                <Text style={styles.editingNewBtn}>+ New Note</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.previewText}>{preview}</Text>
        </View>

        {/* ── Input panel ──────────────────────────────────────────────── */}
        <ScrollView ref={panelScrollRef} style={styles.panel} keyboardShouldPersistTaps="handled">
          <View style={styles.odoRow}>
            <TextInput
              style={[styles.odoInput, { flex: 1 }]}
              placeholder="Odo (m)"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={odoInput}
              onChangeText={setOdoInput}
            />
            <TextInput
              style={[styles.odoInput, { flex: 2 }]}
              placeholder="Landmark (optional)"
              placeholderTextColor="#555"
              value={current.index_landmark ?? ''}
              onChangeText={(v) => setCurrent((p) => ({ ...p, index_landmark: v || null }))}
            />
          </View>

          <Label>Caution</Label>
          <ChipRow
            chips={cautionChips}
            selected={current.decorators}
            multi
            onPress={toggleDecorator}
            color={CATEGORY_COLORS.caution_decorator}
            onAdd={() => openAddModal('caution_decorator')}
            scrollRef={cautionScrollRef}
          />

          <Label>Direction</Label>
          <ChipRow
            chips={dirChips}
            selected={current.direction}
            onPress={(v) => setField('direction', v)}
            color={CATEGORY_COLORS.direction}
            onAdd={() => openAddModal('direction')}
            scrollRef={dirScrollRef}
          />

          <Label>Severity</Label>
          <ChipRow
            chips={sevChips}
            selected={current.severity}
            onPress={(v) => setField('severity', v)}
            color={CATEGORY_COLORS.severity}
            onAdd={() => openAddModal('severity')}
            scrollRef={sevScrollRef}
          />

          <Label>Duration</Label>
          <ChipRow
            chips={durChips}
            selected={current.duration}
            onPress={(v) => setField('duration', v)}
            color={CATEGORY_COLORS.duration}
            onAdd={() => openAddModal('duration')}
            scrollRef={durScrollRef}
          />

          <Label>Decorators</Label>
          <ChipRow
            chips={decChips}
            selected={current.decorators}
            multi
            onPress={toggleDecorator}
            color={CATEGORY_COLORS.decorator}
            onAdd={() => openAddModal('decorator')}
            scrollRef={decScrollRef}
          />

          <Label>Freetext note</Label>
          <TextInput
            style={styles.freetextInput}
            placeholder="Co-driver reminder, caution detail…"
            placeholderTextColor="#555"
            value={current.notes}
            onChangeText={(v) => setCurrent((p) => ({ ...p, notes: v }))}
            multiline
          />

          <Label>Joiner</Label>
          <ChipRow
            chips={joinChips}
            selected={current.joiner}
            onPress={(v) => setField('joiner', v)}
            color={CATEGORY_COLORS.joiner}
            onAdd={() => openAddModal('joiner')}
            scrollRef={joinScrollRef}
          />

          <Label>Joiner Decorators</Label>
          <ChipRow
            chips={joinDecChips}
            selected={current.joiner_decorators}
            multi
            onPress={toggleJoinerDecorator}
            color={CATEGORY_COLORS.joiner_decorator}
            onAdd={() => openAddModal('joiner_decorator')}
            scrollRef={jdScrollRef}
          />

          <Label>Freetext joiner</Label>
          <TextInput
            style={styles.freetextInput}
            placeholder="Joiner note…"
            placeholderTextColor="#555"
            value={current.joiner_notes}
            onChangeText={(v) => setCurrent((p) => ({ ...p, joiner_notes: v }))}
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnClear} onPress={clearCurrent}>
              <Text style={styles.btnClearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={saveNote}>
              <Text style={styles.btnSaveText}>
                {editingSeq != null ? 'Update' : insertAt != null ? 'Insert' : 'Add Note'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── Add chip modal ─────────────────────────────────────────── */}
        <Modal visible={addModal !== null} transparent animationType="fade">
          <View style={styles.addModalOverlay}>
            <View style={styles.addModalCard}>
              <Text style={styles.addModalTitle}>Add {addModal?.replace('_', ' ')} chip</Text>
              <TextInput
                style={styles.addModalInput}
                placeholder="Shorthand (e.g. Tightens)"
                placeholderTextColor="#555"
                value={addValue}
                onChangeText={setAddValue}
                autoFocus
              />
              <TextInput
                style={styles.addModalInput}
                placeholder="Audible (optional, defaults to shorthand)"
                placeholderTextColor="#555"
                value={addAudible}
                onChangeText={setAddAudible}
                onSubmitEditing={confirmAddChip}
              />
              <View style={styles.addModalButtons}>
                <TouchableOpacity onPress={() => setAddModal(null)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmAddChip}>
                  <Text style={styles.confirm}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ChipRow({ chips, selected, onPress, color, multi = false, onAdd, scrollRef }) {
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const active = multi
          ? Array.isArray(selected) && selected.includes(chip.value)
          : selected === chip.value;
        return (
          <TouchableOpacity
            key={chip.id}
            style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
            onPress={() => onPress(chip.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.value}</Text>
          </TouchableOpacity>
        );
      })}
      {onAdd && (
        <TouchableOpacity style={styles.chipAdd} onPress={onAdd}>
          <Text style={styles.chipAddText}>+</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  recceBanner: {
    backgroundColor: '#1a2a1a',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a4a2a',
  },
  recceBannerText: { color: '#4caf50', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  historyBox: { maxHeight: 140, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  historyList: { flexGrow: 0 },
  historyEmpty: { color: '#444', fontSize: 13, padding: 16, textAlign: 'center' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    gap: 10,
  },
  historyItemActive: { backgroundColor: '#1a1a1a' },
  historyOdo: { color: '#555', fontSize: 11, minWidth: 48 },
  historyNote: { color: '#ccc', fontSize: 14, flex: 1, fontFamily: 'monospace', fontWeight: 'bold' },

  newNoteFooter: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  newNoteFooterText: { color: '#e63946', fontSize: 13, fontWeight: '600' },

  previewBox: {
    padding: 14,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    minHeight: 52,
  },
  editingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editingLabel: { color: '#555', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  editingNewBtn: { color: '#e63946', fontSize: 12, fontWeight: '700' },
  previewText: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace' },

  panel: { flex: 1, padding: 12 },

  odoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  odoInput: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    padding: 9,
    color: '#fff',
    fontSize: 14,
  },

  label: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },

  chipScroll: { marginBottom: 2 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#111',
  },
  chipText: { color: '#888', fontSize: 17, fontFamily: 'monospace', fontWeight: 'bold' },
  chipTextActive: { color: '#fff', fontWeight: '700', fontFamily: 'monospace' },
  chipAdd: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#111',
  },
  chipAddText: { color: '#555', fontSize: 19, lineHeight: 20 },

  freetextInput: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    minHeight: 52,
    textAlignVertical: 'top',
    marginTop: 4,
  },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnClear: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  btnClearText: { color: '#888', fontSize: 15 },
  btnSave: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 32,
  },
  addModalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
  addModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  addModalInput: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    marginBottom: 12,
  },
  addModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancel: { color: '#888', fontSize: 16 },
  confirm: { color: '#e63946', fontSize: 16, fontWeight: '700' },
});
