/* Test harness for the official SplitMix64 reference implementation.
   The official file is included unmodified (see README.md); this file only adds main(). */

#include "splitmix64.c"

#include <inttypes.h>
#include <stdio.h>

static void print_seed(uint64_t seed) {
	x = seed;
	printf("seed %" PRIu64 ":\n", seed);
	for (int i = 1; i <= 1000; i++) {
		const uint64_t z = next();
		if (i <= 4 || i == 1000)
			printf("  #%-4d 0x%016" PRIx64 "\n", i, z);
	}
}

int main(void) {
	print_seed(0);
	print_seed(1);
	print_seed(42);
	print_seed(4294967295u);
	return 0;
}
