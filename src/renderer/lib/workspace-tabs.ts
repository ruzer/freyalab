export type AnalysisSource = {documentId:string}
export type AnalysisSection = 'info'|'statistics'|'charts'|'sql'
export type AnalysisStatistics = {scope:'all'|'selected'|'range'|'rangeColumns'}
export type AnalysisTab = {type:'analysis';id:string;source:AnalysisSource;section:AnalysisSection;statistics?:AnalysisStatistics}
export type WorkspaceTab = {type:'document';id:string}|AnalysisTab

export function workspaceTabs(documents:readonly {id:string}[],analyses:readonly AnalysisTab[]):WorkspaceTab[]{
 const byDocument=new Map(analyses.map(tab=>[tab.source.documentId,tab]))
 return documents.flatMap(({id}):WorkspaceTab[]=>{
  const document={type:'document',id} as const,analysis=byDocument.get(id)
  return analysis?[document,analysis]:[document]
 })
}

export function openAnalysisTab(tabs:readonly AnalysisTab[],source:AnalysisSource,section:AnalysisSection,statistics?:AnalysisStatistics){
 const id='analysis:'+source.documentId
 const tab:AnalysisTab={type:'analysis',id,source,section,...statistics?{statistics}:{}}
 return {tab,tabs:tabs.some(value=>value.id===id)?tabs.map(value=>value.id===id?tab:value):[...tabs,tab]}
}

export function closeDocumentAnalysis(tabs:readonly AnalysisTab[],documentId:string){
 return tabs.filter(tab=>tab.source.documentId!==documentId)
}
