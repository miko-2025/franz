# =========================================================
# FRANZ KERNEL - USER ABI DEFINITIONS (franz.inc)
# =========================================================

# --- MASTER ABI POINTER ---
# The kernel pre-loads the base address (0x80201000) into s1.
# Users MUST NOT modify s1 if they intend to use kcall.
.equ ABI_BASE, s1  

# --- BLOCK OFFSET CONSTANTS ---
.equ B0_OFF, 0x000     # Block 0: I/O & Multimedia
.equ B1_OFF, 0x800     # Block 1: CPU & Time (2048)
.equ B2_OFF, 0x1000    # Block 2: Memory & Data (4096)
.equ B3_OFF, 0x1800    # Block 3: Platform API (6144)

# =========================================================
# BLOCK 0: I/O & MULTIMEDIA
# =========================================================
# -- Quadrant 1: UART [000-063] --
.equ UART_PUTC,       (B0_OFF + 0x000)
.equ UART_PUTS,       (B0_OFF + 0x008)
.equ UART_PUTHEX,     (B0_OFF + 0x010)
.equ UART_PUTDEC,     (B0_OFF + 0x018)
.equ UART_GETC,       (B0_OFF + 0x020)

# -- Quadrant 2: Pixels [064-127] --
.equ PX_GETW,         (B0_OFF + 0x200)
.equ PX_GETH,         (B0_OFF + 0x208)
.equ PX_BUFFER,       (B0_OFF + 0x210)
.equ PX_SYNC,         (B0_OFF + 0x218)

# -- Quadrant 3: Audio [128-191] --
.equ SND_SET,         (B0_OFF + 0x400)

# -- Quadrant 4: Network [192-255] --
.equ NET_SUPPORT,     (B0_OFF + 0x600)

# =========================================================
# BLOCK 1: CPU & TIME
# =========================================================
.equ SYS_TIME,        (B1_OFF + 0x000)
.equ SYS_CYCLES,      (B1_OFF + 0x008)
.equ SYS_DELAY_US,    (B1_OFF + 0x010)
.equ SYS_FREQ,        (B1_OFF + 0x018)
.equ SYS_CPUID,       (B1_OFF + 0x020)
.equ SYS_FENCEI,      (B1_OFF + 0x028)
.equ SYS_TIMER_SET,   (B1_OFF + 0x030)
.equ SYS_ISA,         (B1_OFF + 0x038)
.equ SYS_HALT,        (B1_OFF + 0x040)

# =========================================================
# BLOCK 2: MEMORY & DATA
# =========================================================
# -- Quadrant 1: Fast Memory Ops [512-575] --
.equ MEM_COPY,        (B2_OFF + 0x000)
.equ MEM_SET,         (B2_OFF + 0x008)
.equ MEM_COMPARE,     (B2_OFF + 0x010)
.equ MEM_MOVE,        (B2_OFF + 0x018)
.equ STR_LEN,         (B2_OFF + 0x020)

# -- Quadrant 2: Memory Info & Stats [576-639] --
.equ MEM_TOTAL,       (B2_OFF + 0x200)
.equ MEM_FREE,        (B2_OFF + 0x208)
.equ MEM_PAGE_SIZE,   (B2_OFF + 0x210)

# -- Quadrant 3: Mailbox & IPC [640-703] --
.equ MB_READ,         (B2_OFF + 0x400)
.equ MB_WRITE,        (B2_OFF + 0x408)
.equ MB_FLUSH,        (B2_OFF + 0x410)

# -- Quadrant 4: Persistence/OPFS [704-767] --
.equ FS_SYNC,         (B2_OFF + 0x600)
.equ FS_STAT,         (B2_OFF + 0x608)

# =========================================================
# BLOCK 3: PLATFORM API
# =========================================================
.equ PL_CH_MSG_GET,	(B3_OFF + 0x000)
.equ PL_CH_MSG_SET,	(B3_OFF + 0x008)
.equ PL_CH_MSG_NEW,	(B3_OFF + 0x010)

# =========================================================
# SYSTEM CALL MACROS
# =========================================================

# The kcall macro bypasses the 12-bit immediate limit of 'ld'
# by using 'li' and 'add', allowing offsets larger than 2047 bytes
# while only ever requiring s1 to be reserved.
.macro KCALL offset
	li   t5, \offset      # 1. Load the exact byte offset into t6
	add  t6, s1, t5       # 2. Add the base pointer (s1) to the offset
	ld   t6, 0(t6)        # 3. Dereference the pointer to get the function address
	jalr ra, t6           # 4. Jump and link!
.endm

.macro kcall offset
	li   t5, \offset      # 1. Load the exact byte offset into t6
	add  t6, s1, t5       # 2. Add the base pointer (s1) to the offset
	ld   t6, 0(t6)        # 3. Dereference the pointer to get the function address
	jalr ra, t6           # 4. Jump and link!
.endm

.macro PLATFORM_WAIT
	sd   zero, 0(t2)
	fence w, rw
1:
	fence r, r
	ld   t0, 0(t2)
	# Hint to QEMU that this is a spin-loop (saves host energy)
	#.insn i 0x0F, 0, x0, x0, 0x010  # This is the 'pause' instruction
	#li a0, '/'
	#li t5, 0x10000000
	#sb a0, 0(t5)
	beqz t0, 1b        # If it's still 0, keep waiting
	sd   zero, 0(t2)
	fence w, w
.endm

.macro EXIT
	KCALL SYS_HALT
.endm

# PUSH_FRAME: 64-bit version
.macro PUSH_FRAME space
	addi sp, sp, -\space
	sd   ra, \space-8(sp)    # Store Double (8 bytes)
.endm

# POP_FRAME: 64-bit version
.macro POP_FRAME space
	ld   ra, \space-8(sp)    # Load Double (8 bytes)
	addi sp, sp, \space
.endm


# SAVE_ALL: Saves all general purpose registers to the stack
# SAVE_ALL: 64-bit Context Save (Machine Mode)
# Total size: 32 registers * 8 bytes = 256 bytes
.macro SAVE_ALL
	addi sp, sp, -256
	sd x1,  0(sp)          # ra
	# x2 (sp) handled via mscratch below
	sd x3,  16(sp)         # gp
	sd x4,  24(sp)         # tp
	sd x5,  32(sp)         # t0
	sd x6,  40(sp)         # t1
	sd x7,  48(sp)         # t2
	sd x8,  56(sp)         # s0/fp
	sd x9,  64(sp)         # s1
	sd x10, 72(sp)         # a0
	sd x11, 80(sp)         # a1
	sd x12, 88(sp)         # a2
	sd x13, 96(sp)         # a3
	sd x14, 104(sp)        # a4
	sd x15, 112(sp)        # a5
	sd x16, 120(sp)        # a6
	sd x17, 128(sp)        # a7
	sd x18, 136(sp)        # s2
	sd x19, 144(sp)        # s3
	sd x20, 152(sp)        # s4
	sd x21, 160(sp)        # s5
	sd x22, 168(sp)        # s6
	sd x23, 176(sp)        # s7
	sd x24, 184(sp)        # s8
	sd x25, 192(sp)        # s9
	sd x26, 200(sp)        # s10
	sd x27, 208(sp)        # s11
	sd x28, 216(sp)        # t3
	sd x29, 224(sp)        # t4
	sd x30, 232(sp)        # t5
	sd x31, 240(sp)        # t6

	# Save the original SP (stored in mscratch) into the x2 slot
	csrr t0, mscratch      
	sd   t0, 8(sp)         
.endm

# RESTORE_ALL: 64-bit Context Restore (Machine Mode)
.macro RESTORE_ALL
	ld x1,  0(sp)          # ra
	# x2 (sp) restored to mscratch
	ld x3,  16(sp)
	ld x4,  24(sp)
	ld x5,  32(sp)
	ld x6,  40(sp)
	ld x7,  48(sp)
	ld x8,  56(sp)
	ld x9,  64(sp)
	ld x10, 72(sp)
	ld x11, 80(sp)
	ld x12, 88(sp)
	ld x13, 96(sp)
	ld x14, 104(sp)
	ld x15, 112(sp)
	ld x16, 120(sp)
	ld x17, 128(sp)
	ld x18, 136(sp)
	ld x19, 144(sp)
	ld x20, 152(sp)
	ld x21, 160(sp)
	ld x22, 168(sp)
	ld x23, 176(sp)
	ld x24, 184(sp)
	ld x25, 192(sp)
	ld x26, 200(sp)
	ld x27, 208(sp)
	ld x28, 216(sp)
	ld x29, 224(sp)
	ld x30, 232(sp)
	ld x31, 240(sp)

	ld   t0, 8(sp)         # Restore original SP to t0
	csrw mscratch, t0      # Put it back in mscratch

	addi sp, sp, 256
.endm
