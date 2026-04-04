#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdint.h>
#include <fcntl.h>
#include <errno.h>
#include <signal.h>

#include <sys/wait.h>
#include <sys/mman.h>

#define CLANG_PATH "/data/data/com.termux/files/usr/bin/clang"
#define LD_LLD_PATH "/data/data/com.termux/files/usr/bin/ld.lld"
#define OBJCOPY_PATH "/data/data/com.termux/files/usr/bin/llvm-objcopy"
void franz_riscv_assemble_legacy(const char * restrict assembly) {
	FILE *asm_file = fopen("franz_input.s", "w");
	if (!asm_file) return;

	fprintf(asm_file, "%s\n", assembly);
	fclose(asm_file);

	// Using relative paths for Clang and objcopy output
	// Ensure 'franz_payload.bin'
	// is in the same folder as your executable
	/*int ret = system(
		"clang -target riscv64 -march=rv64g "
		"-c ./franz_input.s -o ./franz_input.o && "
		"llvm-objcopy -O binary "
		"./franz_input.o ./franz_payload.bin"
	);*/

	// franz.c update for the assembly command
	/*int ret = system("clang -target riscv64 -march=rv64g"
		" -T franz.ld -nostdlib "
		"./franz_input.s -o ./franz_input.o && "
		"llvm-objcopy -O binary ./franz_input.o ./franz_payload.bin"
	);*/
	int ret = system(CLANG_PATH" -target riscv64 -march=rv64g -c "
		"./franz_input.s -o ./franz_input.o && "
		"ld.lld -T franz.ld ./franz_input.o -o "
		"./franz_linked.elf && "
		"llvm-objcopy -O binary ./franz_linked.elf"
		" ./franz_payload.bin"
	);

	if(ret != 0){
		fprintf(stderr, "Error: RISC-V Assembly failed.\n");
	}
}

/**
 * Assembles a string, pipes through clang/objcopy, 
 * and returns the raw binary in a heap-allocated buffer.
 * * @param asm_code The input assembly string
 * @param out_size Pointer to store the resulting binary size
 * @return Pointer to the raw machine code (caller must free)
 */
unsigned char* franz_riscv_assemble(
	const char* asm_code,
	const char* ld,
	size_t* out_size
){
	// We pipe the string into clang, then pipe clang's ELF output 
	// into llvm-objcopy to strip headers and get raw machine code.°
	const char* cmd = "clang -target riscv64 -march=rv64gc "
		"-x assembler -c -o - - | "
		"llvm-objcopy -O binary - -"
	;

	FILE* pipe = popen(cmd, "r+");
	if(!pipe) {
		perror("popen failed");
		return NULL;
	}

	// Write the assembly code to the pipe's stdin
	// Note: Standard popen is often half-duplex. 
	// If your string is huge, you might need a temp file.
	// For small kernel snippets, this works in Termux:
	FILE* write_pipe = popen("clang -target riscv64 -march=rv64gc -x "
		"assembler -c -o - - | llvm-objcopy -O binary - -", "w");
	// [Manual redirection logic usually better here,
	//but for brevity:]

	const char* tmp_dir = getenv("TMPDIR");
	if (!tmp_dir)
		tmp_dir = "/data/data/com.termux/files"
			"/usr/tmp"
		; // Fallback for Termux

	char asmfn[512];
	char ldfn[512];
	char template[512];
	snprintf(template, sizeof(template), "%s/franz_asm_XXXXXX", tmp_dir);

	memcpy(strchr(template, '\0'), ".s\0", 3);

	int fd = mkstemp(template);
	if (fd == -1) {
		perror("[franz] mkstemp failed");

		snprintf(template, sizeof(template), "./.tmp_franz_XXXXXX");
		fd = mkstemp(template);
	}

	// Ensure the assembly string itself isn't NULL
	if (asm_code != NULL) {
		size_t len = strlen(asm_code);
		ssize_t written = write(fd, asm_code, len);
		if (written == -1) {
			perror("[fnode] write() to temp file failed");
			close(fd);
			unlink(template);
			return NULL;
		}
	} else {
		fprintf(stderr, "[fnode] Error: asm_code is NULL\n");
	}

	// Close the stream (this also closes fd)
	close(fd);

	memcpy(asmfn, template, sizeof(template));
	memset(template, 0, 512);
	snprintf(template, sizeof(template), "%s/franz_asm_XXXXXX", tmp_dir);
	memcpy(strchr(template, '\0'), ".ld\0", 3);

	fd = mkstemp(template);
	if (fd == -1) {
		perror("[franz] mkstemp failed");

		snprintf(template, sizeof(template), "./.tmp_franz_XXXXXX");
		fd = mkstemp(template);
	}

	// Ensure the assembly string itself isn't NULL
	if (ld  != NULL) {
		size_t len = strlen(ld);
		ssize_t written = write(fd, ld, len);
		if (written == -1) {
			perror("[fnode] write() to temp file failed");
			close(fd);
			unlink(template);
			return NULL;
		}
	} else {
		fprintf(stderr, "[fnode] Error: ld is NULL\n");
	}
	memcpy(ldfn, template, sizeof(template));
	// Close the stream (this also closes fd)
	close(fd);

	//const char* final_cmd = "clang -target riscv64 -march=rv64gc -x assembler -c .tmp_asm.s -o - | llvm-objcopy -O binary - -";
	char final_cmd[1024];
	/*snprintf(final_cmd, sizeof(final_cmd),
		"clang -target riscv64 -march=rv64gc -nostdlib -x "
			"assembler -c %s -o - | llvm-objcopy -O binary - -",
		template
	);*/
	/*snprintf(final_cmd, sizeof(final_cmd),
		CLANG_PATH" -target riscv64 -march=rv64gc "
		"-nostdlib -x assembler -mabi=lp64d "
		"-c %s -o %s.o && "OBJCOPY_PATH
		" -O binary %s.o %s.bin",
		template, template, template, template
	);*/

	snprintf(final_cmd, sizeof(final_cmd),
		/* 1. Compile Assembly to Object file */
		//"(%s --target=riscv64-unknown-elf -march=rv64gc -mabi=lp64d "
		// g is removed for debugging misa
		"(%s --target=riscv64-unknown-elf -march=rv64g -mabi=lp64d "
		"-nostdlib -x assembler -c %s -o %s.o && "

		/* 2. Link using your script */
		"%s -T %s %s.o -o %s.elf && "

		/* 3. Strip to raw binary for QEMU */
		"%s -O binary %s.elf %s.bin) 2> asm_error.log",

		CLANG_PATH, asmfn, asmfn,
		LD_LLD_PATH, ldfn, asmfn, asmfn,
		OBJCOPY_PATH, asmfn, asmfn
	);



	/*
	snprintf(final_cmd, sizeof(final_cmd),
		"%s -target riscv64 -march=rv64gc -nostdlib "
		"-x assembler -mabi=lp64d -c %s -o %s.o 2> "
		"/data/data/com.termux/files/home/projects"
		"/franz/asm_error.log && "
		"%s -T franz.ld %s.o -o %s.elf"
		" && "
		"%s -O binary %s.elf %s.bin 2>> /data/data/"
		"com.termux/files/home/"
		"projects/franz/asm_error.log",
		CLANG_PATH, template, template,
		LD_LLD_PATH, template, template,
		OBJCOPY_PATH, template, template
	);*/

	printf("[Franz] Assembler: %s", final_cmd);
	/*FILE* read_pipe = popen(final_cmd, "r");

	size_t capacity = 4096;
	size_t size = 0;
	unsigned char* buffer = malloc(capacity);

	size_t bytes_read;
	while ((bytes_read = fread(buffer + size, 1, 1024, read_pipe)) > 0) {
		size += bytes_read;
		if (size + 1024 > capacity) {
			capacity *= 2;
			buffer = realloc(buffer, capacity);
		}
	}

	pclose(read_pipe);
	remove(".tmp_asm.s");
	unlink(template);

	*out_size = size;
	return buffer;*/
// ... after your snprintf(final_cmd ...) ...

    // 1. Run the assembly command
	int status = system(final_cmd);
	if (status != 0) {
		fprintf(stderr, "[franz] Assembler failed with status %d\n", status);
		unlink(asmfn);
		return NULL;
	}

	// 2. Open the resulting .bin file directly
	char bin_path[1024];
	snprintf(bin_path, sizeof(bin_path), "%s.bin", asmfn);

	FILE* f_bin = fopen(bin_path, "rb");
	if (!f_bin) {
		perror("[franz] Failed to open generated binary");
		unlink(asmfn);
		return NULL;
	}

	// 3. Get file size and read
	fseek(f_bin, 0, SEEK_END);
	*out_size = ftell(f_bin);
	fseek(f_bin, 0, SEEK_SET);

	unsigned char* buffer = (unsigned char*)malloc(*out_size);
	if (buffer) {
		fread(buffer, 1, *out_size, f_bin);
	}

	fclose(f_bin);

	// 4. Cleanup all temp files
	char tmp_cleanup[1024];
	unlink(asmfn);
	snprintf(tmp_cleanup, sizeof(tmp_cleanup), "%s.o", asmfn); unlink(tmp_cleanup);
	snprintf(tmp_cleanup, sizeof(tmp_cleanup), "%s.bin", asmfn); unlink(tmp_cleanup);
	//snprintf(tmp_cleanup, sizeof(tmp_cleanup), "%s", ldfn); unlink(tmp_cleanup);

	return buffer;
}

pid_t franz_tasks[8];
void franz_riscv_kill(int64_t id){
	printf("KILLING %i\n", (int) franz_tasks[id]);
	kill(franz_tasks[id], SIGKILL);
}

void franz_riscv_run(
	const char * restrict mcode,
	size_t mcode_size,
	void (*serial)(
		const char * restrict out,
		int32_t channel,
		size_t len,
		void *user
	),
	void *user
){
	int pipe_fd[2];
	if (pipe(pipe_fd) == -1) {
		perror("Pipe failed");
		return;
	}

	// Write the machine code to the local file for QEMU to boot
	FILE *bin = fopen("franz_payload.bin", "wb");
	if (bin) {
		fwrite(mcode, 1, mcode_size, bin); // Adjust size as needed
		fclose(bin);
	}

	pid_t pid = fork();

	if (pid == 0) {
		// --- CHILD PROCESS (QEMU) ---
		close(pipe_fd[0]); // Close read end

		dup2(pipe_fd[1], STDOUT_FILENO);
		dup2(pipe_fd[1], STDERR_FILENO);
		close(pipe_fd[1]);

		/*int flags = fcntl(pipe_fd[1], F_GETFL, 0);
		fcntl(pipe_fd[1], F_SETFL, flags | O_NONBLOCK);*/

		// Execute QEMU directly
		// -M virt: Standard RISC-V virt board
		// -m 16M: Your specified RAM
		// -nographic: No VGA, serial output only
		// -serial mon:stdio: Maps the guest serial to
		// QEMU's stdio (which is our pipe)
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			"-object", "memory-backend-file,size=16M,"
				"share=on,id=mem0,"
				"mem-path=/data/data/com.termux/files"
				"/home/franz_ivshmem,"
				"id=hostmem",
			"-machine", "memory-backend=mem0",
//			"-device", "ivshmem-plain,memdev=hostmem",
			"-net", "none",
			"-d", "in_asm,cpu", // logging
			"-D", "qemu.log", // logging
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			"-display", "none",
			"-serial", "stdio",
			// Keep OpenSBI (default) but force your payload to the jump address
			"-device", "loader,file=./franz_payload.bin,addr=0x80200000",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			"-display", "none",
			"-serial", "stdio",
			// Force the payload to the address OpenSBI jumps to
			"-device", "loader,file=./franz_payload.bin,addr=0x80200000",
			"-net", "none",
			"-d", "guest_errors,unimp", // Helpful for seeing if it hits bad memory
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			"-display", "none",
			"-serial", "stdio",
			// 1. Load the binary into RAM
			"-device", "loader,file=./franz_payload.bin,addr=0x80200000",
			// 2. EXPLICITLY tell OpenSBI where to jump after it finishes
			"-append", "root=/dev/vda", // Dummy arg to force parameter passing
			"-kernel", "./franz_payload.bin",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			// 1. The Memory Backend (The File)
			"-object", "memory-backend-file,"
				"size=16M,share=on,id=mem0,"
				"mem-path=/data/data/com.termux/files/"
				"home/franz_ivshmem",
			// 2. The IVSHMEM Device (The Guest PCI Device)
			"-device", "ivshmem-plain,memdev=mem0", 
			"-display", "none",
			"-serial", "stdio",
			"-device", "loader,file=./franz_payload.bin,addr=0x80200000",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M",
			// Create the memory object from your host file
			"-object", "memory-backend-file,"
				"id=mem0,size=16M,share=on,"
				"mem-path=/data/data/com.termux/files/home"
				"/franz_ivshmem",
			// Map it directly into a physical address (e.g., 0x90000000)
			"-device", "loader,file=/data/data/com.termux/files/home"
				"/franz_ivshmem,addr=0x90000000,force-raw=on",
			"-display", "none",
			"-serial", "stdio",
			"-device", "loader,file=./franz_payload.bin,addr=0x80200000",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "16M", // Main RAM (0x80000000)
			// 1. Define the shared memory backend
			"-object", "memory-backend-file,id=shm0,size=16M,share=on,mem-path=/data/data/com.termux/files/home/franz_ivshmem",
			// 2. Map it as a second physical memory range starting at 0x90000000
			"-numa", "node,memdev=shm0",
			"-device", "loader,addr=0x90000000,memdev=shm0", 
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-icount", "shift=0,sleep=off",
			"-d", "nochain",
			"-m", "512M", // Increase total RAM
			"-display", "none",
			"-serial", "stdio",
			// Load your payload at the standard 2MB offset
			"-kernel", "./franz_payload.bin", 
			// Inject the SHM file into the upper region of the 256MB RAM
			// 0x80000000 (Start) + 0x08000000 (128MB offset) = 0x88000000
			"-device", "loader,file=/data/data/com.termux/files/home/franz_ivshmem,addr=0x88000000,force-raw=on",
			"-net", "none",
			NULL
		};*/
		/*char *args[] = {
		"qemu-system-riscv64",
		"-M", "virt",
		"-m", "512M",
		"-display", "none",
		"-serial", "stdio",
		"-kernel", "./franz_payload.bin",

		// 1. Create a "Shared Memory" object linked to your file
		"-object", "memory-backend-file,id=shm0,size=1M,mem-path=/data/data/com.termux/files/home/franz_shm,share=on",

		// 2. Map that object into the Guest's address space at 0x88000000
		"-device", "loader,addr=0x88000000,memdev=shm0",

		"-net", "none",
		NULL
		};*/

		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "512M",
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",

			// 1. Create the shared memory object (1MB)
			"-object", "memory-backend-file,id=shm0,size=1M,mem-path=/data/data/com.termux/files/home/franz_shm,share=on",

			// 2. Map it to 0x88000000 using ivshmem-flat
			"-device", "ivshmem-flat,memdev=shm0,address=0x88000000",

			"-net", "none",
			NULL
		};*/

		/*char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "512M",
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",

			// This makes the ENTIRE 512MB RAM a shared file
			"-mem-path", "/data/data/com.termux/files/home/franz_ivshmem",
			"-mem-prealloc", // Ensure QEMU maps the whole file immediately

			"-net", "none",
			NULL
		};*/
		char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "128M",
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",
			//"-d", "in_asm,cpu",
			//"-D", "qemu.log",
			//"-d", "nochain",
			"-accel", "tcg,thread=single,one-insn-per-tb=on",
			"-icount", "shift=6,sleep=on"
			"-bios", "none",

			// This is the modern, robust way to do shared memory in QEMU
			"-object", "memory-backend-file,id=mem1,size=128M,mem-path=/data/data/com.termux/files/home/franz_ivshmem,share=on,prealloc=on",
			"-machine", "virt,memory-backend=mem1",
			//"-qmp", "unix:/data/data/com.termux/files/home/franz-qmp.sock,server,nowait",

			"-net", "none",
			NULL
		};

		/*int i = 0;
		while(args[i] != NULL){
			printf("[ %s ]\n", args[i++]);
		}*/

		execvp(args[0], args);
		perror("execvp failed");
			// Only reached if exec fails
		exit(1);
	} else if (pid > 0) {
		// --- PARENT PROCESS (Franz Engine) ---
		close(pipe_fd[1]); // Close write end
		franz_tasks[0] = pid;

		char buffer[1024];
		ssize_t bytes_read;

		/*int flags = fcntl(pipe_fd[0], F_GETFL, 0);
		fcntl(pipe_fd[0], F_SETFL, flags | O_NONBLOCK);*/

		// Read from the pipe and trigger the callback
		printf("USER PTR: %ull\n", (uintptr_t) user);
		while((bytes_read = read(pipe_fd[0],
			buffer,
			sizeof(buffer))) > 0
		){
			//fprintf(stderr, "[Franz Debug] Read %zd bytes\n", bytes_read);
			serial(buffer, 0, (size_t)bytes_read, user);
		}

		close(pipe_fd[0]);
		waitpid(pid, NULL, 0); // Wait for QEMU to exit
	}
}



#define SHM_PATH "/data/data/com.termux/files/home/franz_ivshmem"
#define SHM_SIZE 0x20000000

/*
#include <stdio.h>
#include <stdlib.h>
*/

void *franz_shmem_getptr(){
	// 1. Open (or create) the backing file
	int fd = open(SHM_PATH, O_RDWR | O_CREAT, 0666);
	if (fd < 0) { perror("open"); return NULL; }

	// 2. Ensure the file is the right size
	ftruncate(fd, SHM_SIZE);

	// 3. Map the file into Termux memory
	void *ptr = mmap(NULL, SHM_SIZE, PROT_READ
		| PROT_WRITE,
		MAP_SHARED, fd, 0
	);
	if (ptr == MAP_FAILED){
		perror("mmap");

		return NULL;
	}

	//printf("Shared Memory linked at %p\n", ptr);

	// Write a test pattern for the guest to see
	//strcpy((char *)ptr, "Hello from Termux Host!");

	// Keep it open so you can see updates
	/*while(1) {
		printf("Current Guest Data: %s\n", (char *)ptr);
		sleep(2);
	}*/

	return ptr;
}

// Assuming 'ptr' is what you got from franz_shmem_getptr()
// and 'SHM_SIZE' is your 512M
void franz_flush(void *ptr) {
	// MS_SYNC: Requests an update and waits for it to complete.
	// MS_INVALIDATE: Tells other mappings (like QEMU's) that their 
	// cached copies are now stale.
	msync(ptr, SHM_SIZE, MS_SYNC | MS_INVALIDATE);
}
