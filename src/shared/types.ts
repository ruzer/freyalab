import type {ChartConfiguration,ChartPreset} from './chart-presets'
import type {LanguagePreference,LanguageState} from './i18n'
import type {ApplicationInfo} from './app-info'
import type {ApplicationUiState,ApplicationCommand,ApplicationShortcuts,ApplicationCloseHandlers} from './application'
import type {LegacySettings,SettingsPatch,SettingsState} from './settings'
import type {ExtractOrigin,OperationRequest,OperationOutcome} from './operations'
export type Kind = 'markdown' | 'text' | 'mermaid' | 'csv'
export type Encoding = 'utf8' | 'utf16le' | 'win1252'
export type CsvView='table'|'text'
export type CsvViewDecision='save'|'discard'
export interface CsvOpenError {path:string;name:string;message:string;reportedLine?:number;byteLength:number;textAllowed:boolean}
export const CSV_TEXT_LIMIT=10*1024*1024
export function isTableDocument(document:Pick<DocumentInfo,'kind'|'csvView'>){return document.kind==='csv'&&document.csvView!=='text'}
export interface DocumentInfo { id:string; name:string; path:string|null; kind:Kind; csvView?:CsvView;byteLength?:number;text?:string; dirty:boolean; readonly:boolean; warning?:string; revision:number; encoding:Encoding; delimiter:string; headers?:string[]; rowCount?:number; large?:boolean; extract?:ExtractOrigin }
export type AssetChange={from:number;to:number;insert:string}
export type SaveOutcome=DocumentInfo&{assets?:{copied:number;warnings:string[];changes:AssetChange[]}}
export interface TreeEntry { name:string; path:string; directory:boolean }
export interface TableSort {column:number;descending:boolean;numeric:boolean}
export type FilterOperator='contains'|'equals'|'notEquals'|'starts'|'ends'|'empty'|'notEmpty'|'greater'|'greaterEqual'|'less'|'lessEqual'|'dateBefore'|'dateOn'|'dateAfter'|'regex'
export interface TableFilter {column:number;op:FilterOperator;value?:string;caseSensitive?:boolean}
export interface TableConditionGroup {conditions:TableFilter[];filterMode:'all'|'any'}
export interface LargeViewQuery {search?:string;conditions?:TableFilter[];filterMode?:'all'|'any'}
export interface LargeViewRequest extends LargeViewQuery {requestId:string;revision:number}
export interface LargeViewState {requestId:string;revision:number;query:LargeViewQuery;status:'running'|'complete'|'cancelled'|'limit'|'invalidated'|'error';total:number;scanned:number;matched:number;fraction:number;elapsedMs:number;error?:string;limitReason?:'matches'|'memory'}
export interface TableQuery {viewId?:string;conditions?:TableFilter[];filterMode?:'all'|'any';order?:TableSort[]; search?:string; filters?:Record<string,string>; sort?:{column:number; descending:boolean; numeric:boolean}; offset:number; limit:number; requestId:number }
export interface TableRow { id:string; cells:string[] }
export interface TablePage { rows:TableRow[]; total:number; matched:number; revision:number; requestId:number; sample:boolean; large?:boolean;view?:LargeViewState }
export type TableViewMeta=Pick<TablePage,'matched'|'revision'|'requestId'|'sample'>&{query:TableQuery}
export interface TableRange {top:number;bottom:number;left:number;right:number;query:TableQuery;revision:number}
export interface TableRangeEdit {type:'range';requestId?:string;range:TableRange;operation:'fill'|'clear'|'trim'|'upper'|'lower'|'replace'|'paste';value?:string;find?:string;values?:string[][]}
export interface TableRangePreview {cells:number;changed:number;revision:number;samples:{row:number;column:number;before:string;after:string}[]}
export interface TableTransformEdit {type:'structure';operation:'split'|'combine'|'deduplicate'|'normalize'|'headers'|'moveRows'|'moveColumns'|'commitOrder';columns:number[];revision:number;requestId:string;separator?:string;name?:string;rowIds?:string[];range?:TableRange;destination?:number;query?:TableQuery}
export interface TableTransformPreview {revision:number;rows:number;affected:number;cells:number;addedColumns:number;deletedRows:number;changedHeaders:number;movedRows:number;movedColumns:number;samples:{row:number|null;column:number|null;before:string;after:string}[]}
export type TableEdit = TableRangeEdit | TableTransformEdit | {type:'cell'; rowId:string; column:number; value:string} | {type:'paste';rowId:string;column:number;values:string[][];view?:{query:TableQuery;revision:number}} | {type:'insertRow';afterId?:string;beforeId?:string} | {type:'deleteRows';ids:string[]} | {type:'duplicateRows';ids:string[]} | {type:'duplicateColumn';index:number} | {type:'insertColumn';index:number;name:string} | {type:'deleteColumn';index:number} | {type:'header';index:number;name:string} | {type:'replace';find:string;replacement:string;column?:number} | {type:'transform';operation:'trim'|'upper'|'lower';rowIds:string[];columns:number[]}
export interface TableStatsOptions {requestId:string;revision:number;range?:TableRange}
export interface TableStats { revision:number;sample:boolean;missing:number;whitespace:number;excluded:number;median:number|null;deviation:number|null;sampleDeviation:number|null;variance:number|null;sampleVariance:number|null;percentile10:number|null;percentile25:number|null;percentile75:number|null;percentile90:number|null;cells:number; empty:number; unique:number; numeric:number; sum:number|null; min:number|null; max:number|null; average:number|null }
export interface ColumnAnalysisRequest {column:number;otherColumn?:number;query?:TableQuery;revision:number;requestId:string;frequencyOffset:number;duplicatesOnly:boolean;bins:number}
export interface ColumnProfile {kind:'empty'|'identifier'|'number'|'date'|'category'|'text'|'mixed';dates:number;invalidDates:number;unsafeIntegers:number;identifierZeros:number;headerHint:boolean;distinctNonEmpty:number}
export interface ColumnAnalysis {
 profile:ColumnProfile;
 revision:number;sample:boolean;filtered:boolean;column:number;cells:number;empty:number;missing:number;whitespace:number;numeric:number;excluded:number;leadingZeros:number;unique:number;duplicateGroups:number;duplicateRows:number;extraDuplicates:number;minLength:number;maxLength:number;
 sum:number|null;average:number|null;min:number|null;max:number|null;median:number|null;deviation:number|null;sampleDeviation:number|null;variance:number|null;sampleVariance:number|null;percentile10:number|null;percentile25:number|null;percentile75:number|null;percentile90:number|null;
 frequencies:{value:string;truncated:boolean;count:number;firstRow:number;rowId:string}[];frequencyTotal:number;frequencyOffset:number;
 missingRows:{row:number;rowId:string}[];histogram:{lower:number;upper:number;count:number}[];
 correlation?:{column:number;pairs:number;omitted:number;value:number|null};warnings:string[]
}
export type ColumnOverviewResult=Pick<ColumnAnalysis,'profile'|'revision'|'sample'|'filtered'|'cells'|'empty'|'missing'|'whitespace'|'numeric'|'unique'|'extraDuplicates'>
export type ColumnOverviewRow={column:number;name:string}&({result:ColumnOverviewResult}|{error:string})
export interface SqlRequest {requestId:string;sources:{id:string;revision:number;query?:TableQuery;where?:TableConditionGroup}[];sql:string}
export interface SqlSource {id:string;name:string;revision:number;table:string;columns:{name:string;original:string;index:number}[];rows:number;fromDisk:boolean;large?:boolean;filtered?:boolean;where?:TableConditionGroup}
export interface SqlResult {requestId:string;sources:SqlSource[];version:string;columns:{name:string;type:string}[];rows:(string|null)[][];returnedRows:number;limited:boolean;offset:number;completedAt:string}
export interface SqlProgress {requestId:string;phase:string;rows:number}
export interface TableOptions { encoding?:Encoding; delimiter?:string; header?:boolean }
export interface TableExport { range?:TableRange; scope:'all'|'filtered'|'selection'; query?:TableQuery; rowIds?:string[]; columns?:number[]; delimiter?:string }
export interface ExportRequest { format:'pdf'|'html'|'svg'|'png'|'csv'|'tsv'; html?:string; svg?:string; table?:TableExport }
export interface ChartResultRequest {requestId:string;revision:number;configuration:ChartConfiguration;format:'csv'|'json'|'md';protectFormulas:boolean}
export interface GraphicExportRequest {format:'svg'|'png'|'pdf';svg:string;revision:number}
export interface RecoveryEntry { id:string; name:string; savedAt:string }
export interface AppEvent { type:'opened'|'changed'|'external'|'error'|'analysis'|'language'|'csv-open-error'|'settings'|'recents'|'close-status';closingKind?:'error'|'notice';csvOpenError?:CsvOpenError;settings?:SettingsState;language?:LanguageState;progress?:SqlProgress; document?:DocumentInfo; id?:string; message?:string }
export interface FreyaAPI {
 setApplicationState(state:ApplicationUiState):Promise<void>;applicationShortcuts():Promise<ApplicationShortcuts>;
 onCommand(callback:(command:ApplicationCommand,delegate:()=>void)=>void):()=>void;
 onPrepareClose(handlers:ApplicationCloseHandlers):()=>void;
 appInfo():Promise<ApplicationInfo>;copyAppInfo():Promise<void>;thirdPartyNotices():Promise<string>;
 settings():Promise<SettingsState>;setSettings(patch:SettingsPatch):Promise<SettingsState>;migrateSettings(values:LegacySettings):Promise<SettingsState>;
 resetSettings():Promise<SettingsState|null>;clearRecents():Promise<boolean>;showDataFolder():Promise<void>;
 language():Promise<LanguageState>;setLanguage(preference:LanguagePreference):Promise<LanguageState>;
 open():Promise<DocumentInfo[]>; openPaths(paths:string[]):Promise<DocumentInfo[]>; newDocument(kind:Kind):Promise<DocumentInfo>; folder():Promise<string|null>; tree(path:string):Promise<TreeEntry[]>; findFiles(root:string,query:string):Promise<{entries:TreeEntry[];limited:boolean}>; cancelFileSearch():Promise<void>; listTags(root:string):Promise<{tags:{tag:string;count:number}[];limited:boolean}>; cancelTagList():Promise<void>;
 csvOpen(path:string,view:CsvView):Promise<DocumentInfo>;csvView(id:string,view:CsvView,decision?:CsvViewDecision):Promise<DocumentInfo>;csvViewInfo(path:string):Promise<{byteLength:number;textAllowed:boolean}>;
 update(id:string,text:string):Promise<DocumentInfo>; save(id:string,as?:boolean):Promise<SaveOutcome|null>; locateImage(id:string,source:string):Promise<SaveOutcome|null>; close(id:string):Promise<boolean>; reload(id:string):Promise<DocumentInfo>; documents():Promise<DocumentInfo[]>;
 tableCopy(id:string,options:TableExport,format:'tsv'|'markdown'):Promise<void>; tablePaste(id:string,range:TableRange):Promise<string>;
 transformPreview(id:string,edit:TableTransformEdit):Promise<TableTransformPreview>;
 rangePreview(id:string,edit:TableRangeEdit):Promise<TableRangePreview>; rangeClipboard(id:string,range:TableRange):Promise<string>;
 tablePage(id:string,query:TableQuery):Promise<TablePage>; tableEdit(id:string,edit:TableEdit):Promise<DocumentInfo>; tableOptions(id:string,options:TableOptions):Promise<DocumentInfo>;
 tableViewStart(id:string,request:LargeViewRequest):Promise<LargeViewState>;tableViewState(id:string):Promise<LargeViewState|null>;tableViewCancel(id:string,requestId:string):Promise<LargeViewState|null>;tableViewClear(id:string):Promise<void>;
 chartPresets():Promise<ChartPreset[]>;saveChartPreset(id:string,input:{name:string;configuration:ChartConfiguration}):Promise<ChartPreset>;deleteChartPreset(id:string):Promise<void>;
 sqlRun(request:SqlRequest):Promise<SqlResult>;sqlPage(requestId:string,offset:number):Promise<SqlResult>;sqlCancel(requestId:string):Promise<void>;
 operation(id:string,request:OperationRequest):Promise<OperationOutcome>; cancelOperation(id:string,requestId:string):Promise<void>;
 analyzeColumn(id:string,request:ColumnAnalysisRequest):Promise<ColumnAnalysis>; cancelAnalysis(id:string,requestId:string):Promise<void>; cancelOpen(id:string):Promise<void>;
 undo(id:string,redo?:boolean):Promise<DocumentInfo>; stats(id:string,rows:string[]|null,columns:number[],options?:TableStatsOptions):Promise<TableStats>; tableMarkdown(id:string,options:TableExport):Promise<string>;
 exportChartResult(id:string,request:ChartResultRequest):Promise<string|null>;
 exportGraphic(id:string,request:GraphicExportRequest):Promise<string|null>;
 export(id:string,request:ExportRequest):Promise<string|null>; image(id:string,src:string):Promise<string|null>; openLink(url:string):Promise<void>;
 recents():Promise<string[]>; recoveries():Promise<RecoveryEntry[]>; recover(id:string):Promise<DocumentInfo>; discardRecovery(id:string):Promise<void>;
 onEvent(callback:(event:AppEvent)=>void):()=>void; droppedPaths(files:File[]):string[]
}
