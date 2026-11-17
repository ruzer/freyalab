# Independent arithmetic reference: no imports from FreyaLab, direct (seed + draw*gamma) states.
M=2**64
G=0x9e3779b97f4a7c15

def word(seed,draw):
    z=(seed+draw*G)%M
    z=((z^(z//2**30))*0xbf58476d1ce4e5b9)%M
    z=((z^(z//2**27))*0x94d049bb133111eb)%M
    return z^(z//2**31)

def reservoir(items,k,seed):
    slots=list(enumerate(items[:k]))
    draw=0
    for arrival,item in enumerate(items[k:],start=k):
        n=arrival+1
        while True:
            draw+=1
            r=word(seed,draw)
            if r < M-M%n:
                break
        j=r%n
        print('arrival',n,'word',f'{r:016x}','remainder',j)
        if j<k:
            slots[j]=(arrival,item)
    return [item for _,item in sorted(slots)]

print('negative seed words', [f'{word(-1,n):016x}' for n in range(1,5)])
print('reservoir(-1,2,[A..E])',reservoir(list('ABCDE'),2,-1))
print('percent(-1,50,[1..7])',[p for p in range(1,8) if word(-1,p)<M//2])
print('repeated seed0 reservoir after reverse',reservoir(list('EDCBA'),2,0))
