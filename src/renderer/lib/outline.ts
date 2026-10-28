export type HeadingMetric={id:string;top:number}

export function currentHeading(metrics:readonly HeadingMetric[],scrollTop:number,viewportHeight:number,scrollHeight:number):string|undefined{
 if(!metrics.length)return
 if(scrollHeight>viewportHeight&&scrollTop+viewportHeight>=scrollHeight-1)return metrics.at(-1)!.id
 const threshold=scrollTop+0.3*viewportHeight
 let from=0,to=metrics.length
 while(from<to){
  const middle=Math.floor((from+to)/2)
  if(metrics[middle].top<=threshold)from=middle+1
  else to=middle
 }
 return metrics[from-1]?.id
}
