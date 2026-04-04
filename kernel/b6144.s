# =========================================================
# IMPLEMENTATION: Platform Messaging
# =========================================================
# --- sys_pl_ch_msg_get ---
# Input:  a0 = Message ID or Channel ID
# Result: a0 = 0 (Queued), a1 = 0 (Success)
sys_pl_ch_msg_get:
	la   t0, sys_pl_ch_msg_get
	sd   t0, 0x100(s0)
	wfi
	li   a1, 0                   # Clear error register
	ret

# --- sys_pl_ch_msg_set ---
# Input:  a0 = Data/Value to set
# Result: a1 = 0
sys_pl_ch_msg_set:
	la   t0, sys_pl_ch_msg_set
	sd   t0, 0x100(s0)
	wfi
	li   a1, 0
	ret

# --- sys_pl_ch_msg_new ---
# Input:  None (or a0 as a type flag)
# Action: Tells the handler to prepare a new message slot
sys_pl_ch_msg_new:
	PUSH_FRAME 16
	mv   s3, t5
	# 1. Save the original source pointer immediately
	mv   t4, a0              # Keep string pointer in t4

	# 2. Get the string length
	# Input: a0 = string addr
	KCALL STR_LEN            # Returns length in a0
	mv   t3, a0              # t3 = length (use mv, not ld)

	# 3. Setup message metadata in your struct (s0)
	sd   s3, 0x100(s0)       # Store function/type pointer
	sd   t3, 0x108(s0)       # Store length in the struct
	li   a0, 0

	# 4. Prepare MEM_COPY
	# We need: a0=dst, a1=src, a2=len
	li   t2, 0x108
	add  a0, s0, t2          # a0 = Destination (s0 + 0x110)
	mv   a1, t4              # a1 = Source (the pointer we saved in t4)
	mv   a2, t3              # a2 = Length (from t3)

	KCALL MEM_COPY

	li   t2, 0x2000
	add  t2, s0, t2
	PLATFORM_WAIT
	POP_FRAME 16
	ret
