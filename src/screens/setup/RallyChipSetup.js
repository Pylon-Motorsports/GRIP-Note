/**
 * @module RallyChipSetup
 * Per-rally chip configuration — category tabs, inline editing, reorder, add/delete.
 * Severity tab includes a fixed "Straight" dead-zone row.
 * Route params: { rallyId, rallyName?, fromCreate? }
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getChips,
  addChip,
  deleteChip,
  moveChip,
  updateChip,
  updateChipAngle,
  isChipUsed,
} from '../../db/rallyChips';
import { getStraightAngle, updateStraightAngle } from '../../db/rallies';

const CATEGORIES = [
  { key: 'caution_decorator', label: 'Caution' },
  { key: 'direction', label: 'Direction' },
  { key: 'severity', label: 'Severity' },
  { key: 'duration', label: 'Duration' },
  { key: 'decorator', label: 'Decorator' },
  { key: 'joiner', label: 'Joiner' },
  { key: 'joiner_decorator', label: 'Joiner Dec' },
];

export default function RallyChipSetup({ route, navigation }) {
  const { rallyId, rallyName, fromCreate } = route.params ?? {};

  const [selectedCat, setSelectedCat] = useState('caution_decorator');
  const [chips, setChips] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSeverity = selectedCat === 'severity';

  // Straight dead-zone angle (severity only, stored on rally)
  const [straightAngle, setStraightAngle] = useState('3');

  // Add chip modal
  const [addModal, setAddModal] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addAudible, setAddAudible] = useState('');
  const [addAngle, setAddAngle] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadChips(selectedCat);
      if (selectedCat === 'severity') {
        getStraightAngle(rallyId).then((a) => setStraightAngle(String(a ?? 3)));
      }
    }, [rallyId, selectedCat]),
  );

  async function loadChips(cat) {
    setLoading(true);
    setChips(await getChips(rallyId, cat ?? selectedCat));
    setLoading(false);
  }

  async function saveStraightAngle() {
    const n = parseInt(straightAngle.trim(), 10);
    if (isNaN(n) || n < 0) {
      setStraightAngle('3');
      return;
    }
    await updateStraightAngle(rallyId, n);
  }

  function switchCategory(cat) {
    setSelectedCat(cat);
    setChips([]);
    setLoading(true);
    getChips(rallyId, cat).then((rows) => {
      setChips(rows);
      setLoading(false);
    });
  }

  async function handleDelete(chip) {
    const used = await isChipUsed(rallyId, selectedCat, chip.value);
    if (used) {
      Alert.alert(
        'Cannot Delete',
        `"${chip.value}" is used in notes. Remove it from all notes first.`,
      );
      return;
    }
    await deleteChip(chip.id);
    loadChips();
  }

  async function handleMove(chip, direction) {
    await moveChip(chip.id, direction);
    loadChips();
  }

  async function confirmAdd() {
    const val = addValue.trim();
    if (!val) return;
    const angle = isSeverity && addAngle.trim() !== '' ? parseInt(addAngle.trim(), 10) : null;
    await addChip(rallyId, selectedCat, val, isSeverity ? null : addAudible.trim() || null, angle);
    setAddModal(false);
    setAddValue('');
    setAddAudible('');
    setAddAngle('');
    loadChips();
  }

  return (
    <View style={styles.container}>
      {fromCreate && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Customise terminology for {rallyName}. Edit shorthand or audible inline.
          </Text>
        </View>
      )}

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabs}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.tab, selectedCat === cat.key && styles.tabActive]}
            onPress={() => switchCategory(cat.key)}
          >
            <Text style={[styles.tabText, selectedCat === cat.key && styles.tabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Column headers */}
      <View style={styles.header}>
        <Text style={styles.headerCell}>Shorthand</Text>
        <Text style={styles.headerCell}>{isSeverity ? 'Dial angle' : 'Audible (spoken)'}</Text>
        <View style={styles.headerActions} />
      </View>

      {/* Straight dead-zone row (severity only, uneditable) */}
      {isSeverity && (
        <View style={styles.chipRow}>
          <Text style={styles.straightLabel}>Straight</Text>
          <View style={styles.angleWrap}>
            <TextInput
              style={styles.chipAngleInput}
              value={straightAngle}
              onChangeText={setStraightAngle}
              onBlur={saveStraightAngle}
              keyboardType="numeric"
              maxLength={3}
              selectTextOnFocus
            />
            <Text style={styles.angleSuffix}>°</Text>
          </View>
          <View style={styles.chipActions}>
            <View style={[styles.moveBtn, styles.moveBtnDisabled]}>
              <Text style={styles.moveBtnText}>↑</Text>
            </View>
            <View style={[styles.moveBtn, styles.moveBtnDisabled]}>
              <Text style={styles.moveBtnText}>↓</Text>
            </View>
            <View style={[styles.deleteBtn, styles.moveBtnDisabled]}>
              <Text style={styles.deleteBtnText}>×</Text>
            </View>
          </View>
        </View>
      )}

      {/* Chip list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={chips}
          keyExtractor={(c) => String(c.id)}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>No chips yet — tap + to add one.</Text>
          }
          renderItem={({ item, index }) => (
            <ChipEditRow
              chip={item}
              isFirst={index === 0}
              isLast={index === chips.length - 1}
              showAngle={isSeverity}
              onMove={(dir) => handleMove(item, dir)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* Add button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          setAddValue('');
          setAddAudible('');
          setAddModal(true);
        }}
      >
        <Text style={styles.addBtnText}>+ Add Chip</Text>
      </TouchableOpacity>

      {fromCreate && (
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('MainMenu', { rally: route.params?.rally })}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}

      {/* Add chip modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Add {CATEGORIES.find((c) => c.key === selectedCat)?.label} Chip
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Shorthand (e.g. Tightens)"
              placeholderTextColor="#555"
              value={addValue}
              onChangeText={setAddValue}
              autoFocus
            />
            {isSeverity ? (
              <TextInput
                style={styles.input}
                placeholder="Dial angle 0–90° (blank = hidden)"
                placeholderTextColor="#555"
                keyboardType="numeric"
                maxLength={3}
                value={addAngle}
                onChangeText={setAddAngle}
                onSubmitEditing={confirmAdd}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Audible / spoken (optional)"
                placeholderTextColor="#555"
                value={addAudible}
                onChangeText={setAddAudible}
                onSubmitEditing={confirmAdd}
              />
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmAdd}>
                <Text style={styles.confirm}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Inline-editable chip row ─────────────────────────────────────────────────

function ChipEditRow({ chip, isFirst, isLast, showAngle, onMove, onDelete }) {
  const [value, setValue] = useState(chip.value);
  const [audible, setAudible] = useState(chip.audible ?? '');
  const [angle, setAngle] = useState(chip.angle != null ? String(chip.angle) : '');

  useEffect(() => {
    setValue(chip.value);
    setAudible(chip.audible ?? '');
    setAngle(chip.angle != null ? String(chip.angle) : '');
  }, [chip.value, chip.audible, chip.angle]);

  async function save() {
    const v = value.trim();
    const a = audible.trim();
    if (!v) {
      setValue(chip.value);
      return;
    }
    if (v === chip.value && a === (chip.audible ?? '')) return;
    await updateChip(chip.id, v, a || null);
    // Update local chip reference so next blur is a no-op
    chip.value = v;
    chip.audible = a || null;
  }

  async function saveAngle() {
    const raw = angle.trim();
    const n = raw === '' ? null : parseInt(raw, 10);
    if (raw !== '' && isNaN(n)) {
      setAngle(chip.angle != null ? String(chip.angle) : '');
      return;
    }
    if (n === chip.angle) return;
    await updateChipAngle(chip.id, n);
    chip.angle = n;
  }

  return (
    <View style={styles.chipRow}>
      <TextInput
        style={styles.chipValueInput}
        value={value}
        onChangeText={setValue}
        onBlur={save}
        selectTextOnFocus
      />
      {showAngle ? (
        <View style={styles.angleWrap}>
          <TextInput
            style={styles.chipAngleInput}
            value={angle}
            onChangeText={setAngle}
            onBlur={saveAngle}
            placeholder="—"
            placeholderTextColor="#3a3a3a"
            keyboardType="numeric"
            maxLength={3}
            selectTextOnFocus
          />
          <Text style={styles.angleSuffix}>°</Text>
        </View>
      ) : (
        <TextInput
          style={styles.chipAudibleInput}
          value={audible}
          onChangeText={setAudible}
          onBlur={save}
          placeholder={value}
          placeholderTextColor="#3a3a3a"
          selectTextOnFocus
        />
      )}
      <View style={styles.chipActions}>
        <TouchableOpacity
          style={[styles.moveBtn, isFirst && styles.moveBtnDisabled]}
          onPress={() => onMove('up')}
          disabled={isFirst}
        >
          <Text style={styles.moveBtnText}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.moveBtn, isLast && styles.moveBtnDisabled]}
          onPress={() => onMove('down')}
          disabled={isLast}
        >
          <Text style={styles.moveBtnText}>↓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteBtnText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  banner: {
    backgroundColor: '#1a2a1a',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a4a2a',
  },
  bannerText: { color: '#4caf50', fontSize: 13 },

  tabScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tabs: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tabActive: { backgroundColor: '#e63946', borderColor: '#e63946' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerCell: {
    flex: 1,
    color: '#444',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerActions: { width: 110 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#444', fontSize: 14, textAlign: 'center', marginTop: 40 },

  list: { flex: 1 },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    gap: 6,
  },
  chipValueInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  chipAudibleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: '#888',
    fontSize: 14,
  },
  straightLabel: {
    flex: 1,
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  angleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipAngleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  angleSuffix: { color: '#555', fontSize: 14, width: 12 },

  chipActions: { flexDirection: 'row', gap: 3 },
  moveBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  moveBtnDisabled: { opacity: 0.15 },
  moveBtnText: { color: '#888', fontSize: 14 },
  deleteBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#2a0a0a',
  },
  deleteBtnText: { color: '#e63946', fontSize: 18, lineHeight: 20 },

  addBtn: {
    margin: 12,
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e63946',
    alignItems: 'center',
  },
  addBtnText: { color: '#e63946', fontSize: 14, fontWeight: '600' },

  doneBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 13,
    borderRadius: 8,
    backgroundColor: '#e63946',
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    marginBottom: 12,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancel: { color: '#888', fontSize: 16 },
  confirm: { color: '#e63946', fontSize: 16, fontWeight: '700' },
});
