# =========================================================
# BLOCK 2: MEMORY & DATA (Starts at Offset 4096)
# =========================================================

# --- [512] sys_mem_copy (a0=dst, a1=src, a2=len) ---
# Highly optimized: Moves 8 bytes per iteration when possible.
sys_mem_copy:
    li   t0, 8
    bltu a2, t0, 2f          # If len < 8, jump to byte-copy
1:  ld   t1, 0(a1)           # Load 64-bit doubleword
    sd   t1, 0(a0)           # Store 64-bit doubleword
    addi a0, a0, 8           # Advance pointers
    addi a1, a1, 8
    addi a2, a2, -8          # Decrement length
    bgeu a2, t0, 1b          # Repeat if 8+ bytes remain
2:  beqz a2, 3f              # If len == 0, exit
    lbu  t1, 0(a1)           # Copy remaining bytes
    sb   t1, 0(a0)
    addi a0, a0, 1
    addi a1, a1, 1
    addi a2, a2, -1
    j    2b
3:  ret

# --- [513] sys_mem_set (a0=dst, a1=val, a2=len) ---
# Fills memory with 8-byte chunks for speed.
sys_mem_set:
    # Prepare 8-byte pattern from the single byte in a1
    andi a1, a1, 0xFF        # Ensure a1 is only 1 byte
    slli t1, a1, 8
    or   a1, a1, t1          # a1 = [XX|XX]
    slli t1, a1, 16
    or   a1, a1, t1          # a1 = [XXXX|XXXX]
    slli t1, a1, 32
    or   a1, a1, t1          # a1 = [XXXXXXXX|XXXXXXXX] (Full 64-bit pattern)
    
    li   t0, 8
    bltu a2, t0, 2f
1:  sd   a1, 0(a0)           # Store 64-bit pattern
    addi a0, a0, 8
    addi a2, a2, -8
    bgeu a2, t0, 1b
2:  beqz a2, 3f
    sb   a1, 0(a0)           # Store remaining bytes
    addi a0, a0, 1
    addi a2, a2, -1
    j    2b
3:  ret

# --- [514] sys_mem_compare (a0=ptr1, a1=ptr2, a2=len) -> a0=result ---
sys_mem_compare:
    li   t0, 0               # Default result: 0 (Equal)
1:  beqz a2, 3f              # End of length?
    lbu  t1, 0(a0)
    lbu  t2, 0(a1)
    bne  t1, t2, 2f          # Not equal?
    addi a0, a0, 1
    addi a1, a1, 1
    addi a2, a2, -1
    j    1b
2:  sub  t0, t1, t2          # Calculate difference
3:  mv   a0, t0
    ret

# --- [515] sys_mem_move (a0=dst, a1=src, a2=len) ---
# Safely handles overlapping memory regions.
sys_mem_move:
    # Check for overlap. 
    # If dst <= src, forward copy is safe.
    bleu a0, a1, 1f
    
    # If dst >= src + len, forward copy is also safe.
    add  t0, a1, a2          # t0 = src + len
    bgeu a0, t0, 1f          # if dst >= src + len, jump

    # Overlap detected (src < dst < src + len). 
    # We MUST copy backwards from the end to avoid overwriting our own source.
    add  a0, a0, a2          # Move dst pointer to the end (dst + len)
    add  a1, a1, a2          # Move src pointer to the end (src + len)
    
2:  beqz a2, 3f              # If len == 0, we are done
    addi a0, a0, -1          # Decrement dst pointer
    addi a1, a1, -1          # Decrement src pointer
    lbu  t1, 0(a1)           # Read byte from end
    sb   t1, 0(a0)           # Write byte to end
    addi a2, a2, -1          # Decrement length counter
    j    2b                  # Loop

1:  # No dangerous overlap. Reuse the fast forward-copy logic!
    # By jumping instead of calling, sys_mem_copy will `ret` directly to the caller.
    j    sys_mem_copy        

3:  ret

# Input:  a0 = address of the string
# Output: a0 = length of the string (excluding null terminator)
sys_str_len:
    mv   t0, a0          # Copy start address to t0
1:
    lbu  t1, 0(t0)       # Load unsigned byte from current address
    beqz t1, 2f          # If byte is zero (null), jump to end
    addi t0, t0, 1       # Increment address pointer
    j    1b              # Repeat loop
2:
    sub  a0, t0, a0      # Result = Current address - Start address
    ret

# --- [576] sys_mem_total ---
sys_mem_total:
    li   a0, 0x20000000      # Hardcoded 512 MB
    ret

# --- [577] sys_mem_free ---
# (Simplified: Returns the start of the user heap relative to 512MB)
sys_mem_free:
    li   a0, 0x10000000      # Assume 256MB free for user logic
    ret

# --- [578] sys_mem_page_size ---
# Returns the standard page size for memory management.
sys_mem_page_size:
    li   a0, 4096            # Return 4KB (standard page size)
    ret

# --- [640] sys_mb_read (a0=offset) ---
sys_mb_read:
    li   t0, 0x10001000      # Mailbox Base
    add  t0, t0, a0          # Add offset
    lbu  a0, 0(t0)           # Read byte
    ret

# --- [641] sys_mb_write (a0=offset, a1=val) ---
sys_mb_write:
    li   t0, 0x10001000
    add  t0, t0, a0
    sb   a1, 0(t0)           # Write byte
    ret

# --- [642] sys_mb_flush ---
# Signals the Node.js host to process the current Mailbox data.
sys_mb_flush:
    li   t0, 0x10001000
    li   t1, 0x01            # Flush command
    sb   t1, 0(t0)           # Trigger host
    ret

# --- [704] sys_fs_sync ---
sys_fs_sync:
    li   a0, 0               # Stub: Success
    ret

# --- [705] sys_fs_stat (a0=path_ptr -> a0=status) ---
# High-level hook for storage health/status
sys_fs_stat:
    # Since we are currently stubbing the filesystem, return 0 (Success/Available)
    li   a0, 0               # Stub: Health OK / Found
    ret
