"""Independent integer calculation. No product imports; no generated product tests."""
from pathlib import Path
import hashlib,json
base=Path(__file__).parent
M=2**64
G=0x9e3779b97f4a7c15
words=[]
for p in range(1,8):
    state=(7+p*G)%M
    a=((state^(state>>30))*0xbf58476d1ce4e5b9)%M
    b=((a^(a>>27))*0x94d049bb133111eb)%M
    value=b^(b>>31)
    words.append({'position':p,'state':f'{state:016x}','firstProduct':f'{a:016x}','secondProduct':f'{b:016x}','word':f'{value:016x}','decimal':str(value)})
reference=[line.split() for line in (base/'reference-c-output.txt').read_text().splitlines()]
assert len(reference)==7
for record,row in zip(words,reference):
    assert [str(record['position']),record['state'],record['word'],record['decimal']]==row
ids=['00123','00124','9007199254740993','00126','00127','00128','00129']
reservoir=[1,2,3]
steps=[]
for i,record in zip(range(4,8),words):
    value=int(record['decimal']); limit=M-M%i
    assert value<limit # none of these four fixed draws needs rejection
    q,j=divmod(value,i)
    before=reservoir[:]
    if j<3:reservoir[j]=i
    steps.append({'inputPosition':i,'word':record['word'],'decimal':record['decimal'],'limit':str(limit),'quotient':str(q),'remainder':j,'before':before,'after':reservoir[:],'replaced':j<3})
selected=sorted(reservoir)
percent=[record['position'] for record in words if int(record['decimal'])<M//2]
fixture='''ID,Entidad,Edad,Ingreso,Nota
00123,Oaxaca,34,1200,"línea 1
línea 2"
00124,Oaxaca,17,0,
9007199254740993,Puebla,45,3400,ok
00126,Oaxaca,52,,ok
00127,Chiapas,29,2100,ok
00128,Oaxaca,61,5000
00129,Puebla,15,0,ok
'''
(base/'prj02-censo-reference.csv').write_bytes(fixture.encode('utf-8'))
result={'semantics':1,'seed':7,'source':'prj02-censo-reference.csv','sourceBytes':len(fixture.encode('utf-8')),'sourceSha256':hashlib.sha256(fixture.encode('utf-8')).hexdigest(),'words':words,'reservoirRows3':{'initialPositions':[1,2,3],'steps':steps,'finalSlots':reservoir,'outputPositions':selected,'outputIds':[ids[p-1] for p in selected]},'percent50':{'threshold':str(M//2),'thresholdHex':'8000000000000000','comparison':'unsigned hash < threshold','outputPositions':percent,'outputIds':[ids[p-1] for p in percent]},'verification':{'referenceWords':7,'sameAsC':True,'productCodeImported':False,'productEngineExecuted':False}}
(base/'seed7-vectors.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'referenceWords':7,'CMatches':True,'reservoirRows3':result['reservoirRows3'],'percent50':result['percent50'],'sourceBytes':result['sourceBytes'],'sourceSha256':result['sourceSha256']},ensure_ascii=False,indent=2))
