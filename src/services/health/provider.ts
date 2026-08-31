import type { HealthDataProvider } from './types'
import { MockHealthDataProvider } from './mock-provider'
// #ifdef APP-IOS
import { AppleHealthDataProvider } from './apple-provider'
// #endif

function createProvider():HealthDataProvider {
  // #ifdef APP-IOS
  return new AppleHealthDataProvider()
  // #endif
  return new MockHealthDataProvider()
}

export const healthDataProvider = createProvider()
