/**
 * @module RootNavigator
 * Top-level navigation stack for the GRIP app.
 * Flow: RallyHome → MainMenu → (Drive | Recce | Rally | Export | ChipSetup | Preferences)
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RallyHome from '../screens/RallyHome';
import MainMenu from '../screens/MainMenu';
import RallyList from '../screens/RallyList';
import Preferences from '../screens/Preferences';

// Writing
import WritingStageSelect from '../screens/writing/WritingStageSelect';
import WritingEditor from '../screens/writing/WritingEditor';

// Reading
import ReadingStageSelect from '../screens/reading/ReadingStageSelect';
import StageReader from '../screens/reading/StageReader';

// Export
import ExportStageSelect from '../screens/export/ExportStageSelect';
import ExportPreview from '../screens/export/ExportPreview';

// Drive
import DriveStageSelect from '../screens/drive/DriveStageSelect';
import DriveScreen from '../screens/drive/DriveScreen';

// Setup
import RallyChipSetup from '../screens/setup/RallyChipSetup';

const Stack = createNativeStackNavigator();

/**
 * Root navigation stack with dark theme header styling.
 * @returns {React.ReactElement}
 */
export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="RallyHome"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="RallyHome" component={RallyHome} options={{ headerShown: false }} />
        <Stack.Screen name="MainMenu" component={MainMenu} options={{ headerShown: false }} />
        <Stack.Screen name="RallyList" component={RallyList} options={{ title: 'Rallies' }} />
        <Stack.Screen
          name="Preferences"
          component={Preferences}
          options={{ title: 'Preferences' }}
        />

        {/* Drive */}
        <Stack.Screen
          name="DriveStageSelect"
          component={DriveStageSelect}
          options={{ title: 'Drive Mode' }}
        />
        <Stack.Screen name="DriveScreen" component={DriveScreen} options={{ headerShown: false }} />

        {/* Recce */}
        <Stack.Screen
          name="WritingStageSelect"
          component={WritingStageSelect}
          options={{ title: 'Select Stage' }}
        />
        <Stack.Screen name="WritingEditor" component={WritingEditor} options={{ title: 'Recce' }} />

        {/* Rally */}
        <Stack.Screen
          name="ReadingStageSelect"
          component={ReadingStageSelect}
          options={{ title: 'Select Stage' }}
        />
        <Stack.Screen name="StageReader" component={StageReader} options={{ headerShown: false }} />

        {/* Export */}
        <Stack.Screen
          name="ExportStageSelect"
          component={ExportStageSelect}
          options={{ title: 'Export' }}
        />
        <Stack.Screen
          name="ExportPreview"
          component={ExportPreview}
          options={{ title: 'Export Preview' }}
        />

        {/* Setup */}
        <Stack.Screen
          name="RallyChipSetup"
          component={RallyChipSetup}
          options={{ title: 'Chip Setup' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
