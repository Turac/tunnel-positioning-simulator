/* Test harness for the official xoshiro128** 1.1 reference implementation.
   The official file is included unmodified (see README.md); this file only adds main(). */

#include "xoshiro128starstar.c"

#include <inttypes.h>
#include <stdio.h>

static void print_vector(const char *name, uint32_t a, uint32_t b, uint32_t c, uint32_t d) {
	s[0] = a; s[1] = b; s[2] = c; s[3] = d;
	printf("%s: state = { 0x%08" PRIx32 ", 0x%08" PRIx32 ", 0x%08" PRIx32 ", 0x%08" PRIx32 " }\n",
		name, a, b, c, d);
	for (int i = 1; i <= 1000; i++) {
		const uint32_t x = next();
		if (i <= 10 || i == 1000)
			printf("  #%-4d 0x%08" PRIx32 "  %10" PRIu32 "\n", i, x, x);
	}
}

int main(void) {
	print_vector("A", 1, 2, 3, 4);
	print_vector("B", 0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x6a09e667);
	/* State produced by seeding with 42 (splitmix64, low-then-high words; see ADR-0004). */
	print_vector("SEED42", 0x2feb6e95, 0xbdd73226, 0xb266f103, 0x28efe333);
	return 0;
}
