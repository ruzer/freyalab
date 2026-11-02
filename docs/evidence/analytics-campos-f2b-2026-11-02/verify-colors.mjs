import {readFile,writeFile} from 'node:fs/promises';
import {parseChromeColor,compositeChromeColor,chromeContrastRatio} from '/Users/ruzer/.codex/plugins/cache/openai-curated-remote/data-analytics/1.1.0-exp-baseline/templates/data-app/base/src/chrome-contrast.js';
const directory='/private/tmp/freyalab-f2b-evidence/closure/chart-fields-F2b-contraste-568e5-ondos-reales-en-ambos-temas-csv';
const background=colors=>colors.toReversed().reduce((base,value)=>{const color=parseChromeColor(value);if(!color)throw Error('Unrecognized color: '+value);return compositeChromeColor(color,base)},[255,255,255,1]);
const report={validator:'Data analytics chrome-contrast.js (development only)',themes:{}};
for(const theme of ['light','dark']){
 const colors=JSON.parse(await readFile(`${directory}/colors-${theme}.json`,'utf8'));
 const ratios=colors.map(item=>{const fill=background(item.backgrounds),surround=background(item.backgrounds.slice(1));return{label:item.label,text:chromeContrastRatio(compositeChromeColor(parseChromeColor(item.color),fill),fill),ui:item.border?Math.max(chromeContrastRatio(parseChromeColor(item.border),surround),chromeContrastRatio(fill,surround)):null}});
 const palette=theme==='dark'?['#308bff','#efa657','#a3c66d','#ff8a91','#6fc6de','#65cba8','#fcb07a','#c294ee']:['#007aff','#a05a00','#367220','#bc3447','#007f99','#00745c','#ac4c00','#8250b5'];
 const chartBackground=parseChromeColor(theme==='dark'?'#202024':'#f2f2f7');
 const series=palette.map(color=>({color,contrast:chromeContrastRatio(parseChromeColor(color),chartBackground)}));
 if(ratios.some(r=>r.text<4.5||r.ui!==null&&r.ui<3)||series.some(r=>r.contrast<3))throw Error('Contrast failure');
 report.themes[theme]={controls:ratios.length,minText:Math.min(...ratios.map(r=>r.text)),minUI:Math.min(...ratios.filter(r=>r.ui!==null).map(r=>r.ui)),minSeries:Math.min(...series.map(r=>r.contrast)),ratios,series};
}
await writeFile('/private/tmp/freyalab-f2b-evidence/colors-verified.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.themes).map(([k,v])=>[k,{nodes:v.controls,text:v.minText,ui:v.minUI,series:v.minSeries}]))));
