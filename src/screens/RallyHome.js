/**
 * @module RallyHome
 * Landing screen — displays all rallies with a FAB to create a new one.
 * Navigates to MainMenu on rally selection, or to RallyChipSetup after creation.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  Platform,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { getRallies, createRally } from '../db/rallies';
import { getSetting } from '../db/database';

const BG = require('../../assets/bg-summer.png');

/** Converts a Date to ISO date string (YYYY-MM-DD). */
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export default function RallyHome({ navigation }) {
  const [rallies, setRallies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create rally modal
  const [modal, setModal] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputDriver, setInputDriver] = useState('');
  const [pickedDate, setPickedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    setLoading(true);
    setRallies(await getRallies());
    setLoading(false);
  }

  function selectRally(rally) {
    navigation.navigate('MainMenu', { rally });
  }

  async function openCreateModal() {
    const [order, unit] = await Promise.all([getSetting('display_order'), getSetting('odo_unit')]);
    setInputName('');
    setInputDriver('');
    setPickedDate(new Date());
    setModal({ order: order ?? 'direction_first', unit: unit ?? 'metres' });
  }

  async function confirmCreate() {
    if (!inputName.trim()) return;
    setSaving(true);
    const rallyName = inputName.trim();
    const rallyDate = toDateStr(pickedDate);
    const rallyDriver = inputDriver.trim() || null;
    const rallyId = await createRally({
      name: rallyName,
      date: rallyDate,
      driver: rallyDriver,
      displayOrder: modal.order,
      odoUnit: modal.unit,
    });
    setSaving(false);
    setModal(false);
    load();
    navigation.navigate('RallyChipSetup', {
      rallyId,
      rallyName,
      fromCreate: true,
      rally: { id: rallyId, name: rallyName, date: rallyDate, driver: rallyDriver },
    });
  }

  function closeModal() {
    setModal(false);
    setShowDatePicker(false);
  }

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>GRIP</Text>
            <Text style={styles.subtitle}>Select a Rally</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('RallyList')}
            >
              <Text style={styles.headerBtnText}>Manage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('Preferences')}
            >
              <Text style={styles.headerBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rally list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : rallies.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No rallies yet</Text>
            <Text style={styles.emptyHint}>Tap + to create your first rally</Text>
          </View>
        ) : (
          <FlatList
            data={rallies}
            keyExtractor={(r) => r.id}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.rallyBtn} onPress={() => selectRally(item)}>
                <Text style={styles.rallyName}>{item.name}</Text>
                <Text style={styles.rallyMeta}>
                  {item.date}
                  {item.driver ? `  ·  ${item.driver}` : ''}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create rally modal */}
      <Modal visible={!!modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Rally</Text>

            <TextInput
              style={styles.input}
              placeholder="Event name"
              placeholderTextColor="#666"
              value={inputName}
              onChangeText={setInputName}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Driver / Co-driver (optional)"
              placeholderTextColor="#666"
              value={inputDriver}
              onChangeText={setInputDriver}
            />

            <TouchableOpacity style={styles.dateTrigger} onPress={() => setShowDatePicker(true)}>
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

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmCreate} disabled={saving}>
                <Text style={styles.confirm}>{saving ? '…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  headerBtn: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  headerBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyHint: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  rallyBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderLeftWidth: 4,
    borderLeftColor: '#e63946',
    borderRadius: 8,
    padding: 20,
    marginBottom: 10,
  },
  rallyName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  rallyMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e63946',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 32 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
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
    marginBottom: 16,
  },
  dateTriggerLabel: { color: '#666', fontSize: 14 },
  dateTriggerValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancel: { color: '#888', fontSize: 16 },
  confirm: { color: '#e63946', fontSize: 16, fontWeight: '700' },
});
