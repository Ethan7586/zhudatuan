export interface NavigationConfiguration {
  readonly schemaVersion: 1;
  readonly ttlSeconds: number;
  readonly jitterRatio: number;
  readonly maximumNodes: number;
  readonly maximumBytes: number;
  readonly maximumDepth: number;
  readonly rebuildDeadlineMilliseconds: number;
  readonly degradedFailureThreshold: number;
}

export const NAVIGATION_CONFIGURATION: NavigationConfiguration = Object.freeze({
  schemaVersion: 1,
  ttlSeconds: 300,
  jitterRatio: 0.2,
  maximumNodes: 100,
  maximumBytes: 65_536,
  maximumDepth: 4,
  rebuildDeadlineMilliseconds: 120,
  degradedFailureThreshold: 5,
});
