import { StatusBar } from 'expo-status-bar';
import TestHarness from './src/temp/TestHarness';

export default function App() {
  return (
    <>
      <TestHarness />
      <StatusBar style="auto" />
    </>
  );
}
