import type {ProjectManifest,ProjectSource} from './project'

export type RecipeStep=ProjectManifest['recipes'][number]['steps'][number]
export type RecipeColumn=ProjectSource['schema']['columns'][number]
// Only the main process supplies an authorized absolute path; renderer requests use project/source IDs.
export type RecipeOperationSource=Pick<ProjectSource,'path'|'bytes'|'format'|'schema'|'sha256'>&{mtimeMs?:number;dev?:number;ino?:number}
export interface RecipeSampling {
 step:number;method:'first'|'random';requestedRows?:number;percent?:number;seed?:number;eligible:number;selected:number
}
export interface RecipeOperationResult {
 headers:string[];columns:RecipeColumn[];rows:(string|null)[][]
 scanned:number;eligible:number;resultCount:number;complete:boolean;cancelled:boolean;bytesRead:number;sha256?:string;sampling:RecipeSampling[]
}
export interface RecipeAnalysisContext {
 projectId:string;recipeId:string;sourceId:string;name:string;sourceName:string;steps:RecipeStep[];stepOwners:string[]
 coverage:Omit<RecipeOperationResult,'rows'>&{sourceVersionDifferent?:boolean}
}
export interface RecipeAnalysisPrepared {coverage:Omit<RecipeOperationResult,'rows'>}
export interface RecipeOperationProgress {bytesRead:number;scanned:number;totalBytes:number}
export interface RecipeOperationHooks {
 cancelled?:()=>boolean;progress?:(progress:RecipeOperationProgress)=>void;batchRecords?:number;chunk?:number
}
export type RecipeOperationErrorCode='schema'|'columns'|'plan'|'changed'|'csv'|'encoding'|'counter'|'unavailable'|'analysis-limit'|'analysis-structure'
export class RecipeOperationError extends Error {
 constructor(readonly code:RecipeOperationErrorCode,readonly data:Record<string,unknown>={}){super(code);this.name='RecipeOperationError'}
}
