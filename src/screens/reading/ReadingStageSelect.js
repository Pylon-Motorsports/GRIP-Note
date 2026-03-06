/**
 * @module ReadingStageSelect
 * 3-step picker for Rally reading: rally → stage → note set.
 * Navigates to StageReader with the selected set_id.
 * Route params: { rally? } — optional Rally to skip step 1.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRallies, getStages, getNoteSets, formatSetLabel } from '../../db/rallies';

/**
 * @param {Object} props
 * @param {Object} [props.route.params.rally] — pre-selected rally to skip step 1
 */
export default function ReadingStageSelect({ navigation, route }) {
  const rally = route.params?.rally ?? null;

  const [step, setStep] = useState('rally');
  const [rallies, setRallies] = useState([]);
  const [stages, setStages] = useState([]);
  const [sets, setSets] = useState([]);
  const [selectedRally, setSelectedRally] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSelectedStage(null);
      if (rally) {
        setSelectedRally(rally);
        setLoading(true);
        getStages(rally.id).then((s) => {
          setStages(s);
          setLoading(false);
          setStep('stage');
        });
      } else {
        setStep('rally');
        setSelectedRally(null);
        loadRallies();
      }
    }, [rally?.id]),
  );

  async function loadRallies() {
    setLoading(true);
    setRallies(await getRallies());
    setLoading(false);
  }

  async function pickRally(r) {
    setSelectedRally(r);
    setLoading(true);
    setStages(await getStages(r.id));
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
    navigation.navigate('StageReader', { setId: set.set_id });
  }

  function goBack() {
    if (step === 'stage') {
      if (rally) navigation.goBack();
      else setStep('rally');
    } else {
      setStep('stage');
    }
  }

  function Breadcrumb() {
    return (
      <View style={styles.breadcrumb}>
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {selectedRally?.name ?? 'Select Rally'}
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2196f3" />
      </View>
    );
  }

  // ── Pick rally ─────────────────────────────────────────────────────────────
  if (step === 'rally') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {rallies.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No rallies yet.</Text>
          </View>
        ) : (
          <FlatList
            data={rallies}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => pickRally(item)}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.date}</Text>
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
            <Text style={styles.empty}>No stages for this rally.</Text>
          </View>
        ) : (
          <FlatList
            data={stages}
            keyExtractor={(s) => s.id}
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

  // ── Pick note set ──────────────────────────────────────────────────────────
  if (step === 'set') {
    return (
      <View style={styles.container}>
        <Breadcrumb />
        {sets.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>
              No note sets for this stage.{'\n'}Write some notes first.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sets}
            keyExtractor={(s) => s.set_id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => pickSet(item)}>
                <Text style={styles.itemName}>{formatSetLabel(item)}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#555', textAlign: 'center', fontSize: 15, lineHeight: 24 },

  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#0d0d0d',
  },
  breadcrumbText: { color: '#aaa', fontSize: 13, flex: 1 },
  breadcrumbBack: { color: '#2196f3', fontSize: 13, fontWeight: '600', marginLeft: 12 },

  item: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  itemName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  itemSub: { color: '#666', fontSize: 12, marginTop: 3 },
});
