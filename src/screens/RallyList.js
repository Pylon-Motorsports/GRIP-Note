/**
 * @module RallyList
 * Expandable rally → stage list with long-press actions (rename, duplicate, delete).
 * Supports creating rallies/stages inline and importing .grip.json files.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  SectionList,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import {
  getRallies,
  createRally,
  updateRally,
  deleteRally,
  getStages,
  createStage,
  updateStage,
  deleteStage,
  duplicateRally,
  duplicateStage,
} from '../db/rallies';
import { getSetting } from '../db/database';
import { importRally } from '../utils/importExport';

/** Converts a Date to ISO date string (YYYY-MM-DD). */
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}
/** Parses an ISO date string into a Date (defaults to today). */
function parseDate(s) {
  return s ? new Date(s + 'T00:00:00') : new Date();
}

export default function RallyList() {
  const [sections, setSections] = useState([]);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState({});

  // Create/edit modal
  const [modal, setModal] = useState(null); // 'createRally'|'editRally'|'createStage'|'editStage'|null
  const [activeRallyId, setActiveRallyId] = useState(null);
  const [editTargetId, setEditTargetId] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputDriver, setInputDriver] = useState('');
  const [pickedDate, setPickedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Rally preferences (within modal)
  const [prefDisplayOrder, setPrefDisplayOrder] = useState('direction_first');
  const [prefOdoUnit, setPrefOdoUnit] = useState('metres');

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function doImport() {
    setImporting(true);
    try {
      const result = await importRally();
      if (result) {
        Alert.alert(
          'Import complete',
          `${result.rallyName} — ${result.stageCount} stage${result.stageCount !== 1 ? 's' : ''}, ${result.noteCount} notes`,
        );
        load();
      }
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  }

  async function load() {
    const rallies = await getRallies();
    const built = await Promise.all(
      rallies.map(async (r) => ({ rally: r, data: await getStages(r.id) })),
    );
    setSections(built);
  }

  function toggleExpand(rallyId) {
    setExpanded((prev) => ({ ...prev, [rallyId]: !prev[rallyId] }));
  }

  // ── Open modals ────────────────────────────────────────────────────────────

  async function openCreateRally() {
    const [order, unit] = await Promise.all([getSetting('display_order'), getSetting('odo_unit')]);
    setInputName('');
    setInputDriver('');
    setPickedDate(new Date());
    setPrefDisplayOrder(order ?? 'direction_first');
    setPrefOdoUnit(unit ?? 'metres');
    setEditTargetId(null);
    setModal('createRally');
  }

  function openEditRally(rally) {
    setInputName(rally.name);
    setInputDriver(rally.driver ?? '');
    setPickedDate(parseDate(rally.date));
    setPrefDisplayOrder(rally.display_order ?? 'direction_first');
    setPrefOdoUnit(rally.odo_unit ?? 'metres');
    setEditTargetId(rally.id);
    setModal('editRally');
  }

  function openCreateStage(rallyId) {
    setActiveRallyId(rallyId);
    setInputName('');
    setEditTargetId(null);
    setModal('createStage');
    if (!expanded[rallyId]) toggleExpand(rallyId);
  }

  function openEditStage(stage) {
    setInputName(stage.name);
    setEditTargetId(stage.id);
    setModal('editStage');
  }

  function closeModal() {
    setModal(null);
    setEditTargetId(null);
    setActiveRallyId(null);
    setInputName('');
    setInputDriver('');
    setShowDatePicker(false);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!inputName.trim()) return;
    switch (modal) {
      case 'createRally':
        await createRally({
          name: inputName.trim(),
          date: toDateStr(pickedDate),
          driver: inputDriver.trim() || null,
          displayOrder: prefDisplayOrder,
          odoUnit: prefOdoUnit,
        });
        break;
      case 'editRally':
        await updateRally(editTargetId, {
          name: inputName.trim(),
          date: toDateStr(pickedDate),
          driver: inputDriver.trim() || null,
          displayOrder: prefDisplayOrder,
          odoUnit: prefOdoUnit,
        });
        break;
      case 'createStage':
        await createStage({ rallyId: activeRallyId, name: inputName.trim() });
        break;
      case 'editStage':
        await updateStage(editTargetId, { name: inputName.trim() });
        break;
    }
    closeModal();
    load();
  }

  function rallyLongPress(rally) {
    Alert.alert(rally.name, '', [
      { text: 'Edit', onPress: () => openEditRally(rally) },
      { text: 'Duplicate', onPress: () => confirmDuplicateRally(rally) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteRally(rally.id, rally.name),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function stageLongPress(stage) {
    Alert.alert(stage.name, '', [
      { text: 'Edit', onPress: () => openEditStage(stage) },
      { text: 'Duplicate', onPress: () => confirmDuplicateStage(stage) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteStage(stage.id, stage.name),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDeleteRally(id, name) {
    Alert.alert('Delete Rally', `Delete "${name}" and all its stages and notes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRally(id);
          load();
        },
      },
    ]);
  }

  function confirmDeleteStage(id, name) {
    Alert.alert('Delete Stage', `Delete "${name}" and all its notes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteStage(id);
          load();
        },
      },
    ]);
  }

  function confirmDuplicateRally(rally) {
    Alert.alert('Duplicate Rally', `Copy "${rally.name}" with all its stages and notes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          await duplicateRally(rally.id);
          load();
        },
      },
    ]);
  }

  function confirmDuplicateStage(stage) {
    Alert.alert('Duplicate Stage', `Copy "${stage.name}" with all its note sets?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          await duplicateStage(stage.id);
          load();
        },
      },
    ]);
  }

  const isRallyModal = modal === 'createRally' || modal === 'editRally';
  const modalTitle =
    {
      createRally: 'New Rally',
      editRally: 'Edit Rally',
      createStage: 'New Stage',
      editStage: 'Rename Stage',
    }[modal] ?? '';

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item?.id ?? String(index)}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.empty}>No rallies yet. Tap + to add one.</Text>}
        renderSectionHeader={({ section: { rally } }) => (
          <TouchableOpacity
            style={styles.rallyRow}
            onPress={() => toggleExpand(rally.id)}
            onLongPress={() => rallyLongPress(rally)}
          >
            <View style={styles.rallyInfo}>
              <Text style={styles.rallyName}>{rally.name}</Text>
              <Text style={styles.rallyDate}>
                {rally.date}
                {rally.driver ? `  ·  ${rally.driver}` : ''}
              </Text>
            </View>
            <View style={styles.rallyActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openEditRally(rally)}>
                <Text style={styles.iconBtnText}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addStageBtn}
                onPress={() => openCreateStage(rally.id)}
              >
                <Text style={styles.addStageBtnText}>+ Stage</Text>
              </TouchableOpacity>
              <Text style={styles.chevron}>{expanded[rally.id] ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>
        )}
        renderItem={({ item: stage, section: { rally } }) => {
          if (!expanded[rally.id]) return null;
          return (
            <TouchableOpacity style={styles.stageRow} onLongPress={() => stageLongPress(stage)}>
              <Text style={styles.stageName}>{stage.name}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openEditStage(stage)}>
                <Text style={styles.iconBtnText}>✎</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.importFab} onPress={doImport} disabled={importing}>
        <Text style={styles.importFabText}>{importing ? '…' : 'Import'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fab} onPress={openCreateRally}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Create / Edit modal ── */}
      <Modal visible={modal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>

              <TextInput
                style={styles.input}
                placeholder={isRallyModal ? 'Event name' : 'Stage name (e.g. SS1)'}
                placeholderTextColor="#666"
                value={inputName}
                onChangeText={setInputName}
                autoFocus
              />

              {isRallyModal && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Driver / Co-driver (optional)"
                    placeholderTextColor="#666"
                    value={inputDriver}
                    onChangeText={setInputDriver}
                  />

                  <TouchableOpacity
                    style={styles.dateTrigger}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateTriggerLabel}>Date</Text>
                    <Text style={styles.dateTriggerValue}>{toDateStr(pickedDate)}</Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={pickedDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                      onChange={(event, date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (date) setPickedDate(date);
                      }}
                    />
                  )}

                  {/* ── Note display preferences ── */}
                  <Text style={styles.prefSectionLabel}>Note Display</Text>

                  <Text style={styles.prefLabel}>Direction / Severity order</Text>
                  <View style={styles.toggleRow}>
                    <ToggleBtn
                      label="Direction first"
                      example="L 3"
                      active={prefDisplayOrder === 'direction_first'}
                      onPress={() => setPrefDisplayOrder('direction_first')}
                    />
                    <ToggleBtn
                      label="Severity first"
                      example="3 L"
                      active={prefDisplayOrder === 'severity_first'}
                      onPress={() => setPrefDisplayOrder('severity_first')}
                    />
                  </View>

                  <Text style={styles.prefLabel}>Odometer unit</Text>
                  <View style={styles.toggleRow}>
                    <ToggleBtn
                      label="Metres"
                      example="1250 m"
                      active={prefOdoUnit === 'metres'}
                      onPress={() => setPrefOdoUnit('metres')}
                    />
                    <ToggleBtn
                      label="Kilometres"
                      example="1.25 km"
                      active={prefOdoUnit === 'km'}
                      onPress={() => setPrefOdoUnit('km')}
                    />
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={closeModal}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={styles.confirm}>
                    {modal?.startsWith('edit') ? 'Save' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToggleBtn({ label, example, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.toggleBtnLabel, active && styles.toggleBtnLabelActive]}>{label}</Text>
      <Text style={styles.toggleBtnExample}>{example}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 },

  rallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#111',
  },
  rallyInfo: { flex: 1 },
  rallyName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rallyDate: { color: '#777', fontSize: 12, marginTop: 2 },
  rallyActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  iconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  iconBtnText: { color: '#555', fontSize: 16 },

  addStageBtn: {
    borderWidth: 1,
    borderColor: '#ff9800',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addStageBtnText: { color: '#ff9800', fontSize: 12, fontWeight: '600' },
  chevron: { color: '#555', fontSize: 12, width: 14 },

  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 32,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  stageName: { color: '#ccc', fontSize: 15, flex: 1 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },

  importFab: {
    position: 'absolute',
    bottom: 24,
    right: 92,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 18,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  importFabText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    marginBottom: 12,
  },
  dateTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  dateTriggerLabel: { color: '#666', fontSize: 14 },
  dateTriggerValue: { color: '#fff', fontSize: 14, fontWeight: '600' },

  prefSectionLabel: {
    color: '#e63946',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 14,
  },
  prefLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#111',
  },
  toggleBtnActive: { borderColor: '#e63946', backgroundColor: 'rgba(230,57,70,0.1)' },
  toggleBtnLabel: { color: '#666', fontSize: 13 },
  toggleBtnLabelActive: { color: '#fff', fontWeight: '700' },
  toggleBtnExample: { color: '#444', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 8,
  },
  cancel: { color: '#888', fontSize: 16 },
  confirm: { color: '#e63946', fontSize: 16, fontWeight: '700' },
});
