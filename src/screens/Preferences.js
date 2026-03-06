/**
 * @module Preferences
 * Global app preferences — display order and odometer unit.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting } from '../db/database';

/** Global preferences screen. */
export default function Preferences() {
  const [displayOrder, setDisplayOrderState] = useState('direction_first');
  const [odoUnit, setOdoUnitState] = useState('metres');

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const order = await getSetting('display_order');
    const unit = await getSetting('odo_unit');
    if (order) setDisplayOrderState(order);
    if (unit) setOdoUnitState(unit);
  }

  async function setDisplayOrder(value) {
    await setSetting('display_order', value);
    setDisplayOrderState(value);
  }

  async function setOdoUnit(value) {
    await setSetting('odo_unit', value);
    setOdoUnitState(value);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Note Display Order">
        <Text style={styles.sectionDesc}>
          Controls how direction and severity are ordered in every rendered note.
        </Text>
        <OptionRow
          label="Direction first"
          example="L 3"
          selected={displayOrder === 'direction_first'}
          onPress={() => setDisplayOrder('direction_first')}
        />
        <OptionRow
          label="Severity first"
          example="3 L"
          selected={displayOrder === 'severity_first'}
          onPress={() => setDisplayOrder('severity_first')}
        />
      </Section>

      <Section title="Odometer Unit">
        <Text style={styles.sectionDesc}>
          Distance along stage. Stored in metres internally, displayed as your preference.
        </Text>
        <OptionRow
          label="Metres"
          example="1250 m"
          selected={odoUnit === 'metres'}
          onPress={() => setOdoUnit('metres')}
        />
        <OptionRow
          label="Kilometres"
          example="1.25 km"
          selected={odoUnit === 'km'}
          onPress={() => setOdoUnit('km')}
        />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function OptionRow({ label, example, selected, onPress }) {
  return (
    <TouchableOpacity style={[styles.option, selected && styles.optionActive]} onPress={onPress}>
      <View style={styles.optionLeft}>
        <View style={[styles.radio, selected && styles.radioActive]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{label}</Text>
      </View>
      <Text style={styles.optionExample}>{example}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, gap: 24 },

  section: {
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDesc: {
    color: '#555',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  optionActive: { borderBottomColor: '#1a1a1a' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#e63946' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e63946' },
  optionLabel: { color: '#888', fontSize: 15 },
  optionLabelActive: { color: '#fff', fontWeight: '600' },
  optionExample: { color: '#555', fontSize: 13, fontFamily: 'monospace' },
});
