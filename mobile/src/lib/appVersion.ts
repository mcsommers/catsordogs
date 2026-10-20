import Constants from 'expo-constants';

/** Shown on Profile for support (e.g. Version 1.0.0 (3)). */
export function formatAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion;
  const build = Constants.nativeBuildVersion;
  if (version && build) return `Version ${version} (${build})`;
  if (version) return `Version ${version}`;
  return '';
}
