/**
 * @module MainMenu
 * Rally main menu — hub for Drive, Recce, Rally reading, Export, Chip Setup, and Preferences.
 * Route params: { rally } — the selected Rally object.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG = require('../../assets/bg-summer.png');

/**
 * @param {Object} props
 * @param {import('../types').Rally} props.route.params.rally — the selected rally
 */
export default function MainMenu({ navigation, route }) {
  const rally = route.params?.rally;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
            <Text style={styles.backText}>← Rallies</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{rally?.name ?? 'GRIP Note'}</Text>
          {rally?.date ? (
            <Text style={styles.subtitle}>
              {rally.date}
              {rally.driver ? `  ·  ${rally.driver}` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.buttons}>
          <MenuButton
            label="Drive"
            desc="Record notes while driving the stage"
            accent="#00bcd4"
            onPress={() => navigation.navigate('DriveStageSelect', { rally })}
          />
          <MenuButton
            label="Recce"
            desc="Create or add to pacenotes"
            accent="#e63946"
            onPress={() => navigation.navigate('WritingStageSelect', { rally })}
          />
          <MenuButton
            label="Rally"
            desc="Read notes at stage"
            accent="#2196f3"
            onPress={() => navigation.navigate('ReadingStageSelect', { rally })}
          />
          <MenuButton
            label="Export"
            desc="Share note sets as .grip.json or PDF"
            accent="#4caf50"
            onPress={() => navigation.navigate('ExportStageSelect', { rally })}
          />

          <View style={styles.divider} />

          <MenuButton
            label="Chip Setup"
            desc="Customise terminology and audibles"
            accent="#ff9800"
            onPress={() =>
              navigation.navigate('RallyChipSetup', {
                rallyId: rally?.id,
                rallyName: rally?.name,
              })
            }
            small
          />
          <MenuButton
            label="Preferences"
            desc="Display order, odo units and more"
            accent="#9c27b0"
            onPress={() => navigation.navigate('Preferences')}
            small
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function MenuButton({ label, desc, accent, onPress, small }) {
  return (
    <TouchableOpacity
      style={[styles.button, { borderLeftColor: accent }, small && styles.buttonSmall]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.buttonLabel, small && styles.buttonLabelSmall]}>{label}</Text>
      <Text style={styles.buttonDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    marginTop: 8,
  },
  backRow: { marginBottom: 12 },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 4,
  },
  buttons: {
    gap: 10,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  buttonSmall: {
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonLabelSmall: {
    fontSize: 16,
  },
  buttonDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 2,
  },
});
