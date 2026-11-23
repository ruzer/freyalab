<script lang="ts">
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {formatAnalysisNumber,formatAnalysisFullNumber,type AnalysisNumberMode} from '../../shared/analysis-number-format'
 let {value,mode=2,unit=''}:{value:number;mode?:AnalysisNumberMode;unit?:string}=$props()
 const display=$derived(formatAnalysisNumber(value,mode,getUILanguage()))
</script>
<span data-analysis-value={Number.isFinite(value)?String(value):undefined} data-analysis-unit={unit} title={t('columnAnalysis.exactValue',{value:formatAnalysisFullNumber(value,unit)})}>{display}{unit}</span>
