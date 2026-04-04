/data/data/com.termux/files/usr/bin/clang -target riscv64 -march=rv64gc -nostdlib -x assembler -mabi=lp64d -c ./franz_kernel.asm -o ctkfk.o
/data/data/com.termux/files/usr/bin/ld.lld -T franz.ld  ctkfk.o -o ctk.fk.elf
