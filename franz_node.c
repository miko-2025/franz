#include <node_api.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <stdio.h>
#include "franz.h"

typedef struct {
    napi_threadsafe_function tsfn;
} FranzContext;

typedef struct {
    char* mcode;
    size_t size;
    FranzContext* ctx;
} FranzThreadData;

void CallJsSerial(napi_env env, napi_value js_cb, void* context, void* data) {
    if (!data) return;
    
    napi_status status;
    napi_value args[1];
    napi_value undefined;
    
    // 1. Get 'undefined' for the 'this' argument
    napi_get_undefined(env, &undefined);

    //printf("[fnode] DISPATCHING TO JS...\n");

    // 2. Create the string
    status = napi_create_string_utf8(env, (char*)data, NAPI_AUTO_LENGTH, &args[0]);
    if (status != napi_ok) {
        fprintf(stderr, "[fnode] String creation failed: %d\n", status);
        free(data);
        return;
    }

    // 3. Call the function and CAPTURE THE STATUS
    status = napi_call_function(env, undefined, js_cb, 1, args, NULL);
    
    if (status != napi_ok) {
        // This is where the magic happens. 
        // If status is 10 (napi_pending_exception), JS crashed.
        // If status is 2 (napi_invalid_arg), js_cb is gone.
        fprintf(stderr, "[fnode] JS Call Failed with status: %d\n", status);
    }

    free(data);
}

// 2. Callback: Runs on Background Thread
void FranzSerialCallback(const char * restrict out, int32_t channel, size_t len, void *user) {
    FranzContext* ctx = (FranzContext*)user;
    if (!ctx || !ctx->tsfn || len == 0) return;

    char* data_copy = malloc(len + 1);
    memcpy(data_copy, out, len);
    data_copy[len] = '\0';

    //printf("[fnode] CALLBACK\n");

    // Status check for debugging bridge health
    napi_status status = napi_call_threadsafe_function(ctx->tsfn, data_copy, napi_tsfn_blocking);
    if (status != napi_ok) {
        free(data_copy);
    }
}

// 3. Worker: Runs on Background Thread
void* VMThreadWorker(void* arg) {
    FranzThreadData* data = (FranzThreadData*)arg;
    
    napi_acquire_threadsafe_function(data->ctx->tsfn);
    
    // Blocking call into franz.c
    franz_riscv_run(data->mcode,
    	data->size,
    	FranzSerialCallback, data->ctx);

    napi_release_threadsafe_function(data->ctx->tsfn, napi_tsfn_release);
    
    free(data->mcode);
    free(data->ctx);
    free(data);
    return NULL;
}

pthread_t threads[8];
napi_value JsRun(napi_env env, napi_callback_info info) {
    size_t argc = 2; // [0]: buffer, [1]: callback
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    // 1. Get Machine Code Buffer
    void* mcode_ptr;
    size_t mcode_size;
    napi_get_buffer_info(env, args[0], &mcode_ptr, &mcode_size);

    // 2. Setup Threadsafe Function
    napi_value resource_name;
    napi_create_string_utf8(env, "FranzVM", NAPI_AUTO_LENGTH, &resource_name);

    FranzContext* ctx = malloc(sizeof(FranzContext));

    // Callback is back to index 1
    napi_create_threadsafe_function(
        env, args[1], NULL, resource_name, 0, 1,
        NULL, NULL, NULL, CallJsSerial, &ctx->tsfn
    );

    napi_ref_threadsafe_function(env, ctx->tsfn);

    // 3. Package data for the worker thread
    FranzThreadData* thread_data = malloc(sizeof(FranzThreadData));
    thread_data->ctx = ctx;
    thread_data->size = mcode_size;
    thread_data->mcode = malloc(mcode_size);
    memcpy(thread_data->mcode, mcode_ptr, mcode_size);
    
    // Note: If your struct still has the 'ld' member, 
    // you might want to null it out here:
    // thread_data->ld = NULL; 

    // 4. Launch Thread
    pthread_t *tid = threads;
    pthread_create(tid, NULL, VMThreadWorker, thread_data);
    pthread_detach(tid[0]);

    return NULL;
}

napi_value JsKill(napi_env env, napi_callback_info info) {
    size_t argc = 1; // [0]: id
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    int64_t pid;
    napi_get_value_int64(env, args[0], &pid);

    franz_riscv_kill(pid);

    return NULL;
}

napi_value JsAssemble(napi_env env, napi_callback_info info) {
    size_t argc = 2; // [0]: asm_str, [1]: ld_str
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    // 1. Get Assembly String
    size_t asm_len;
    napi_get_value_string_utf8(env, args[0], NULL, 0, &asm_len);
    char* asm_str = malloc(asm_len + 1);
    napi_get_value_string_utf8(env, args[0], asm_str, asm_len + 1, &asm_len);

    // 2. Get Linker Script String
    size_t ld_len;
    napi_status status = napi_get_value_string_utf8(env, args[1], NULL, 0, &ld_len);
    if (status != napi_ok || ld_len == 0) {
        free(asm_str); // Don't leak the previously allocated asm_str
        napi_throw_error(env, NULL, "Linker script string is null or empty. Linkage would fail base address requirements.");
        return NULL;
    }
    char* ld_str = malloc(ld_len + 1);
    napi_get_value_string_utf8(env, args[1], ld_str, ld_len + 1, &ld_len);


    // 3. Call the updated franz.c function with BOTH strings
    size_t bin_size = 0;
    unsigned char* bin_data = franz_riscv_assemble(asm_str, ld_str, &bin_size);

    if (!bin_data) {
        free(asm_str);
        free(ld_str);
        napi_throw_error(env, NULL, "Assembly failed");
        return NULL;
    }

    // 4. Create the Node.js Buffer
    napi_value js_buffer;
    void* node_buffer_ptr;
    // Note: If you want to avoid a double-copy, you can use napi_create_external_buffer,
    // but napi_create_buffer + memcpy is safer for small snippets.
    napi_create_buffer(env, bin_size, &node_buffer_ptr, &js_buffer);
    memcpy(node_buffer_ptr, bin_data, bin_size);

    // Cleanup
    free(asm_str);
    free(ld_str);
    free(bin_data); 

    return js_buffer;
}

// 5. JsGetRam: const buffer = franz.getRam()
napi_value JsGetRam(napi_env env, napi_callback_info info) {
    void* ptr = franz_shmem_getptr(); // Your C function that returns the mmap pointer
    
    if (ptr == NULL || ptr == (void*)-1) {
        napi_throw_error(env, NULL, "Shared memory not initialized or mmap failed");
        return NULL;
    }

    // Change this in your .cpp / .node source
    const size_t RAM_SIZE = 512 * 1024 * 1024; // 512MB (0x20000000)
    napi_value js_buffer;

    // Create a buffer that points directly to the shared memory.
    // We don't provide a finalizer here because the C side (franz.c) 
    // usually manages the lifecycle of the QEMU process/mmap.
    napi_status status = napi_create_external_buffer(
        env, 
        RAM_SIZE, 
        ptr, 
        NULL, // Finalizer callback (optional)
        NULL, // Finalizer hint
        &js_buffer
    );

    if (status != napi_ok) {
        napi_throw_error(env, NULL, "Failed to create external buffer");
        return NULL;
    }

    return js_buffer;
}

#include <sys/mman.h>
#include <sys/mman.h>

// The flush function that accepts the pointer/buffer from Node.js
napi_value JsFlush(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    
    // 1. Extract arguments from the JS call
    napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

    if (argc < 1) {
        napi_throw_error(env, NULL, "flush(ptr) requires 1 argument (the RAM buffer or address).");
        return NULL;
    }

    void* ptr = NULL;
    size_t length = 0;

    // 2. Try to get the pointer from a Buffer object (e.g. the result of getRam())
    napi_status status = napi_get_buffer_info(env, argv[0], &ptr, &length);
    
    // 3. Fallback: If it's not a buffer, try to read it as a BigInt address
    if (status != napi_ok) {
        int64_t addr;
        bool lossless;
        status = napi_get_value_bigint_int64(env, argv[0], &addr, &lossless);
        if (status == napi_ok) {
            ptr = (void*)addr;
            length = 536870912; // Use your 512MB constant as fallback
        } else {
            napi_throw_type_error(env, NULL, "Argument must be a Buffer or a BigInt address.");
            return NULL;
        }
    }

    // 4. Synchronize memory
    if (ptr != NULL) {
        // MS_SYNC: Wait for the flush to finish
        // MS_INVALIDATE: Invalidate other mappings (tells QEMU its cache is stale)
        if (msync(ptr, length, MS_SYNC | MS_INVALIDATE) != 0) {
            napi_throw_error(env, NULL, "msync failed. Is the memory region valid?");
            return NULL;
        }
    }

    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

// 6. Init Module (Updated)
napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        { "run", 0, JsRun, 0, 0, 0, napi_default, 0 },
        { "assemble", 0, JsAssemble, 0, 0, 0, napi_default, 0 },
        { "getRam", 0, JsGetRam, 0, 0, 0, napi_default, 0 },
        { "flush", 0, JsFlush, 0, 0, 0, napi_default, 0 }, // Now included!
        { "kill", 0, JsKill, 0, 0, 0, napi_default, 0 } // Now included!
    };

    napi_define_properties(env, exports, 5, desc); 
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
