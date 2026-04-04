.section .kernel_abi, "aw"
.p2align 3
.global kernel_api_table
kernel_api_table:     # The label is now EXACTLY at 0x80201000
# =========================================================
# BLOCK 0: I/O & MULTIMEDIA (0 - 2047)
# =========================================================
# Quadrant 1: UART [000-063] (Offset 0)
.quad sys_uart_putc           # [00]
.quad sys_uart_puts           # [01]
.quad sys_uart_puthex         # [02]
.quad sys_uart_putdec         # [03]
.quad sys_uart_getc           # [04]
.fill 59, 8, 0

# Quadrant 2: Pixels [064-127] (Offset 512)
.quad sys_px_getw             # [64]
.quad sys_px_geth             # [65]
.quad sys_px_buffer           # [66]
.quad sys_px_sync             # [67]
.fill 60, 8, 0

# Quadrant 3: Audio [128-191] (Offset 1024)
.quad sys_snd_set             # [128]
.fill 63, 8, 0

# Quadrant 4: Network [192-255] (Offset 1536)
.quad sys_net_support         # [192]
.fill 63, 8, 0


# =========================================================
# BLOCK 1: CPU & TIME (2048 - 4095)
# =========================================================
.align 11                         # Force alignment to 2KB (0x800)
.global kernel_api_b1
kernel_api_b1:                    # This will be exactly kernel_api_table + 0x800
.quad sys_get_time            # [256] (Offset 2048)
.quad sys_get_cycles          # [257]
.quad sys_delay_us            # [258]
.quad sys_get_freq            # [259]
.quad sys_cpu_id              # [260]
.quad sys_fence_i             # [261]
.quad sys_set_timer           # [262]
.quad sys_get_isa             # [263]
.quad sys_halt                # [264]
.fill 247, 8, 0               # Fill the rest of the 256-slot block


# =========================================================
# BLOCK 2: MEMORY & DATA (Offsets 4096 - 6143)
# =========================================================
.align 12                         # Force alignment to 4KB (0x1000)
.global kernel_api_b2
kernel_api_b2:                    # This will be exactly kernel_api_table + 0x1000
# -- Quadrant 1: Fast Memory Ops [512-575] (Offset 4096) --
.quad sys_mem_copy           # [512] a0=dst, a1=src, a2=len
.quad sys_mem_set            # [513] a0=dst, a1=val, a2=len
.quad sys_mem_compare        # [514] a0=ptr1, a1=ptr2, a2=len -> a0=result
.quad sys_mem_move           # [515] a0=dst, a1=src, a2=len (overlap safe)
.quad sys_str_len            # [516] a0=str_ptr -> a0=len
.fill 59, 8, 0               # 59 EMPTY SLOTS (Fast Ops)

# -- Quadrant 2: Memory Info & Stats [576-639] (Offset 4608) --
.quad sys_mem_total          # [576] Returns total system RAM -> a0
.quad sys_mem_free           # [577] Returns currently free RAM -> a0
.quad sys_mem_page_size      # [578] Returns CPU page size (usually 4KB)
.fill 61, 8, 0               # 61 EMPTY SLOTS (Management)

# -- Quadrant 3: Mailbox & IPC [640-703] (Offset 5120) --
# This is how you talk to your Node.js "Host" for complex data
.quad sys_mb_read            # [640] Read from Mailbox (a0=offset)
.quad sys_mb_write           # [641] Write to Mailbox (a0=offset, a1=val)
.quad sys_mb_flush           # [642] Trigger host-side processing
.fill 61, 8, 0               # 61 EMPTY SLOTS (IPC)

# -- Quadrant 4: Persistence/OPFS [704-767] (Offset 5632) --
# High-level hooks for Geomancy's SQLite/Storage needs
.quad sys_fs_sync            # [704] Commit all writes to disk (OPFS)
.quad sys_fs_stat            # [705] Get storage health/status
.fill 62, 8, 0               # 62 EMPTY SLOTS (Storage)

# =========================================================
# BLOCK 3: PLATFORM API (Offsets 6144 - 8192)
# =========================================================
.align 8
.global kernel_api_b3
kernel_api_b3:
.quad sys_pl_ch_msg_get
.quad sys_pl_ch_msg_set
.quad sys_pl_ch_msg_new
.fill 253, 8, 0
