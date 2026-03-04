import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MainMenu"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="MainMenu" component={MainMenu} options={{ title: 'GRIP Note', headerShown: false }} />
        <Stack.Screen name="RallyList" component={RallyList} options={{ title: 'Rallies' }} />
        <Stack.Screen name="Preferences" component={Preferences} options={{ title: 'Preferences' }} />

        {/* Writing */}
        <Stack.Screen name="WritingStageSelect" component={WritingStageSelect} options={{ title: 'Select Stage' }} />
        <Stack.Screen name="WritingEditor" component={WritingEditor} options={{ title: 'Writing' }} />

        {/* Reading */}
        <Stack.Screen name="ReadingStageSelect" component={ReadingStageSelect} options={{ title: 'Select Stage' }} />
        <Stack.Screen name="StageReader" component={StageReader} options={{ headerShown: false }} />

        {/* Import / Export */}
        <Stack.Screen name="ExportStageSelect" component={ExportStageSelect} options={{ title: 'Import / Export' }} />
        <Stack.Screen name="ExportPreview" component={ExportPreview} options={{ title: 'Export Preview' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
