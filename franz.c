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
#include "paths.h"

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
	const char* cmd = "clang -target riscv64 -march=rv64gc "
		"-x assembler -c -o - - | "
		"llvm-objcopy -O binary - -"
	;

	FILE* pipe = popen(cmd, "r+");
	if(!pipe) {
		perror("popen failed");
		return NULL;
	}

	FILE* write_pipe = popen("clang -target riscv64 -march=rv64gc -x "
		"assembler -c -o - - | llvm-objcopy -O binary - -", "w");

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
	close(fd);

	char final_cmd[1024];

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

	printf("[Franz] Assembler: %s", final_cmd);

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
		close(pipe_fd[0]);

		dup2(pipe_fd[1], STDOUT_FILENO);
		dup2(pipe_fd[1], STDERR_FILENO);
		close(pipe_fd[1]);
		char *args[] = {
			"qemu-system-riscv64",
			"-M", "virt",
			"-m", "128M",
			"-display", "none",
			"-serial", "stdio",
			"-kernel", "./franz_payload.bin",
			"-accel", "tcg,thread=single,one-insn-per-tb=on",
			"-icount", "shift=10,sleep=on",
			"-bios", "none",

			"-object", "memory-backend-file,id=mem1,size=128M,mem-path="
				SHM_PATH
				",share=on,prealloc=on",
			"-machine", "virt,memory-backend=mem1",

			"-net", "none",
			NULL
		};


		execvp(args[0], args);
		perror("execvp failed");
		exit(1);
	} else if (pid > 0) {
		close(pipe_fd[1]);
		franz_tasks[0] = pid;

		char buffer[1024];
		ssize_t bytes_read;

		while((bytes_read = read(pipe_fd[0],
			buffer,
			sizeof(buffer))) > 0
		){
			serial(buffer, 0, (size_t)bytes_read, user);
		}

		close(pipe_fd[0]);
		waitpid(pid, NULL, 0);
	}
}



void *franz_shmem_getptr(){
	int fd = open(SHM_PATH, O_RDWR | O_CREAT, 0666);
	if (fd < 0) { perror("open"); return NULL; }

	ftruncate(fd, SHM_SIZE);

	void *ptr = mmap(NULL, SHM_SIZE, PROT_READ
		| PROT_WRITE,
		MAP_SHARED, fd, 0
	);
	if (ptr == MAP_FAILED){
		perror("mmap");

		return NULL;
	}

	return ptr;
}

// Assuming 'ptr' is what you got from franz_shmem_getptr()
void franz_flush(void *ptr) {
	// MS_SYNC: Requests an update and waits for it to complete.
	// MS_INVALIDATE: Tells other mappings (like QEMU's) that their
	// cached copies are now stale.
	msync(ptr, SHM_SIZE, MS_SYNC | MS_INVALIDATE);
}
