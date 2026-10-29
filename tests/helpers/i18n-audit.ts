import ts from 'typescript'
import {parse} from 'svelte/compiler'
import {readdir} from 'node:fs/promises'
import {join,relative,sep} from 'node:path'
const attributes=new Set(['aria-label','aria-description','title','placeholder','alt','label'])
const properties=new Set(['label','title','message','hint','description','reason','placeholder','buttons','buttonLabel'])
const calls=new Set(['error','notify','onerror','onstatus','alert'])
const unit=/^(?:[\d.,+-]+\s*)?(?:px|[KMGT]?i?B|ms|s|%)$/
export function visibleLiterals(path:string,source:string):string[] {
 const found=new Set<string>(),bindings=new Map<string,ts.Expression>()
 const add=(value:string)=>{const text=value.trim().replace(/\s+/g,' ');if(/\p{L}/u.test(text)&&!unit.test(text))found.add(text)}
 function strings(node:ts.Node|undefined,seen=new Set<string>()):string[]{
  if(!node)return[]
  if(ts.isStringLiteralLike(node))return[node.text]
  if(ts.isTemplateExpression(node))return[node.head.text,...node.templateSpans.map(span=>span.literal.text)]
  if(ts.isArrayLiteralExpression(node))return node.elements.flatMap(value=>strings(value,seen))
  if(ts.isConditionalExpression(node))return[...strings(node.whenTrue,seen),...strings(node.whenFalse,seen)]
  if(ts.isParenthesizedExpression(node))return strings(node.expression,seen)
  if(ts.isIdentifier(node)&&!seen.has(node.text)){seen.add(node.text);return strings(bindings.get(node.text),seen)}
  if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.PlusToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind))return[...strings(node.left,seen),...strings(node.right,seen)]
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='$state')return strings(node.arguments[0],seen)
  return[]
 }
 function script(value:string){
  const tree=ts.createSourceFile(path,value,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  function collect(node:ts.Node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)bindings.set(node.name.text,node.initializer);ts.forEachChild(node,collect)}
  collect(tree)
  function visit(node:ts.Node){
   if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Error')strings(node.arguments?.[0]).forEach(add)
   if(ts.isPropertyAssignment(node)&&properties.has(node.name.getText(tree).replace(/^['"]|['"]$/g,'')))strings(node.initializer).forEach(add)
   if(ts.isCallExpression(node)){
    if(ts.isIdentifier(node.expression)&&calls.has(node.expression.text))strings(node.arguments[0]).forEach(add)
    if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='showErrorBox')node.arguments.flatMap(value=>strings(value)).forEach(add)
    if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='push'&&/(?:^|\.)warnings$/.test(node.expression.expression.getText(tree)))node.arguments.flatMap(value=>strings(value)).forEach(add)
   }
   ts.forEachChild(node,visit)
  }
  visit(tree)
 }
 // Los identificadores, rutas, código del documento y unidades no son catálogos de interfaz.
 function expression(node:any):string[]{
  if(!node)return[]
  if(node.type==='Literal'&&typeof node.value==='string')return[node.value]
  if(node.type==='TemplateLiteral')return node.quasis.map((part:any)=>part.value.cooked??part.value.raw)
  if(node.type==='ConditionalExpression')return[...expression(node.consequent),...expression(node.alternate)]
  if(node.type==='LogicalExpression'||node.type==='BinaryExpression'&&node.operator==='+')return[...expression(node.left),...expression(node.right)]
  if(node.type==='Identifier')return strings(bindings.get(node.name))
  return[]
 }
 function markup(node:any){
  if(!node||typeof node!=='object')return
  if(node.type==='Text'){add(node.data??node.raw??'');return}
  if(node.type==='Attribute'){
   if(attributes.has(node.name))for(const value of Array.isArray(node.value)?node.value:[node.value])if(value?.type==='Text')add(value.data??value.raw??'');else expression(value?.expression).forEach(add)
   return
  }
  if(node.type==='ExpressionTag'){expression(node.expression).forEach(add);return}
  if(node.type==='Property'&&properties.has(node.key?.name??node.key?.value))expression(node.value).forEach(add)
  for(const [key,value] of Object.entries(node))if(!['loc','name_loc','comments'].includes(key)){
   if(Array.isArray(value))value.forEach(markup);else if(value&&typeof value==='object')markup(value)
  }
 }
 if(path.endsWith('.svelte')){
  const tree=parse(source,{modern:true})
  for(const block of [tree.module,tree.instance])if(block){const content=block.content as typeof block.content&{start:number;end:number};script(source.slice(content.start,content.end))}
  markup(tree.fragment)
 }else script(source)
 return[...found]
}
export async function sourceFiles(root:string):Promise<string[]> {
 const files:string[]=[]
 async function visit(directory:string){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await visit(path);else if(/\.(?:ts|svelte)$/.test(entry.name)&&!entry.name.endsWith('.d.ts'))files.push(relative(root,path).split(sep).join('/'))}}
 await visit(join(root,'src'));return files.sort()
}
export function pendingIssues(pending:readonly string[],initial:readonly string[],sources:ReadonlyMap<string,string>):string[] {
 const allowed=new Set(pending),original=new Set(initial),issues=pending.filter(path=>!original.has(path)).map(path=>`La lista pendiente creció: ${path}`)
 for(const [path,source] of sources)if(!allowed.has(path))for(const value of visibleLiterals(path,source))issues.push(`${path}: ${value}`)
 return issues
}
