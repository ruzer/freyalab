// Identificadores del modelo CSL JSON; no son etiquetas de la interfaz.
export const bibliographyTypes=['article','article-journal','article-magazine','article-newspaper','bill','book','broadcast','chapter','classic','collection','dataset','document','entry','entry-dictionary','entry-encyclopedia','event','figure','graphic','hearing','interview','legal_case','legislation','manuscript','map','motion_picture','musical_score','pamphlet','paper-conference','patent','performance','periodical','personal_communication','post','post-weblog','regulation','report','review','review-book','software','song','speech','standard','thesis','treaty','webpage'] as const
export type BibliographyType=typeof bibliographyTypes[number]
export const citationStyleIds=['apa','ieee','vancouver','chicago','mla'] as const
export type CitationStyleId=typeof citationStyleIds[number]
export interface BibliographyName {
 family?:string;given?:string;literal?:string;suffix?:string
 'dropping-particle'?:string;'non-dropping-particle'?:string
 'comma-suffix'?:string|number|boolean;'static-ordering'?:string|number|boolean;'parse-names'?:string|number|boolean
}
export interface BibliographyDate {
 'date-parts'?:(string|number)[][]
 literal?:string;raw?:string;season?:string|number;circa?:string|number|boolean
}
export interface BibliographyEntry {
 id:string|number;type:BibliographyType;title?:string;author?:BibliographyName[];issued?:BibliographyDate
 [field:string]:unknown
}
export type BibliographyErrorCode='invalid-path'|'outside'|'unavailable'|'not-file'|'too-large'|'changed'|'encoding'|'syntax'|'schema'|'duplicate-id'|'pandoc-required'
export interface BibliographyError {
 code:BibliographyErrorCode;message:string
 location?:{line:number;column:number}
 entry?:number;field?:string
}
export type DocumentBibliography={ok:true;entries:BibliographyEntry[];bytes:number;sha256:string}|{ok:false;error:BibliographyError}
