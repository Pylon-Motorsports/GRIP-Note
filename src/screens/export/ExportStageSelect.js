import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRallies, getStages, getNoteSets } from '../../db/rallies';
import { exportNoteSet, importNoteSet } from '../../utils/importExport';

// 'idle' | 'rally' | 'stage' | 'set' (for export picker)
export default function ImportExport() {
  const [exportStep, setExportStep] = useState('idle');
  const [rallies, setRallies] = useState([]);
  const [stages, setStages] = useState([]);
  const [sets, setSets] = useState([]);
  const [selectedRally, setSelectedRally] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setExportStep('idle');
      setSelectedRally(null);
      setSelectedStage(null);
    }, [])
  );

  async function startExport() {
    setBusy(true);
    setRallies(await getRallies());
    setBusy(false);
    setExportStep('rally');
  }

  async function pickRally(rally) {
    setSelectedRally(rally);
    setBusy(true);
    setStages(await getStages(rally.id));
    setBusy(false);
    setExportStep('stage');
  }

  async function pickStage(stage) {
    setSelectedStage(stage);
    setBusy(true);
    setSets(await getNoteSets(stage.id));
    setBusy(false);
    setExportStep('set');
  }

  async function doExport(setId, label) {
    setBusy(true);
    try {
      const filename = await exportNoteSet(setId);
      Alert.alert('Exported', `Shared as ${filename}`);
    } catch (e) {
      Alert.alert('Export failed', e.message);
    } finally {
      setBusy(false);
      setExportStep('idle');
    }
  }

  async function doImport() {
    setBusy(true);
    try {
      const result = await importNoteSet();
      if (!result) { setBusy(false); return; }
      Alert.alert(
        'Import complete',
        `${result.count} notes imported for ${result.rallyName} › ${result.stageName}${result.driver ? ` (${result.driver})` : ''}`
      );
    } catch (e) {
      Alert.alert('Import failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  function cancelExport() { setExportStep('idle'); }

  if (busy) {
    return <View style={styles.center}><ActivityIndicator color="#4caf50" size="large" /></View>;
  }

  // ── Export picker steps ────────────────────────────────────────────────────
  if (exportStep !== 'idle') {
    const title = { rally: 'Select Rally', stage: 'Select Stage', set: 'Select Note Set' }[exportStep];
    const data = { rally: rallies, stage: stages, set: sets }[exportStep];
    const keyFn = exportStep === 'set'
      ? item => item.set_id
      : item => item.id;
    const nameFn = exportStep === 'set'
      ? item => `v${item.version}${item.driver ? ` — ${item.driver}` : ''}`
      : item => item.name;
    const subFn = exportStep === 'set'
      ? item => item.recce_date ?? 'No date'
      : item => (exportStep === 'rally' ? item.date : '');
    const onPress = exportStep === 'rally'
      ? item => pickRally(item)
      : exportStep === 'stage'
      ? item => pickStage(item)
      : item => doExport(item.set_id, nameFn(item));

    return (
      <View style={styles.container}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <TouchableOpacity onPress={cancelExport}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {selectedRally && (
          <Text style={styles.pickerBreadcrumb}>
            {selectedRally.name}{selectedStage ? ` › ${selectedStage.name}` : ''}
          </Text>
        )}
        <FlatList
          data={data}
          keyExtractor={keyFn}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => onPress(item)}>
              <Text style={styles.itemName}>{nameFn(item)}</Text>
              {subFn(item) ? <Text style={styles.itemSub}>{subFn(item)}</Text> : null}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // ── Main hub ───────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.hub}>
      <Text style={styles.hubTitle}>Import / Export</Text>
      <Text style={styles.hubDesc}>
        Notes are stored locally. Use Export to share a note set as a file,
        and Import to load a file shared by someone else.
      </Text>

      <TouchableOpacity style={[styles.hubBtn, styles.exportBtn]} onPress={startExport}>
        <Text style={styles.hubBtnLabel}>Export Note Set</Text>
        <Text style={styles.hubBtnDesc}>Save as .grip.json file and share</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.hubBtn, styles.importBtn]} onPress={doImport}>
        <Text style={styles.hubBtnLabel}>Import Note Set</Text>
        <Text style={styles.hubBtnDesc}>Open a .grip.json file from another device</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  hub: { padding: 24, paddingTop: 32, gap: 16 },
  hubTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  hubDesc: { color: '#666', fontSize: 14, lineHeight: 20, marginBottom: 16 },

  hubBtn: {
    borderRadius: 10, padding: 22,
    borderLeftWidth: 4,
    backgroundColor: '#0d0d0d',
  },
  exportBtn: { borderLeftColor: '#4caf50' },
  importBtn: { borderLeftColor: '#2196f3' },
  hubBtnLabel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hubBtnDesc: { color: '#777', fontSize: 13, marginTop: 4 },

  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#0d0d0d',
  },
  pickerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelLink: { color: '#4caf50', fontSize: 14 },
  pickerBreadcrumb: { color: '#555', fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },

  item: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemSub: { color: '#666', fontSize: 12, marginTop: 3 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
});
