/* Test harness for the official SplitMix64 reference implementation.
   The official file is included unmodified (see README.md); this file only adds main(). */

#include "splitmix64.c"

#include <inttypes.h>
#include <stdio.h>

static void print_outputs(void) {
	for (int i = 1; i <= 1000; i++) {
		const uint64_t z = next();
		if (i <= 4 || i == 1000)
			printf("  #%-4d 0x%016" PRIx64 "\n", i, z);
	}
}

static void print_seed(uint64_t seed) {
	x = seed;
	printf("seed %" PRIu64 ":\n", seed);
	print_outputs();
}

/* Named stream input (streamId << 32) | seed, and the xoshiro128** state it expands to:
   the first two outputs split low 32 bits, then high 32 bits (ADR-0004, ADR-0006). */
static void print_stream(uint32_t stream_id, uint32_t seed) {
	const uint64_t input = ((uint64_t)stream_id << 32) | seed;
	x = input;
	const uint64_t z1 = next();
	const uint64_t z2 = next();
	printf("stream %" PRIu32 " seed %" PRIu32 " (input %" PRIu64 " = 0x%016" PRIx64 "):\n",
		stream_id, seed, input, input);
	printf("  state = { 0x%08" PRIx32 ", 0x%08" PRIx32 ", 0x%08" PRIx32 ", 0x%08" PRIx32 " }\n",
		(uint32_t)z1, (uint32_t)(z1 >> 32), (uint32_t)z2, (uint32_t)(z2 >> 32));
	x = input;
	print_outputs();
}

int main(void) {
	print_seed(0);
	print_seed(1);
	print_seed(42);
	print_seed(4294967295u);
	print_stream(1, 42);
	print_stream(2, 42);
	print_stream(1, 0);
	print_stream(1, 4294967295u);
	return 0;
}
