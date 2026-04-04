const {
	assemble,
	native,
	memory,

	FranzMachine,
	FranzProgram,
	FranzMono,

	MAILBOX,
	USER_CODE,
	kill
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
module.exports = async function(franz){
	let programs = [];
	programs.push(new FranzMono(franz, asm = `
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
	kcall PL_CH_MSG_NEW

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



	programs.push(new FranzMono(franz, asm = `
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

	let lock = 0;
	async function restart(){
		if(lock == 1)
			return console.log("COLLISION");

		lock = 1;
		await franz.kill();
		franz.run();
		await events.once(franz, "run");
		console.log("RESTART");
		lock = 0;
	}

	let i = 0;
	let total = 1;
	let last = franz.memory.offsetOne();
	console.log("-------------------------- LAST\n\n", last);

	setInterval(function(){
		i++;
		//franz.memory.push();
	}, 6000);
	async function ctxsw(){
		console.log("Swapping to program", i % total);
		const program = programs[i % total];
		//const program = programs[0];
		const task = events.once(program, "load");
		program.load();
		await task;
		await restart();
		await franz.memory.push();
		//franz.memory.inspect();
	}


	let current = 0;
	franz.on("api", function(...args){
		console.log("API", args);
	});

	let wo = 0;
	franz.on("api.8000333c", async function(){
		//if(wo)
		//	return ;
		console.log("NEW STRING API CALLED");
		//await new Promise(function(res){ setTimeout(res, 2000) });
		await franz.interrupt();
		await franz.memory.writeAPI("Hello from API\n");
		//wo = 1;
	});

	programs[i].once("ready", function(){
		programs[i].load();
	});

	let stamp = Date.now();

	programs[i].once("load", async function(){
		franz.memory.push();
		//await new Promise(function(rs){ setTimeout(rs, 3000) })
		setTimeout(async function f(){
			//console.log("beat", franz.memory.offsetOne(), i, stamp);
			if((current = franz.memory.offsetOne()) == last){
				if(Date.now() < stamp + 3000)
					return setTimeout(f, 100);
			}

			stamp = Date.now();

			await ctxsw();
			//current = franz.memory.offsetOne();
			last = current;
			setTimeout(f, 100);
		}, 100);
	});
}
