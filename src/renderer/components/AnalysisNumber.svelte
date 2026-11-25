<script lang="ts">
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {formatAnalysisNumber,formatAnalysisFullNumber,type AnalysisNumberMode,type AnalysisNumberKind} from '../../shared/analysis-number-format'
 let {value,mode='auto',unit='',kind='number'}:{value:number|string;mode?:AnalysisNumberMode;unit?:string;kind?:AnalysisNumberKind}=$props()
 const number=$derived(typeof value==='number'?value:Number(value))
 const display=$derived(formatAnalysisNumber(number,mode,getUILanguage(),kind))
</script>
<span data-analysis-value={Number.isFinite(number)?String(value):undefined} data-analysis-unit={unit} title={t('columnAnalysis.exactValue',{value:formatAnalysisFullNumber(value,unit)})}>{display}{unit}</span>
