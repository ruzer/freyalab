import type {TableConditionGroup,DocumentInfo} from './types'

// I0 · Contrato tipado de operaciones sobre un archivo grande. Lista cerrada: quien llama no envía SQL, expresiones ni rutas de salida.
// La implementación actual es el motor propio estricto (src/main/operations.ts); un motor externo tendrá que cumplir este mismo contrato
// (docs/design/EXTERNAL-ENGINES.md).
export type Fidelity = 'bytes' | 'values'
export interface OperationSource {revision:number}
interface Base {requestId:string;source:OperationSource;conditions?:TableConditionGroup}
export interface CountRequest extends Base {operation:'count'}
export interface PreviewRequest extends Base {operation:'preview';columns?:number[];limit:number}
export interface ExtractRequest extends Base {operation:'filter_extract';columns?:number[]}
export type OperationRequest = CountRequest | PreviewRequest | ExtractRequest
// Lo que recibe el motor: la ruta de salida la fija el proceso principal (cuadro de guardar), nunca la interfaz.
export type EngineOperation = CountRequest | PreviewRequest | (ExtractRequest & {output:string})

export interface CountResult {operation:'count';matched:number;scanned:number}
export interface PreviewResult {operation:'preview';headers:string[];rows:string[][];found:number;scanned:number;complete:boolean}
export interface ExtractResult {
 operation:'filter_extract';output:string;matched:number;scanned:number;bytes:number
 // 'bytes': cada registro extraído es idéntico al del original. 'values': mismos valores exactos, formato normalizado (ver `normalization`).
 fidelity:Fidelity;normalization:string[];irregularRows:number;elapsedMs:number
}
export type OperationResult = CountResult | PreviewResult | ExtractResult
// Origen de un documento creado por una extracción: la interfaz lo muestra mientras esté abierto.
export interface ExtractOrigin {sourceName:string;sourcePath:string;matched:number;total:number;conditions:string|null;columns:string[]|null;fidelity:Fidelity;normalization:string[];irregularRows:number}
// `document` solo existe tras una extracción (el archivo nuevo ya abierto). `null`: la persona canceló el cuadro de guardar.
export type OperationOutcome = {result:OperationResult;document?:DocumentInfo} | null
export const PREVIEW_LIMIT = 100
export const fidelityLabel:Record<Fidelity,string> = {bytes:'bytes conservados',values:'valores conservados; formato normalizado'}
