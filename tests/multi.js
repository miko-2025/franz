const {
	assemble,
	native,
	memory,

	FranzMachine,
	FranzProgram,
	FranzMono,

	MAILBOX,
	USER_CODE
} = require("franz");

const fs = require("fs/promises");
const events = require("events");
const ld = `
ENTRY(_start)

SECTIONS
{
    . = 0x82100000;

    .text : ALIGN(4) {
    	*(.text._start)
        *(.text .text.*)
    }

    .rodata : ALIGN(8) {
        *(.rodata .rodata.*)
    }

    .data : ALIGN(8) {
        *(.data .data.*)
    }

    .bss : ALIGN(8) {
        *(.bss .bss.*)
        *(COMMON)
    }

    /DISCARD/ : {
        *(.eh_frame)
        *(.comment)
    }

    . = ALIGN(4);
}
`;
module.exports = async function(franz){ return ;
	let programs = [];
	noabi(franz, programs);

	false && programs.push(new FranzMono(franz, asm = `
.include "franz.inc"
.section .text._start
.global _start

_start:
	# --- PROLOGUE ---
	# Allocate 16 bytes on the stack and save the return address (ra).
	# Even though we only need 8 bytes, RISC-V requires 16-byte alignment.
	addi sp, sp, -16
	sd   ra, 8(sp)

	kcall FS_SYNC

	la   a0, hello_msg
	kcall UART_PUTS

	# --- EPILOGUE ---
	# Restore the return address and clean up the stack.
	ld   ra, 8(sp)
	addi sp, sp, 16

	# Return to the kernel (or whoever called this payload)
	ret


.section .rodata
.align 8
hello_msg: .asciz "Kernel: UART Hardware Test OK\\n"
	`, ld));



	false && programs.push(new FranzMono(franz, asm = `
.include "franz.inc"

.section .text._start
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
msg_done:  .asciz "TASK 2 OK\\n"
			`, ld
	));

	false && programs.push(new FranzMono(franz, asm = `
.include "franz.inc"

.section .text._start
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
msg_done:  .asciz "TASK 3 OK\\n"
			`, ld
	));

	let i = 0;
	let total = 1;

	setInterval(function(){
		i++;
		franz.memory.push();
	}, 6000);
	async function ctxsw(){
		console.log("Swapping to program", i % total);
		const program = programs[i % total];
		//const program = programs[0];
		const task = events.once(program, "load");
		program.load();
		await task;
		await franz.memory.push();
		await new Promise(function(rs){ setTimeout(rs, 50) })
		//franz.memory.inspect();
	}

	let current = 0;
	let last = 0;

	programs[i].once("ready", function(){
		programs[i].load();
	});

	programs[i].once("load", function(){
		franz.memory.push();

		setTimeout(async function f(){
			console.log("beat", franz.memory.offsetOne(), i);
			if((current = franz.memory.offsetOne()) == last){
				return setTimeout(f, 50);
			}

			await ctxsw();
			//current = franz.memory.offsetOne();
			last = current;
			setTimeout(f, 50);
		}, 100);
	});
}

function noabi(franz, programs){
	programs.push(new FranzMono(franz, `
.section .text
.global _start

_start:
    # We assume UART at 0x10000000 is ALREADY init by Franz
    li t5, 0x10000000     
    
    # Get PC-relative string address
    auipc a0, 0
    addi a0, a0, 32       # Jump over the code to the string

print_char:
    lbu t0, 0(a0)         # Get char
    beqz t0, done         # End on null

wait_ready:
    lbu t1, 5(t5)         # Check Line Status Register
    andi t1, t1, 0x20     # Is THRE (Transmit Holding Reg Empty) bit set?
    beqz t1, wait_ready   # If not, spin

    sb t0, 0(t5)          # SEND IT
    addi a0, a0, 1        # Next char
    j print_char

done:
    # Instead of jumping back (which might be broken), 
    # we'll just wait for the next "swap" command
    ret

.align 4
msg:
    .asciz "\r\n>>> FRANZ PAYLOAD RUNNING STABLY <<<\r\n"
    	`, ld))
}
