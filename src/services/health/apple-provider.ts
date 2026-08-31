import type { HealthDataProvider } from './types'
import { isHealthDataAvailable, queryWalkingRunningDistance, requestHealthAuthorization } from '@/uni_modules/faraway-healthkit'

export class AppleHealthDataProvider implements HealthDataProvider {
  async isAvailable():Promise<boolean> {
    return isHealthDataAvailable()
  }

  requestAuthorization():Promise<boolean> {
    return new Promise((resolve, reject) => {
      requestHealthAuthorization({
        success: () => resolve(true),
        fail: error => reject(new Error(error.errMsg || 'HealthKit 授权失败'))
      })
    })
  }

  getPendingDistance(since?:string):Promise<number> {
    const startDate = since ? new Date(since) : new Date(new Date().setHours(0,0,0,0))
    return new Promise((resolve, reject) => {
      queryWalkingRunningDistance({
        startDateMs: startDate.getTime(),
        endDateMs: Date.now(),
        success: result => resolve(Math.max(0, result.distanceKm)),
        fail: error => reject(new Error(error.errMsg || '读取健康距离失败'))
      })
    })
  }
}
