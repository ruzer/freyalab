/* Independent reference calculation, not FreyaLab product code.
 * SplitMix64 function from Sebastiano Vigna's public-domain reference (2015):
 * https://prng.di.unimi.it/splitmix.c
 * The author dedicated all copyright and neighboring rights to the public domain.
 * Driver below sets seed 7 and prints seven outputs; no FreyaLab imports.
 */
#include <stdint.h>
#include <stdio.h>
#include <inttypes.h>
static uint64_t x;
static uint64_t next(void) {
    uint64_t z = (x += UINT64_C(0x9e3779b97f4a7c15));
    z = (z ^ (z >> 30)) * UINT64_C(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)) * UINT64_C(0x94d049bb133111eb);
    return z ^ (z >> 31);
}
int main(void) {
    x = 7;
    for (unsigned i=1; i<=7; ++i) {
        uint64_t value=next();
        printf("%u %016" PRIx64 " %016" PRIx64 " %" PRIu64 "\n",i,x,value,value);
    }
    return 0;
}
