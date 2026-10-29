import {legacySettingsKeys,type LegacySettings,type SettingsState} from '../../shared/settings'

interface SettingsBridge {settings():Promise<SettingsState>;migrateSettings(values:LegacySettings):Promise<SettingsState>}
type SettingsStorage=Pick<Storage,'getItem'|'removeItem'>

// Sólo main decide si falta migrar; nunca se releen preferencias ya migradas.
export async function loadSettings(bridge:SettingsBridge,storage?:SettingsStorage):Promise<SettingsState>{
 const current=await bridge.settings()
 if(!current.migrationPending||current.readonly)return current
 const values:LegacySettings={}
 for(const key of legacySettingsKeys)try{const value=storage?.getItem(key);if(value!==null&&value!==undefined)values[key]=value}catch{}
 const migrated=await bridge.migrateSettings(values)
 if(!migrated.readonly&&!migrated.migrationPending)for(const key of legacySettingsKeys)try{storage?.removeItem(key)}catch{}
 return migrated
}
