import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG = require('../../assets/bg-summer.png');

export default function MainMenu({ navigation }) {
  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <Text style={styles.title}>GRIP Note</Text>
          <Text style={styles.subtitle}>Generic Rally Information Protocol</Text>
        </View>

        <View style={styles.buttons}>
          <MenuButton
            label="Writing"
            desc="Create or add to pacenotes"
            accent="#e63946"
            onPress={() => navigation.navigate('WritingStageSelect')}
          />
          <MenuButton
            label="Reading"
            desc="Read notes on recce or stage"
            accent="#2196f3"
            onPress={() => navigation.navigate('ReadingStageSelect')}
          />
          <MenuButton
            label="Import / Export"
            desc="Share or receive note sets"
            accent="#4caf50"
            onPress={() => navigation.navigate('ExportStageSelect')}
          />
          <MenuButton
            label="Rallies"
            desc="Manage rallies and stages"
            accent="#ff9800"
            onPress={() => navigation.navigate('RallyList')}
          />
          <MenuButton
            label="Preferences"
            desc="Display order, odo units and more"
            accent="#9c27b0"
            onPress={() => navigation.navigate('Preferences')}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function MenuButton({ label, desc, accent, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.button, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
      <Text style={styles.buttonDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
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
    marginTop: 32,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  buttons: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 2,
  },
});
