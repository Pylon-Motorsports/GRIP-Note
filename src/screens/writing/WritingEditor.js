import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPaceNotes, upsertPaceNote, deletePaceNote, getNextSeq, parseNote } from '../../db/paceNotes';
import { getSetting } from '../../db/database';
import { renderNote, formatOdo } from '../../utils/renderNote';

// ── Base chip sets ──────────────────────────────────────────────────────────
const DIRECTIONS = ['L', 'R', 'Keep L', 'Keep R', 'Keep Mid'];
const SEVERITIES = ['1', '2', '3', '4', '5', '6', 'Hairpin', 'Square'];
const DURATIONS  = ['Long', 'Short'];
const DECORATORS = [
  '!', '!!', '!!!', 'Care', 'Brow', 'Opens', 'Maybe', 'Over Crest', 'Jump',
  "Don't Cut", 'Keep In', 'Keep Out', 'Flat', 'Narrows', 'Widens', 'Slippery', 'Bumps',
];
const JOINERS = ['→', '>', '<', 'Over', '10', '20', '30', '50', '100', '150', '200'];

const EMPTY_NOTE = {
  direction: null, severity: null, duration: null,
  decorators: [], joiner: null, notes: '',
  index_odo: null, index_landmark: null, index_sequence: null,
};

export default function WritingEditor({ route, navigation }) {
  const { setId, mode } = route.params ?? {};
  const isRecce = mode === 'recce';

  const [notes, setNotes] = useState([]);
  const [current, setCurrent] = useState({ ...EMPTY_NOTE });
  const [editingSeq, setEditingSeq] = useState(null);
  const [displayOrder, setDisplayOrder] = useState('direction_first');
  const [odoUnit, setOdoUnit] = useState('metres');
  const [odoInput, setOdoInput] = useState('');
  const listRef = useRef(null);

  // Custom chips (session-scoped, survive until leaving editor)
  const [customChips, setCustomChips] = useState({ severity: [], duration: [], decorator: [] });
  const [addModal, setAddModal] = useState(null);   // 'severity' | 'duration' | 'decorator' | null
  const [addInput, setAddInput] = useState('');

  useEffect(() => {
    if (isRecce) navigation.setOptions({ title: 'Recce Edit' });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      loadNotes();
    }, [setId])
  );

  async function loadSettings() {
    const order = await getSetting('display_order');
    const unit  = await getSetting('odo_unit');
    if (order) setDisplayOrder(order);
    if (unit)  setOdoUnit(unit);
  }

  async function loadNotes() {
    const rows = await getPaceNotes(setId);
    setNotes(rows.map(parseNote));
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  function setField(field, value) {
    setCurrent(prev => ({ ...prev, [field]: prev[field] === value ? null : value }));
  }

  function toggleDecorator(dec) {
    setCurrent(prev => {
      const has = prev.decorators.includes(dec);
      return {
        ...prev,
        decorators: has ? prev.decorators.filter(d => d !== dec) : [...prev.decorators, dec],
      };
    });
  }

  // ── Custom chip helpers ────────────────────────────────────────────────────
  function openAddModal(category) {
    setAddInput('');
    setAddModal(category);
  }

  function confirmAddChip() {
    const val = addInput.trim();
    if (val) {
      setCustomChips(prev => ({ ...prev, [addModal]: [...prev[addModal], val] }));
    }
    setAddModal(null);
    setAddInput('');
  }

  // ── Save / clear ───────────────────────────────────────────────────────────
  async function saveNote() {
    const odoMetres = odoInput ? parseInt(odoInput, 10) : null;
    const seq = editingSeq ?? await getNextSeq(setId);
    await upsertPaceNote({
      set_id: setId, seq,
      ...current,
      index_odo: odoMetres,
      recce_at: new Date().toISOString(),
    });
    clearCurrent();
    loadNotes();
  }

  function clearCurrent() {
    setCurrent({ ...EMPTY_NOTE });
    setEditingSeq(null);
    setOdoInput('');
  }

  // ── Edit / delete ──────────────────────────────────────────────────────────
  function startEdit(note) {
    setCurrent({
      direction: note.direction,
      severity: note.severity,
      duration: note.duration,
      decorators: [...note.decorators],
      joiner: note.joiner,
      notes: note.notes ?? '',
      index_landmark: note.index_landmark,
      index_sequence: note.index_sequence,
    });
    setOdoInput(note.index_odo != null ? String(note.index_odo) : '');
    setEditingSeq(note.seq);
  }

  async function handleDelete(seq) {
    Alert.alert('Delete Note', 'Remove this pacenote?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => { await deletePaceNote(setId, seq); loadNotes(); } },
    ]);
  }

  const preview = renderNote(current, displayOrder) || '—';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Recce mode indicator ────────────────────────────────────── */}
      {isRecce && (
        <View style={styles.recceBanner}>
          <Text style={styles.recceBannerText}>Recce Edit — new copy of original</Text>
        </View>
      )}

      {/* ── Note history ────────────────────────────────────────────── */}
      <View style={styles.historyBox}>
        <FlatList
          ref={listRef}
          data={notes}
          keyExtractor={n => String(n.seq)}
          style={styles.historyList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
              onLongPress={() => handleDelete(item.seq)}
            >
              <Text style={styles.historyOdo}>
                {formatOdo(item.index_odo, odoUnit) || `#${item.seq}`}
              </Text>
              <Text style={styles.historyNote} numberOfLines={1}>
                {renderNote(item, displayOrder)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Preview / editing banner ─────────────────────────────────── */}
      <View style={styles.previewBox}>
        {editingSeq != null && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingLabel}>Editing #{editingSeq}</Text>
            <TouchableOpacity onPress={clearCurrent}>
              <Text style={styles.editingNewBtn}>+ New Note</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.previewText}>{preview}</Text>
        {current.notes ? <Text style={styles.previewNotes}>{current.notes}</Text> : null}
      </View>

      {/* ── Input panel ──────────────────────────────────────────────── */}
      <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled">

        {/* Odo / landmark */}
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
            onChangeText={v => setCurrent(p => ({ ...p, index_landmark: v || null }))}
          />
        </View>

        <Label>Direction</Label>
        <ChipRow
          options={DIRECTIONS}
          selected={current.direction}
          onPress={v => setField('direction', v)}
          color="#e63946"
        />

        <Label>Severity</Label>
        <ChipRow
          options={[...SEVERITIES, ...customChips.severity]}
          selected={current.severity}
          onPress={v => setField('severity', v)}
          color="#ff9800"
          onAdd={() => openAddModal('severity')}
        />

        <Label>Duration</Label>
        <ChipRow
          options={[...DURATIONS, ...customChips.duration]}
          selected={current.duration}
          onPress={v => setField('duration', v)}
          color="#9c27b0"
          onAdd={() => openAddModal('duration')}
        />

        <Label>Decorators</Label>
        <ChipRow
          options={[...DECORATORS, ...customChips.decorator]}
          selected={current.decorators}
          multi
          onPress={toggleDecorator}
          color="#2196f3"
          onAdd={() => openAddModal('decorator')}
        />

        <Label>Joiner</Label>
        <ChipRow
          options={JOINERS}
          selected={current.joiner}
          onPress={v => setField('joiner', v)}
          color="#4caf50"
        />

        <Label>Freetext note</Label>
        <TextInput
          style={styles.freetextInput}
          placeholder="Co-driver reminder, caution detail…"
          placeholderTextColor="#555"
          value={current.notes}
          onChangeText={v => setCurrent(p => ({ ...p, notes: v }))}
          multiline
        />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnClear} onPress={clearCurrent}>
            <Text style={styles.btnClearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSave} onPress={saveNote}>
            <Text style={styles.btnSaveText}>
              {editingSeq != null ? 'Update' : 'Add Note'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Custom chip modal ─────────────────────────────────────────── */}
      <Modal visible={addModal !== null} transparent animationType="fade">
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalCard}>
            <Text style={styles.addModalTitle}>
              Add custom {addModal}
            </Text>
            <TextInput
              style={styles.addModalInput}
              placeholder="e.g. Very Tight, Bridge…"
              placeholderTextColor="#555"
              value={addInput}
              onChangeText={setAddInput}
              autoFocus
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
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ChipRow({ options, selected, onPress, color, multi = false, onAdd }) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = multi
          ? Array.isArray(selected) && selected.includes(opt)
          : selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
            onPress={() => onPress(opt)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {onAdd && (
        <TouchableOpacity style={styles.chipAdd} onPress={onAdd}>
          <Text style={styles.chipAddText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  recceBanner: {
    backgroundColor: '#1a2a1a',
    paddingVertical: 6, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#2a4a2a',
  },
  recceBannerText: { color: '#4caf50', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  historyBox: { maxHeight: 140, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  historyList: { flexGrow: 0 },
  historyEmpty: { color: '#444', fontSize: 13, padding: 16, textAlign: 'center' },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#111', gap: 10,
  },
  historyItemActive: { backgroundColor: '#1a1a1a' },
  historyOdo: { color: '#555', fontSize: 11, minWidth: 48 },
  historyNote: { color: '#ccc', fontSize: 14, flex: 1 },

  newNoteFooter: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  newNoteFooterText: { color: '#e63946', fontSize: 13, fontWeight: '600' },

  previewBox: {
    padding: 14, backgroundColor: '#0d0d0d',
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a', minHeight: 52,
  },
  editingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  editingLabel: { color: '#555', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  editingNewBtn: { color: '#e63946', fontSize: 12, fontWeight: '700' },
  previewText: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  previewNotes: { color: '#888', fontSize: 13, marginTop: 4 },

  panel: { flex: 1, padding: 12 },

  odoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  odoInput: {
    borderWidth: 1, borderColor: '#222', borderRadius: 6,
    padding: 9, color: '#fff', fontSize: 14,
  },

  label: {
    color: '#555', fontSize: 11, fontWeight: '600',
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 10, marginBottom: 4,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#111',
  },
  chipText: { color: '#888', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipAdd: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#111',
  },
  chipAddText: { color: '#555', fontSize: 15, lineHeight: 15 },

  freetextInput: {
    borderWidth: 1, borderColor: '#222', borderRadius: 6,
    padding: 10, color: '#fff', fontSize: 14,
    minHeight: 60, textAlignVertical: 'top', marginTop: 4,
  },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnClear: {
    flex: 1, padding: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  btnClearText: { color: '#888', fontSize: 15 },
  btnSave: {
    flex: 2, padding: 14, borderRadius: 8,
    backgroundColor: '#e63946', alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  addModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', padding: 32,
  },
  addModalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
  addModalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, textTransform: 'capitalize' },
  addModalInput: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    padding: 10, color: '#fff', marginBottom: 16,
  },
  addModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancel: { color: '#888', fontSize: 16 },
  confirm: { color: '#e63946', fontSize: 16, fontWeight: '700' },
});
