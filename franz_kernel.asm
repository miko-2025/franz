# =========================================================
# FRANZ KERNEL
# =========================================================
.section .text.header
.global _start
_start:
	# Enable Machine Software Interrupts (bit 3)
	li   t0, 0x8
	csrs mie, t0
	# Enable Global Interrupts (bit 3 of mstatus)
	csrsi mstatus, 0x8

	# Open the floodgates for ALL memory (R, W, X)
	li t0, -1
	csrw pmpaddr0, t0      # Range: All 64-bit space
	li t1, 0x1f            # 0x1f = NAPOT | R | W | X
	csrw pmpcfg0, t1

	# 1. IMMEDIATE REGISTER CAPTURE
	# We grab these before any other instruction can touch them
	la t0, _start
	csrw mtvec, t0

	# 2. CAPTURE FAULT DATA (The Diagnostic Reporter)
	# If we just jumped here because of a trap, these will be non-zero
	csrr t0, mcause
	csrr t1, mepc
	csrr t2, mtval      # THIS IS KEY: It shows the "Bad Address" (like 0)

	#csrr t0, scause
	#csrr t1, sepc
	#csrr t2, stval      # Very useful for seeing the bad instruction/address

	# 2. COLD BOOT CHECK
	# If scause is 0, we assume a fresh start and skip the crash dump
	li t5, 0x10000000
	beqz t0, cold_boot

	# 3. LINEAR CRASH DUMP (No Jumps, No Subroutines)
	# UART Base is 0x10000000

	# Print "[!] TRAP: "
	li t3, 91;  sb t3, 0(t5) # [
	li t3, 33;  sb t3, 0(t5) # !
	li t3, 93;  sb t3, 0(t5) # ]
	li t3, 32;  sb t3, 0(t5) #  
	li t3, 84;  sb t3, 0(t5) # T
	li t3, 82;  sb t3, 0(t5) # R
	li t3, 65;  sb t3, 0(t5) # A
	li t3, 80;  sb t3, 0(t5) # P
	li t3, 58;  sb t3, 0(t5) # :
	li t3, 32;  sb t3, 0(t5) #  

	# --- PRINT SCAUSE (t0) ---
	li s1, 60            # Shift amount for hex nibbles

print_scause_loop:
	srl s2, t0, s1       # Get nibble
	andi s2, s2, 0xF
	li s3, 10
	blt s2, s3, 1f
	addi s2, s2, 7       # Hex A-F adjustment
1:  addi s2, s2, 48      # ASCII '0' adjustment
	sb s2, 0(t5)         # Send to UART
	addi s1, s1, -4
	bgez s1, print_scause_loop

	# Print " @ "
	li t3, 32;  sb t3, 0(t5)
	li t3, 64;  sb t3, 0(t5)
	li t3, 32;  sb t3, 0(t5)

	# --- PRINT SEPC (t1) ---
	li s1, 60

print_sepc_loop:
	srl s2, t1, s1
	andi s2, s2, 0xF
	li s3, 10
	blt s2, s3, 2f
	addi s2, s2, 7
2:  addi s2, s2, 48
	sb s2, 0(t5)
	addi s1, s1, -4
	bgez s1, print_sepc_loop

	# Final Newline
	li t3, 10;  sb t3, 0(t5) # \n
	li t3, 13;  sb t3, 0(t5) # \r

	# Clear scause so we don't loop on the next reset
	csrw scause, zero

cold_boot:
	# 1. Setup Stack
	li	 sp, 0x80400000

	# 3. Initialize Mailbox & State
	li	 s0, 0x82000000		   # Mailbox Base Address
	sd	 zero, 0(s0)		   # Wipe mailbox clean at boot
	sd	 zero, 1(s0)		   # Wipe mailbox clean at boot
	fence iorw, iorw
	li	 s4, 0

	# 2. Print Boot Banner
	la	 a0, msg_banner
	la	 t3, print_string
	jalr ra, t3

	li a0, '#'
	#sb a0, 0(t5)

	# 4. Enter the dispatch loop
	j	 dispatch_loop

# =========================================================
# DISPATCH LOOP (Edge-Triggered Sequence Polling)
# =========================================================
dispatch_loop:
	li	 s0, 0x82000000		   # Ensure s0 is pointing to mailbox

.Lpoll:
	li a0, 'L'
	#sb a0, 0(t5)
	fence iorw, iorw		   # Force memory sync
	lbu	 t1, 0(s0)			   # Read current Task ID from host

	# THE CHECK: Wait if the Task ID matches the last processed ID
	beq	 t1, s4, .Lpoll		  

	# OVERFLOW / RESET CONDITION
	# If the new ID is strictly less than the last processed ID, an
	# integer overflow (e.g., 255 -> 0) or host reset has occurred.
	blt	 t1, s4, .Lhandle_overflow

.Lcontinue_dispatch:
	mv	 s4, t1				   # Update our state to the new ID
	j	 run_user_code

.Lhandle_overflow:
	# Handle the counter wrap-around gracefully
	mv	 s4, t1				   # Re-sync the state
	j	 run_user_code		   # Proceed to execution

# =========================================================
# EXECUTION PREP (Pass context to User Code)
# =========================================================
run_user_code:
	li a0, 'C'
	#jal ra, print_char
	# 1. Prepare ABI Pointers (The "Contract")
	la	 s1, kernel_api_table  # s1 = Block 0 (I/O)

	li	 t0, 2048
	add	 s2, s1, t0			   # s2 = Block 1 (CPU/Time)
	
	li	 t0, 4096
	add	 s3, s1, t0			   # s3 = Block 2 (Memory/Data)

	# 2. Set User Stack
	#li	 sp, 0x9FFFFFFF		   # Move stack to top of RAM for user code
	#li  sp, 0x9FFFFFF0   # Ends in 0, perfectly 16-byte aligned
	li sp, 0x88000000

	# 3. Synchronization
	fence rw, rw
	fence.i					   # CRITICAL: Flush Instruction Cache for payload
	fence
	sfence.vma x0, x0

	# 4. JUMP TO PAYLOAD
	# Inside your kernel, before jumping to user code:
	#la s1, kernel_api_table      # Block 0: I/O
	#la s2, kernel_api_b1         # Block 1: CPU/Time
	#la s3, kernel_api_b2         # Block 2: Memory/IPC

	li t1, 0x82100000
	lw t2, 0(t1)
	li	 t4, 0x82100000		   # Load Payload Address (RAM + 33MB)
	jalr ra, 0(t4)			   # CALL USER CODE
	li a0, 'K'
	#jal ra, print_char

# =========================================================
# POST-EXECUTION (Cleanup)
# =========================================================
	li	 s0, 0x82000000
	li	 sp, 0x80400000

	# Signal 'Done' to the Host
	# We write the sequence ID we just finished to offset 1.
	# This ensures the host knows exactly which task completed.
	sb	 s4, 1(s0)
	fence rw, rw			   # Commit changes

stop:
	wfi
	j stop
	j	 dispatch_loop		   # Await next sequence ID










# =========================================================
# UTILITIES
# =========================================================
print_string:
	# a0 = pointer to string
	mv	 t2, a0				
1:	lbu	 a0, 0(t2)		   
	beqz a0, 2f			   
	
	# Save context
	addi sp, sp, -16
	sd	 ra, 0(sp)
	sd	 t2, 8(sp)
	
	jal	 ra, print_char	   
	
	# Restore context
	ld	 t2, 8(sp)		   
	ld	 ra, 0(sp)		   
	addi sp, sp, 16
	
	addi t2, t2, 1		   
	j	 1b
2:	ret

print_char:
	li t0, 0x10000000		   # UART0 Base Address
.Lwait_tx:
	lb t1, 5(t0)			   # Read LSR
	andi t1, t1, 0x20		   # Check THRE
	beqz t1, .Lwait_tx		   # Wait if full
	sb a0, 0(t0)			   # Transmit
	ret

.include "franz.inc"
# =========================================================
# THE ABI TABLE
# =========================================================
.include "kernel/bx.s"            # Contains .quad sys_uart_putc, etc.
.include "kernel/b0.s"
.include "kernel/b2048.s"
.include "kernel/b4096.s"
.include "kernel/b6144.s"

.align 12
.fill 256, 8, 0

.section .rodata
.align 2
msg_banner: .asciz "> "
