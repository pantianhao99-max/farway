export interface HealthDataProvider {
  isAvailable(): Promise<boolean>
  requestAuthorization(): Promise<boolean>
  getPendingDistance(since?: string): Promise<number>
}
