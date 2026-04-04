#include "franz.h"
#include <unistd.h>
#include <stdio.h>

/*void test_serial(const char *out, int32_t channel, size_t len, void *user) {
	printf("%.*s", (int)len, out);
}*/

void test_serial(const char * restrict out, int32_t channel, size_t len, void *user) {
    if (out && len > 0) {
        // Use write() for unbuffered output to the terminal
        write(STDOUT_FILENO, out, len);
    }
}

#include <stdio.h>
#include <stdlib.h>

char* read_payload_to_buffer(const char* filename, size_t* out_size) {
	FILE* file = fopen(filename, "rb");
	if (!file) {
		perror("Error opening binary file");
		return NULL;
	}

	// 1. Determine file size
	fseek(file, 0, SEEK_END);
	long size = ftell(file);
	fseek(file, 0, SEEK_SET);

	if (size <= 0) {
		fclose(file);
		return NULL;
	}

	// 2. Allocate buffer (char is 1 byte, perfect for raw binary)
	char* buffer = (char*)malloc(size);
	if (!buffer) {
		perror("Memory allocation failed");
		fclose(file);
		return NULL;
	}

	// 3. Read data into buffer
	size_t bytes_read = fread(buffer, 1, size, file);
	if (bytes_read != (size_t)size) {
		perror("Error reading file");
		free(buffer);
		fclose(file);
		return NULL;
	}

	fclose(file);
	*out_size = (size_t)size;
	return buffer;
}

int main(){
	// Basic NOP loop for RISC-V: 0x00000013 (nop), 0x0000006f (j .)
	//const char mcode[] = {0x13, 0x00, 0x00, 0x00, 0x6f, 0x00, 0x00, 0x00};

	size_t size = 0;
	unsigned char *mcode = franz_riscv_assemble(
".section .text\n"
".global _start\n"

"_start:\n"
"    li t0, 0x10000000    # UART Base Address from your log\n"
"    li t1, 33            # ASCII for '!'\n"
"    sb t1, 0(t0)         # Write to UART\n"

"loop:\n"
"    wfi                  # Wait for interrupt\n"
"    j loop\n"
"",""
"OUTPUT_ARCH( \"riscv\" )\n"
"ENTRY( _start )\n"
"SECTIONS\n"
"{\n"
"	. = 0x80200000;\n"
"	.text : {\n"
"	        KEEP(*(.text.header))\n"
"		*(.text .text.*)\n"
"	}\n"
"	.rodata : {\n"
"		. = ALIGN(16);\n"
"		*(.rodata .rodata.*)\n"
"	}\n"
"	.data : {\n"
"		. = ALIGN(16);\n"
"		*(.data .data.*)\n"
"	}\n"
"	.bss : {\n"
"		. = ALIGN(16);\n"
"		*(.bss .bss.*)\n"
"		*(COMMON)\n"
"	}\n"
"	_end = .;\n"
"}"
"",
	&size);

	//char *mcode = read_payload_to_buffer("franz_payload.bin", &size);
	printf("Starting Standalone Franz...\n");
	franz_riscv_run(mcode, size, test_serial, NULL);

	return 0;
}
