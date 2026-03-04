import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRallies, getStages, getNoteSets, createNoteSet, copyNoteSet, formatSetLabel } from '../../db/rallies';

export default function WritingStageSelect({ navigation }) {
  const [step, setStep] = useState('rally');
  const [rallies, setRallies] = useState([]);
  const [stages, setStages] = useState([]);
  const [sets, setSets] = useState([]);
  const [selectedRally, setSelectedRally] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Version-choice modal for existing sets
  const [versionModal, setVersionModal] = useState(null); // set row | null

  useFocusEffect(
    useCallback(() => {
      setStep('rally');
      setSelectedRally(null);
      setSelectedStage(null);
      loadRallies();
    }, [])
  );

  async function loadRallies() {
    setLoading(true);
    setRallies(await getRallies());
    setLoading(false);
  }

  async function pickRally(rally) {
    setSelectedRally(rally);
    setLoading(true);
    setStages(await getStages(rally.id));
    setLoading(false);
    setStep('stage');
  }

  async function pickStage(stage) {
    setSelectedStage(stage);
    setLoading(true);
    setSets(await getNoteSets(stage.id));
    setLoading(false);
    setStep('set');
  }

  function openSet(setId) {
    navigation.navigate('WritingEditor', { setId, stageId: selectedStage.id });
  }

  // Tap existing set → show choice modal
  function promptVersionChoice(set) {
    setVersionModal(set);
  }

  async function openNewVersion() {
    const set = versionModal;
    setVersionModal(null);
    setLoading(true);
    const newSetId = await copyNoteSet(set.set_id);
    setLoading(false);
    navigation.navigate('WritingEditor', { setId: newSetId, stageId: selectedStage.id });
  }

  function openExisting() {
    const set = versionModal;
    setVersionModal(null);
    openSet(set.set_id);
  }

  async function openNewSet() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const setId = await createNoteSet({
      stageId: selectedStage.id,
      recceDate: today,
      driver: null,
    });
    setLoading(false);
    navigation.navigate('WritingEditor', { setId, stageId: selectedStage.id });
  }

  function goBack() {
    if (step === 'stage') setStep('rally');
    else if (step === 'set') setStep('stage');
  }

  function Breadcrumb() {
    return (
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText}>
          {selectedRally ? selectedRally.name : 'Select Rally'}
          {selectedStage ? ` › ${selectedStage.name}` : ''}
        </Text>
        {step !== 'rally' && (
          <TouchableOpacity onPress={goBack}>
            <Text style={styles.breadcrumbBack}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#e63946" /></View>;
  }

  // ── Pick rally ─────────────────────────────────────────────────────────────
  if (step === 'rally') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {rallies.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No rallies yet.{'\n'}Add one from the Rallies menu.</Text>
          </View>
        ) : (
          <FlatList
            data={rallies}
            keyExtractor={r => r.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => pickRally(item)}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>
                  {item.date}{item.driver ? `  ·  ${item.driver}` : ''}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Pick stage ─────────────────────────────────────────────────────────────
  if (step === 'stage') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {stages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No stages for this rally.{'\n'}Add one from the Rallies menu.</Text>
          </View>
        ) : (
          <FlatList
            data={stages}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => pickStage(item)}>
                <Text style={styles.itemName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Pick or create note set ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Breadcrumb />

      <TouchableOpacity style={styles.newSetBtn} onPress={openNewSet}>
        <Text style={styles.newSetText}>+ New Note Set</Text>
        <Text style={styles.newSetSub}>Start a fresh recce pass</Text>
      </TouchableOpacity>

      {sets.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Existing Sets</Text>
          <FlatList
            data={sets}
            keyExtractor={s => s.set_id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => promptVersionChoice(item)}>
                <Text style={styles.itemName}>{formatSetLabel(item)}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {/* Version choice modal */}
      <Modal visible={versionModal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Open Note Set</Text>
            <Text style={styles.modalSub}>{versionModal ? formatSetLabel(versionModal) : ''}</Text>

            <TouchableOpacity style={styles.choiceBtn} onPress={openExisting}>
              <Text style={styles.choiceBtnLabel}>Edit This Set</Text>
              <Text style={styles.choiceBtnDesc}>Modify notes in place</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnNew]} onPress={openNewVersion}>
              <Text style={styles.choiceBtnLabel}>New Version</Text>
              <Text style={styles.choiceBtnDesc}>Copy and edit — original preserved</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelRow} onPress={() => setVersionModal(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#555', textAlign: 'center', fontSize: 15, lineHeight: 24 },

  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0d0d0d',
  },
  breadcrumbText: { color: '#aaa', fontSize: 13, flex: 1 },
  breadcrumbBack: { color: '#e63946', fontSize: 13, fontWeight: '600' },

  item: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  itemName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  itemSub: { color: '#666', fontSize: 12, marginTop: 3 },

  newSetBtn: {
    margin: 16, padding: 18, borderRadius: 8,
    borderWidth: 1, borderColor: '#e63946',
    backgroundColor: 'rgba(230,57,70,0.08)',
  },
  newSetText: { color: '#e63946', fontSize: 17, fontWeight: '700' },
  newSetSub: { color: '#888', fontSize: 12, marginTop: 3 },

  sectionLabel: {
    color: '#555', fontSize: 11, fontWeight: '600',
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', padding: 24,
  },
  modalCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#666', fontSize: 13, marginBottom: 16 },

  choiceBtn: {
    padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#333',
    backgroundColor: '#111', marginBottom: 10,
  },
  choiceBtnNew: { borderColor: '#e63946', backgroundColor: 'rgba(230,57,70,0.08)' },
  choiceBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  choiceBtnDesc: { color: '#666', fontSize: 12, marginTop: 3 },

  cancelRow: { alignItems: 'center', paddingTop: 8 },
  cancelText: { color: '#555', fontSize: 15 },
});
