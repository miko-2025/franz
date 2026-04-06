qemu-system-riscv64 \
-M virt \
-m 128M \
-display none \
-kernel ./franz_payload.bin \
-object memory-backend-file,id=mem1,size=128M,mem-path=/data/data/com.termux/files/home/franz_ivshmem,share=on \
-machine virt,memory-backend=mem1 \
-net none \
-nographic \
-bios none \
#-d in_asm,exec,cpu \
#-D qemu.log \
