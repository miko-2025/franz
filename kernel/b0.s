# =========================================================
# QUADRANT 1: UART SUBSYSTEM
# Hardware Base: 0x10000000 (Standard 16550 UART)
# =========================================================

# --- [00] sys_uart_putc (a0 = char) ---
sys_uart_putc:
    li   t5, 0x10000000      # UART Base
1:  lbu  t6, 5(t5)           # Read LSR
    andi t6, t6, 0x20        # Check THRE (Transmit Hold Register Empty)
    beqz t6, 1b              # Wait if not empty
    sb   a0, 0(t5)           # Send char
    ret

# --- [01] sys_uart_puts (a0 = string pointer) ---
sys_uart_puts:
    li   t5, 0x10000000
1:  lbu  t0, 0(a0)           # Load next char from string
    beqz t0, 3f              # If null-terminator, exit
2:  lbu  t1, 5(t5)           # Read LSR
    andi t1, t1, 0x20
    beqz t1, 2b              # Wait for UART
    sb   t0, 0(t5)           # Send char
    addi a0, a0, 1           # Advance pointer
    j    1b
3:  ret

# --- [02] sys_uart_puthex (a0 = 64-bit integer) ---
sys_uart_puthex:
    li   t5, 0x10000000
    li   t4, 60              # Start shifting from highest nibble (60 down to 0)
1:  srl  t0, a0, t4          # Shift right to get current nibble
    andi t0, t0, 0xF         # Mask out the rest
    li   t1, 9
    ble  t0, t1, 2f          # If 0-9, skip letter offset
    addi t0, t0, 7           # Offset for A-F
2:  addi t0, t0, 48          # Add '0' (ASCII 48)
3:  lbu  t1, 5(t5)           
    andi t1, t1, 0x20
    beqz t1, 3b              # Wait for UART
    sb   t0, 0(t5)           # Print hex char
    addi t4, t4, -4          # Move to next nibble
    bgez t4, 1b              # Loop until all 16 nibbles are printed
    ret

# --- [03] sys_uart_putdec (a0 = 64-bit integer) ---
sys_uart_putdec:
    li   t5, 0x10000000
    mv   t0, a0
    li   t1, 10
    addi sp, sp, -32         # Allocate 32-byte string buffer on stack
    mv   t2, sp              # t2 is our buffer pointer
    bnez t0, 1f              # If number is not 0, start dividing
    li   t3, '0'             # If 0, handle explicitly
    sb   t3, 0(t2)
    addi t2, t2, 1
    j    3f
1:  beqz t0, 3f              # Division loop
    remu t3, t0, t1          # Get remainder (t3 = t0 % 10)
    addi t3, t3, '0'         # Convert to ASCII
    sb   t3, 0(t2)           # Store in buffer
    addi t2, t2, 1
    divu t0, t0, t1          # Divide by 10
    j    1b
3:  addi t2, t2, -1          # Print loop (reads stack in reverse)
4:  blt  t2, sp, 6f
    lbu  t0, 0(t2)           # Load char
5:  lbu  t3, 5(t5)
    andi t3, t3, 0x20
    beqz t3, 5b              # Wait for UART
    sb   t0, 0(t5)           # Print char
    addi t2, t2, -1
    j    4b
6:  addi sp, sp, 32          # Restore stack
    ret

# --- [04] sys_uart_getc (Returns char in a0) ---
sys_uart_getc:
    li   t5, 0x10000000
1:  lbu  t6, 5(t5)           # Read LSR
    andi t6, t6, 0x01        # Check DR (Data Ready)
    beqz t6, 1b              # Block until key pressed
    lbu  a0, 0(t5)           # Read char from RBR
    ret


# =========================================================
# QUADRANT 2: PIXEL / FRAMEBUFFER SUBSYSTEM
# =========================================================

# --- [64] sys_px_getw (Returns width in a0) ---
sys_px_getw:
    li   a0, 640             # Example: 640px width
    ret

# --- [65] sys_px_geth (Returns height in a0) ---
sys_px_geth:
    li   a0, 480             # Example: 480px height
    ret

# --- [66] sys_px_buffer (Returns Framebuffer base in a0) ---
sys_px_buffer:
    li   a0, 0x82200000      # Example DMA buffer location
    ret

# --- [67] sys_px_sync (Flushes frame to host) ---
sys_px_sync:
    li   t0, 0x10001000      # Mailbox Address (Example)
    li   t1, 1               # Signal 1: "Frame Ready"
    sb   t1, 0(t0)           # Send interrupt to Node.js Host
    ret


# =========================================================
# QUADRANT 3 & 4: AUDIO & NETWORK (Stubs)
# =========================================================

# --- [128] sys_snd_set ---
sys_snd_set:
    ret                      # Placeholder

# --- [192] sys_net_support ---
sys_net_support:
    li   a0, 0               # Return 0 (Network offline)
    ret
