const {
	FranzMachine,
	FranzProgram,
	FranzMono
} = require("franz");

const fs = require("fs/promises");
const machine = new FranzMachine();
/*machine.on("kernel", function(){
	console.log("[Franz] Ready");
	machine.run();
});*/

/*machine.on("run", async function(){ //return ;
	machine.emit("machine", machine);

	console.log("[Franz] Running");
	console.log("[Franz] Kernel", machine._kernel);
	fs.writeFile("kernel_dump", machine._kernel);
	console.log("------------------");
	const program = new FranzProgram(machine, `
.section .text
.global _start
_start:
	li a0, 72          # 'H'
	li t0, 0x10000000  # UART Base
	sb a0, 0(t0)       # Print it
	ret                # Return to Kernel (via ra)
	`);

	program.on("ready", function(){
		setInterval(function(){
			machine.memory.push();
		}, 1000)
	});
});*/

machine.Program = FranzMono;
module.exports = machine;
