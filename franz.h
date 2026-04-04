#ifndef FRANZ_H
#define FRANZ_H
#include <stdint.h>
/*
    File: Franz RISC-V Subsystem
    Core execution and memory interfaces.
*/
/*
    Function: franz_riscv_run
    Executes RISC-V machine code within a controlled environment.

    Parameters:
        mcode - Pointer to the raw binary machine code.
        mcode_size - Size of the executable machine code in bytes.
        serial - Callback for handling output streams.
        user - User context pointer.
*/
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

/*
    Function: franz_riscv_assemble
    Assembles RISC-V source into executable machine code.
*/
unsigned char *franz_riscv_assemble(
	const char *assembly,
	const char* ld,
	size_t *out_size
);

/*
    Function: franz_shmem_getptr
    Retrieves the base pointer for the shared memory region.
*/
void *franz_shmem_getptr();

/*
    Function: franz_riscv_kill
    Terminates a specific RISC-V execution context.
*/
void franz_riscv_kill(int64_t id);

/*
    Function: franz_shmem_flush
    Synchronizes or flushes the shared memory region to ensure 
    data consistency between the host and the RISC-V context.

    Parameters:
        ptr - Pointer to the memory region to be flushed.
*/
void franz_shmem_flush(void *ptr);
#endif
