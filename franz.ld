OUTPUT_ARCH( "riscv" )
ENTRY( _start )

SECTIONS
{
	/* OpenSBI jumps here */
	/*. = 0x80200000;*/
	. = 0x80000000;

	/* 1. Executable Code */
	.text : {
	        KEEP(*(.text.header))  /* KEEP ensures it isn't garbage collected */
		*(.text .text.*)
	}

	/* 2. Read-Only Data (Your Strings!) */
	.rodata : {
		. = ALIGN(16);
		*(.rodata .rodata.*)
	}

	/* 3. Global Data */
	.data : {
		. = ALIGN(16);
		*(.data .data.*)
	}

	.kernel_abi : {
		. = ALIGN(4096);
		PROVIDE(kernel_api_table = .);
		KEEP(*(.kernel_abi))
		BYTE(0xDEADBEEF) /* Force the linker to allocate at least one real byte here */
	}

	/* 4. Zero-initialized Data (Stack/Heap space) */
	.bss : {
		. = ALIGN(16);
		*(.bss .bss.*)
		*(COMMON)
	}

	/* Keep track of the end of the binary */
	_end = .;
}
