import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RecceReader({ route }) {
  const { setId } = route.params ?? {};
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Recce Reader{'\n'}Set: {setId}{'\n'}(coming soon)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#555', fontSize: 16, textAlign: 'center' },
});
