# ABI Offsets (Indices * 8)
# Block 0: I/O
.equ SYS_UART_PUTC,    0
.equ SYS_UART_PUTS,    8
.equ SYS_UART_PUTHEX,  16
.equ SYS_PX_BUFFER,    512 + 16   # Quadrant 2 start + slot 2
.equ SYS_PX_SYNC,      512 + 24

# Block 1: CPU (Access via s2 or s1+2048)
.equ SYS_GET_TIME,     0
.equ SYS_FENCE_I,      40

# Block 2: Memory (Access via s3 or s1+4096)
.equ SYS_MEM_COPY,     0
.equ SYS_MEM_SET,      8
