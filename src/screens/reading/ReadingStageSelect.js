import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRallies, getStages, getNoteSets, copyNoteSet, formatSetLabel } from '../../db/rallies';

// 4-step flow: rally → stage → set → mode (Recce / Stage)
export default function ReadingStageSelect({ navigation }) {
  const [step, setStep] = useState('rally');
  const [rallies, setRallies] = useState([]);
  const [stages, setStages] = useState([]);
  const [sets, setSets] = useState([]);
  const [selectedRally, setSelectedRally] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setStep('rally');
      setSelectedRally(null);
      setSelectedStage(null);
      setSelectedSet(null);
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

  function pickSet(set) {
    setSelectedSet(set);
    setStep('mode');
  }

  async function openRecce() {
    setLoading(true);
    try {
      const newSetId = await copyNoteSet(selectedSet.set_id);
      navigation.navigate('WritingEditor', { setId: newSetId, mode: 'recce' });
    } finally {
      setLoading(false);
    }
  }

  function openStage() {
    navigation.navigate('StageReader', { setId: selectedSet.set_id });
  }

  function goBack() {
    const prev = { stage: 'rally', set: 'stage', mode: 'set' };
    setStep(s => prev[s] ?? 'rally');
  }

  function Breadcrumb() {
    return (
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {selectedRally?.name ?? 'Select Rally'}
          {selectedStage ? ` › ${selectedStage.name}` : ''}
          {selectedSet ? ` › ${formatSetLabel(selectedSet)}` : ''}
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
    return <View style={styles.center}><ActivityIndicator color="#2196f3" /></View>;
  }

  // ── Pick rally ─────────────────────────────────────────────────────────────
  if (step === 'rally') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {rallies.length === 0
          ? <View style={styles.center}><Text style={styles.empty}>No rallies yet.</Text></View>
          : <FlatList
              data={rallies}
              keyExtractor={r => r.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => pickRally(item)}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.date}</Text>
                </TouchableOpacity>
              )}
            />
        }
      </View>
    );
  }

  // ── Pick stage ─────────────────────────────────────────────────────────────
  if (step === 'stage') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {stages.length === 0
          ? <View style={styles.center}><Text style={styles.empty}>No stages for this rally.</Text></View>
          : <FlatList
              data={stages}
              keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => pickStage(item)}>
                  <Text style={styles.itemName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
        }
      </View>
    );
  }

  // ── Pick note set ──────────────────────────────────────────────────────────
  if (step === 'set') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {sets.length === 0
          ? <View style={styles.center}><Text style={styles.empty}>No note sets for this stage.{'\n'}Write some notes first.</Text></View>
          : <FlatList
              data={sets}
              keyExtractor={s => s.set_id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => pickSet(item)}>
                  <Text style={styles.itemName}>{formatSetLabel(item)}</Text>
                </TouchableOpacity>
              )}
            />
        }
      </View>
    );
  }

  // ── Pick mode ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Breadcrumb />
      <View style={styles.modeContainer}>
        <TouchableOpacity style={[styles.modeBtn, styles.recceBtn]} onPress={openRecce}>
          <Text style={styles.modeBtnLabel}>Recce Read</Text>
          <Text style={styles.modeBtnDesc}>
            Opens a new copy — editable, original preserved
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.modeBtn, styles.stageBtn]} onPress={openStage}>
          <Text style={styles.modeBtnLabel}>Stage Read</Text>
          <Text style={styles.modeBtnDesc}>
            Read-only, large display, tap to advance
          </Text>
        </TouchableOpacity>
      </View>
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
  breadcrumbBack: { color: '#2196f3', fontSize: 13, fontWeight: '600', marginLeft: 12 },

  item: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  itemName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  itemSub: { color: '#666', fontSize: 12, marginTop: 3 },

  modeContainer: { flex: 1, padding: 20, gap: 16, justifyContent: 'center' },
  modeBtn: {
    borderRadius: 10, padding: 24,
    borderLeftWidth: 4, backgroundColor: '#0d0d0d',
  },
  recceBtn: { borderLeftColor: '#2196f3' },
  stageBtn: { borderLeftColor: '#e63946' },
  modeBtnLabel: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modeBtnDesc: { color: '#666', fontSize: 13, marginTop: 6, lineHeight: 18 },
});
