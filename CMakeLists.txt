cmake_minimum_required(VERSION 3.10)
project(FranzRISCV C)

set(CMAKE_C_STANDARD 11)

# --- 1. Output Directories ---
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# --- 2. Core Library (The QEMU Spawner) ---
# We no longer need PkgConfig or libvirt here.
add_library(franz_core STATIC franz.c)


# --- 3. Optional Node.js Bridge Logic ---
# This checks if node is available to find headers
execute_process(
    COMMAND node -p "require('path').join(process.config.variables.node_prefix, 'include', 'node')"
    OUTPUT_VARIABLE NODE_INCLUDE_DIR
    ERROR_VARIABLE NODE_ERROR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

# Only build the .node bridge if headers were found
if(NODE_INCLUDE_DIR AND NOT NODE_ERROR)
    message(STATUS "Node headers found at: ${NODE_INCLUDE_DIR}")
    
    # We build the bridge as a shared library with the .node extension
    add_library(franz_node SHARED franz_node.c)
    add_compile_options(-fPIC)

    target_include_directories(franz_node PRIVATE ${NODE_INCLUDE_DIR})
    
    # Link the bridge to your core QEMU logic
    target_link_libraries(franz_node PRIVATE franz_core pthread)
    target_link_libraries(franz_node PRIVATE franz_core)
    
    # Essential for Node.js 'require()' to work
    set_target_properties(franz_node PROPERTIES PREFIX "" SUFFIX ".node")
else()
    message(WARNING "Node.js headers not found. Building Core only.")
endif()

add_executable(franz_debug main.c franz.c)
add_compile_options(-fPIC)

