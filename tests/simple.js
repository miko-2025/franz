const {
	assemble,
	native,
	memory,

	FranzMachine,
	FranzProgram,

	MAILBOX,
	USER_CODE
} = require("franz");

const fs = require("fs/promises");
module.exports = async function(franz){ return ; // DISABLE FOR NOW
	console.log("[Franz] Running");
	console.log("[Franz] Kernel", franz._kernel);
	fs.writeFile("kernel_dump", franz._kernel);
	console.log("------------------");
	let asm;
	let program;
	try {
	program = new FranzProgram(franz, asm = `
.include "franz.inc"

.section .text
.global _start
_start:
	# --- PROLOGUE ---
	# Allocate 16 bytes on the stack and save the return address (ra).
	# Even though we only need 8 bytes, RISC-V requires 16-byte alignment.
	addi sp, sp, -16
	sd   ra, 8(sp)

	# --- BODY ---

	# 1. Print a welcome message
	la   a0, msg_start
	kcall UART_PUTS

	# 2. Check the CPU ISA
	kcall SYS_ISA
	# a0 now contains the ISA bitmask. Let's assume we just keep going.

	# 3. Perform a memory sync (Block 2)
	kcall FS_SYNC

	# 4. Print a closing message
	la   a0, msg_done
	kcall UART_PUTS

	# --- EPILOGUE ---
	# Restore the return address and clean up the stack.
	ld   ra, 8(sp)
	addi sp, sp, 16

	# Return to the kernel (or whoever called this payload)
	ret

# --- DATA ---
.section .rodata
msg_start: .asciz "Payload started. Accessing Franz ABI via s1...\\n"
msg_done:  .asciz "Task complete. Returning to kernel.\\n"
			`, "-- LD SCRIPT --" && `
ENTRY(_start)

SECTIONS
{
    . = 0x82100000;

    .text : {
        *(.text .text.*)
    }

    .rodata : {
        *(.rodata .rodata.*)
    }

    .data : {
        *(.data .data.*)
    }

    /DISCARD/ : {
        *(.eh_frame)
        *(.comment)
    }
}
	`);

	await program.task;

	} catch(err){
		await fs.writeFile(`${__dirname}/../test.log`, `${asm}`);
		console.log(err);
		console.log(`Check test.log`);

		return ;
	}

	//await fs.writeFile(`${__dirname}/test.bin`, `${program.mcode}`);

	franz.memory.push();

	setInterval(function(){
		franz.memory.push();
	}, 1000)
}
