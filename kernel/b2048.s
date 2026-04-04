# =========================================================
# BLOCK 1: CPU & TIME (Starts at Offset 2048)
# Base hardware assumptions: 
# - RISC-V 64-bit (rv64gc)
# - standard CLINT (Core Local Interruptor) timer base at 0x2000000
# =========================================================

# --- [256] sys_get_time ---
# Returns: a0 = Wall-clock time (Timer ticks)
# Note: On a standard VM, the timer runs at 10 MHz (10 ticks = 1 us).
sys_get_time:
    rdtime a0                # Read the 64-bit 'time' CSR
    ret

# --- [257] sys_get_cycles ---
# Returns: a0 = Actual CPU execution cycles
# Perfect for profiling exactly how many cycles a JIT-compiled function takes.
sys_get_cycles:
    rdcycle a0               # Read the 64-bit 'cycle' CSR
    ret

# --- [258] sys_delay_us (a0 = microseconds to wait) ---
sys_delay_us:
    li   t0, 10              # Multiplier: 10 ticks per microsecond (10MHz timebase)
    mul  t1, a0, t0          # t1 = Total ticks to wait
    rdtime t2                # t2 = Start time
    add  t3, t2, t1          # t3 = Target end time
1:  rdtime t2                # Read current time
    bltu t2, t3, 1b          # If current time < target time, keep looping
    ret

# --- [259] sys_get_freq ---
# Returns: a0 = CPU frequency in Hz (e.g., for a 1GHz core)
# (In a bare-metal VM, this is usually hardcoded by the host)
sys_get_freq:
    li   a0, 1000000000      # 1,000,000,000 Hz (1 GHz)
    ret

# --- [260] sys_cpu_id ---
# Returns: a0 = Current Hardware Thread (Hart) ID
# sys_cpu_id:
#    csrr a0, mhartid         # Read Machine Hart ID register
#    ret

# --- [260] sys_cpu_id ---
sys_cpu_id:
    # mhartid is forbidden in S-mode.
    # Usually, Hart ID is passed in register 'a0' by OpenSBI on boot.
    # For now, we return 0 or read 'sscratch' if used.
    li a0, 0
    ret

# --- [261] sys_fence_i ---
# MANDATORY FOR JIT COMPILE: Synchronizes the Instruction and Data caches.
sys_fence_i:
    fence.i                  # Flush instruction cache
    ret

# --- [262] sys_set_timer (a0 = microseconds from now to trigger interrupt) ---
sys_set_timer:
    li   t0, 10              # 10 ticks per us
    mul  t1, a0, t0          # Total ticks from now
    rdtime t2                # Current time
    add  t3, t2, t1          # Target absolute time
    
    # Write target time to CLINT mtimecmp register (Hart 0)
    li   t4, 0x02004000      # Address of mtimecmp for Hart 0
    sd   t3, 0(t4)           # Store 64-bit target time
    ret

# TODO: What is this?
# --- [263] sys_get_isa ---
# Returns: a0 = Bitmask of supported RISC-V extensions (M, A, F, D, V, etc.)
#sys_get_isa:
#    csrr a0, misa            # Read Machine ISA Register
#    ret

# TODO: What is this?
# --- [263] sys_get_isa ---
sys_get_isa:
    # misa is often forbidden in S-mode. Returning a static mask for rv64imafdc
    li a0, 0x1129
    ret

# --- [264] sys_halt ---
# Stops execution gracefully. Sends a kill signal to Node.js via Mailbox.
sys_halt:
    li   t0, 0x10001000      # Node.js Mailbox base
    li   t1, 0xFF            # 0xFF = "System Halt" code
    sb   t1, 0(t0)           # Send to host
1:  wfi                      # Wait For Interrupt (puts CPU to sleep)
    j    1b                  # If woken up, go back to sleep
