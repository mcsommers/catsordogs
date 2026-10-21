import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** Expo Go's own binary, not this project's packaged build. */
function runningInExpoGo(): boolean {
  return Constants.expoVersion != null || Constants.appOwnership === 'expo';
}

/**
 * Shown on Profile for support (e.g. Version 1.0.0 (6)).
 * The number in parentheses is the store build: iOS CFBundleVersion, Android versionCode.
 * Expo Go has no app build number, so the label is the version only.
 */
export function formatAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Application.nativeApplicationVersion;
  const build = runningInExpoGo() ? null : Application.nativeBuildVersion;
  if (version && build) return `Version ${version} (${build})`;
  if (version) return `Version ${version}`;
  return '';
}
