import Constants from 'expo-constants';
import { isExpoGo } from './canRegisterForRemotePush';

function nativeApplicationVersions(): { version: string | null; build: string | null } {
  if (isExpoGo()) return { version: null, build: null };
  try {
    // Top-level import crashes Android Expo Go SDK 58 (ExpoApplication native module missing).
    const Application = require('expo-application') as typeof import('expo-application');
    return {
      version: Application.nativeApplicationVersion ?? null,
      build: Application.nativeBuildVersion ?? null,
    };
  } catch {
    return { version: null, build: null };
  }
}

/**
 * Shown on Profile for support (e.g. Version 1.0.0 (6)).
 * The number in parentheses is the store build: iOS CFBundleVersion, Android versionCode.
 * Expo Go has no app build number, so the label is the version only.
 */
export function formatAppVersionLabel(): string {
  const native = nativeApplicationVersions();
  const version = Constants.expoConfig?.version ?? native.version;
  const build = isExpoGo() ? null : native.build;
  if (version && build) return `Version ${version} (${build})`;
  if (version) return `Version ${version}`;
  return '';
}
