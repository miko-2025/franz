#ifndef FRANZ_H
#define FRANZ_H
#include <stdint.h>
#include <stddef.h>

void franz_riscv_run(
	const char * restrict mcode,
	size_t mcode_size,
	void (*serial)(
		const char * restrict out,
		int32_t channel,
		size_t len,
		void *user
	),
	void *user
);

unsigned char *franz_riscv_assemble(const char *assembly,
	const char* ld,
	size_t *out_size
);

void *franz_shmem_getptr();
void franz_riscv_kill(int64_t id);
void franz_shmem_flush(void *ptr);
#endif
