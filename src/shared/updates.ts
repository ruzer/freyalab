export interface UpdateRelease {version:string;name:string;publishedAt:string|null;url:string;assets:string[]}
export type UpdateResult=({status:'available';currentVersion:string;release:UpdateRelease}|{status:'current';currentVersion:string}|{status:'cancelled'}|{status:'error';code:'offline'|'rateLimit'|'service'|'invalid'|'timeout'|'size'})&{settingsWarning?:'lastCheckNotSaved'}
