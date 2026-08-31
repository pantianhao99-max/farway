/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

declare module '@/uni_modules/faraway-healthkit' {
  type NativeError={errMsg:string;errCode?:number}
  export function isHealthDataAvailable():boolean
  export function requestHealthAuthorization(options:{success?:(result:{errMsg:string})=>void;fail?:(error:NativeError)=>void;complete?:(result:unknown)=>void}):void
  export function queryWalkingRunningDistance(options:{startDateMs:number;endDateMs:number;success?:(result:{errMsg:string;distanceKm:number})=>void;fail?:(error:NativeError)=>void;complete?:(result:unknown)=>void}):void
}
