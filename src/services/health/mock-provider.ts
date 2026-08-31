import type { HealthDataProvider } from './types'
export class MockHealthDataProvider implements HealthDataProvider {
  constructor(private pendingDistance=0) {}
  setPendingDistance(distance:number) { this.pendingDistance=distance }
  async isAvailable() { return false }
  async requestAuthorization() { return false }
  async getPendingDistance(_since?:string) { return this.pendingDistance }
}
