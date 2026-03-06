/**
 * @module ExportStageSelect
 * Export screen — share a rally as .grip.json or print-ready PDF.
 * Route params: { rally } — the Rally object to export.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { exportRally } from '../../utils/importExport';
import { exportRallyPdf } from '../../utils/pdfExport';

/**
 * @param {Object} props
 * @param {import('../../types').Rally} props.route.params.rally — rally to export
 */
export default function ImportExport({ route }) {
  const rally = route?.params?.rally ?? null;
  const [busy, setBusy] = useState(false);

  async function doExport() {
    if (!rally) {
      Alert.alert('No rally selected', 'Return to the rally menu and select a rally first.');
      return;
    }
    setBusy(true);
    try {
      const filename = await exportRally(rally.id);
      Alert.alert('Exported', `Shared as ${filename}`);
    } catch (e) {
      Alert.alert('Export failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doPdfExport() {
    if (!rally) {
      Alert.alert('No rally selected', 'Return to the rally menu and select a rally first.');
      return;
    }
    setBusy(true);
    try {
      await exportRallyPdf(rally.id);
    } catch (e) {
      Alert.alert('PDF export failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4caf50" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.hub}>
      <Text style={styles.hubTitle}>Export</Text>
      {rally ? <Text style={styles.hubRally}>{rally.name}</Text> : null}
      <Text style={styles.hubDesc}>
        Export saves the entire rally — all stages and note sets — as a single .grip.json file.
      </Text>

      <TouchableOpacity
        style={[styles.hubBtn, styles.pdfBtn, !rally && styles.hubBtnDisabled]}
        onPress={doPdfExport}
      >
        <Text style={styles.hubBtnLabel}>Export PDF</Text>
        <Text style={styles.hubBtnDesc}>
          {rally ? `Print-ready pacenotes for ${rally.name}` : 'Select a rally first'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.hubBtn, styles.exportBtn, !rally && styles.hubBtnDisabled]}
        onPress={doExport}
      >
        <Text style={styles.hubBtnLabel}>Export Rally</Text>
        <Text style={styles.hubBtnDesc}>
          {rally ? `Export all stages for ${rally.name}` : 'Select a rally first'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  hub: { padding: 24, paddingTop: 32, gap: 16 },
  hubTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 2 },
  hubRally: { color: '#e63946', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  hubDesc: { color: '#666', fontSize: 14, lineHeight: 20, marginBottom: 8 },

  hubBtn: {
    borderRadius: 10,
    padding: 22,
    borderLeftWidth: 4,
    backgroundColor: '#0d0d0d',
  },
  hubBtnDisabled: { opacity: 0.4 },
  pdfBtn: { borderLeftColor: '#ff9800' },
  exportBtn: { borderLeftColor: '#4caf50' },
  hubBtnLabel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hubBtnDesc: { color: '#777', fontSize: 13, marginTop: 4 },
});
