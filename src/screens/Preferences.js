import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting } from '../db/database';

// Same list as WritingEditor / RallyList
const ALL_DECORATORS = [
  '!', '!!', '!!!', 'Care', 'Brow', 'Opens', 'Maybe', 'Over Crest', 'Jump',
  "Don't Cut", 'Keep In', 'Keep Out', 'Flat', 'Narrows', 'Widens', 'Slippery', 'Bumps',
];

const DEFAULT_PRE_NOTE = ['!', '!!', '!!!', 'Care'];

export default function Preferences() {
  const [displayOrder, setDisplayOrderState] = useState('direction_first');
  const [odoUnit, setOdoUnitState] = useState('metres');
  const [preNoteDecs, setPreNoteDecsState] = useState(DEFAULT_PRE_NOTE);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  async function load() {
    const order = await getSetting('display_order');
    const unit  = await getSetting('odo_unit');
    const decs  = await getSetting('pre_note_decs');
    if (order) setDisplayOrderState(order);
    if (unit)  setOdoUnitState(unit);
    setPreNoteDecsState(decs ? JSON.parse(decs) : DEFAULT_PRE_NOTE);
  }

  async function setDisplayOrder(value) {
    await setSetting('display_order', value);
    setDisplayOrderState(value);
  }

  async function setOdoUnit(value) {
    await setSetting('odo_unit', value);
    setOdoUnitState(value);
  }

  async function togglePreNoteDec(dec) {
    const next = preNoteDecs.includes(dec)
      ? preNoteDecs.filter(d => d !== dec)
      : [...preNoteDecs, dec];
    await setSetting('pre_note_decs', JSON.stringify(next));
    setPreNoteDecsState(next);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.pageDesc}>
        These are defaults applied when you create a new rally.
        Each rally can be adjusted individually from the Rallies screen.
      </Text>

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

      <Section title="Decorators Before the Note">
        <Text style={styles.sectionDesc}>
          Selected decorators appear BEFORE direction/severity.
          All others appear after. Tap to toggle.
        </Text>
        <View style={styles.chipWrap}>
          {ALL_DECORATORS.map(dec => {
            const active = preNoteDecs.includes(dec);
            return (
              <TouchableOpacity
                key={dec}
                style={[styles.decChip, active && styles.decChipActive]}
                onPress={() => togglePreNoteDec(dec)}
              >
                <Text style={[styles.decChipText, active && styles.decChipTextActive]}>
                  {dec}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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

  pageDesc: {
    color: '#555', fontSize: 13, lineHeight: 19,
    borderLeftWidth: 2, borderLeftColor: '#333',
    paddingLeft: 12,
  },

  section: {
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    color: '#fff', fontSize: 15, fontWeight: '700',
    marginBottom: 6,
  },
  sectionDesc: {
    color: '#555', fontSize: 13, lineHeight: 18,
    marginBottom: 12,
  },

  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  optionActive: { borderBottomColor: '#1a1a1a' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#444',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: '#e63946' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e63946' },
  optionLabel: { color: '#888', fontSize: 15 },
  optionLabelActive: { color: '#fff', fontWeight: '600' },
  optionExample: { color: '#555', fontSize: 13, fontFamily: 'monospace' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  decChip: {
    borderWidth: 1, borderColor: '#333', borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#111',
  },
  decChipActive: { borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.15)' },
  decChipText: { color: '#666', fontSize: 13 },
  decChipTextActive: { color: '#fff', fontWeight: '700' },
});
