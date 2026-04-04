const franz = require('./build/lib/franz_node.node');
const fs = require('fs/promises');

const MAILBOX = 0x2000000;
const PLATFORM = 0x2000100;
const PLATFORM_RESULT = 0x2002000;
const USER_CODE = 0x2100000;
const mod = module.exports = {
	MAILBOX,
	USER_CODE,
	PLATFORM,
	native: franz,

	async run(payload, output){
		return franz.run(payload, output);
	},

	flush(){
		console.log("\n-- flush --\n");
		return franz.flush(this.memory);
	},

	kill(){
		console.log("\n-- kill --\n");
		return franz.kill(0);
	},

	async assemble(code, ld){
		if(!ld)
			throw new Error("Missing ld");
		return await franz.assemble(code, ld);
	},

	async ram(){
		const ram = this.memory;

		return new FranzDevice(ram, {
			mail: MAILBOX,
			mcode: USER_CODE,
			platform: PLATFORM,
			presult: PLATFORM_RESULT
		});
	},

	async xram(){
		const ram = this.memory;
		return new FranzXDevice(ram, {
			mail: MAILBOX,
			mcode: USER_CODE
		});
	}
}

const FranzAPI = require("franz/api");

Object.defineProperties(mod, {
	memory: {
		get(){
			if(!this._memory){
				console.log("[Franz] get_ram");
				this._memory = franz.getRam();
			}

			return this._memory;
		},
	}
});

try {
	module.exports.Franz = require("franz/franz");
} catch(err){

}

const events = require("events");
class FranzDevice extends events.EventEmitter {
	constructor(ram, dictionary){
		super();

		this.ptr = ram;
		this.dict = dictionary;
	}
}

FranzDevice.prototype.write = function(id, buffer){
	const dest = this.dict[id];
	if(!dest)
		throw new Error(`Unknown Address Identifier: ${id}`);

	buffer.copy(this.ptr, dest);
}

FranzDevice.prototype.writeUnsafe = function(address, buffer){
	buffer.copy(this.ptr, address);
}

FranzDevice.prototype.inspect = function(n = 500){
	const util = require('util');
	const buff = this.ptr.subarray(
		this.dict["mcode"],
		this.dict["mcode"] + n
	);
	console.log(util.inspect([ ...buff ], {
		maxArrayLength: null,
		colors: true
	}));
}

/*FranzDevice.prototype.push = function(){
	if(this.dict["mail"]){
		const buffer = Buffer.alloc(1);
		buffer[0] = 1;

		this.write("mail", buffer);
	}
}*/

FranzDevice.prototype.push = function() {
	const view = new Uint8Array(
		this.ptr.buffer, 
		this.ptr.byteOffset, 
		this.ptr.byteLength
	);

	// Atomic increment: This changes the value (e.g., 1 -> 2).
	// Because it is a Uint8Array, it automatically wraps from 255 to 0.
	const ret = Atomics.add(view, this.dict["mail"], 1);
	mod.flush();
	console.trace(`->`);
};

FranzDevice.prototype.offsetOne = function(){
	const view = new Uint8Array(
		this.ptr.buffer,
		this.ptr.byteOffset,
		this.ptr.byteLength
	);

	return view[this.dict["mail"] + 1];
}

FranzDevice.prototype.offsetAPI = function(){
	const view = new BigUint64Array(
		this.ptr.buffer,
		this.ptr.byteOffset + this.dict["platform"],
		1
	);

	return view[0];
}

FranzDevice.prototype.resetAPI = function(){
	const view = new BigUint64Array(
		this.ptr.buffer,
		this.ptr.byteOffset + this.dict["platform"],
		1
	);
	return view[0] = 0n;
}

FranzDevice.prototype.interrupt = function(){
	const view = new BigUint64Array(this.ptr.buffer,
		this.ptr.byteOffset + this.dict["presult"],
		1
	);

	view[0] = 1n;
}

FranzDevice.prototype.writeAPI = function(str){
	const encoder = new TextEncoder();
	const encodedString = encoder.encode(str);

	// 1. Create a 1-byte-per-element view
	// We allocate enough for the string + 1 byte for the null terminator
	const view = new Uint8Array(
		this.ptr.buffer,
		this.ptr.byteOffset + this.dict["presult"] + 0x8,
		encodedString.length + 1
	);

	// 2. Copy the string bytes into the shared memory
	view.set(encodedString);

	// 3. Explicitly Null Terminate (0x00)
	// This is now at the very last index of the view
	view[encodedString.length] = 0;

	// Optional: Log the address so you can 'xp' it in QEMU
	// console.log("String at:", (this.dict["presult"] + 0x8).toString(16));
};

FranzDevice.prototype.readAPI = function(len){
	const view = new Uint8Array(
		this.ptr.buffer,
		this.ptr.byteOffset + this.dict["platform"] + 0x8,
		len || 0x1EF8
	);

	console.log(view);

	const decoder = new TextDecoder();
	const nullIndex = view.indexOf(0);

	return decoder.decode(nullIndex !== -1 ? view.slice(0, nullIndex) : view);
}

FranzDevice.prototype.cleanAPI = function(len){
	const view = new Uint8Array(
		this.ptr.buffer,
		this.ptr.byteOffset + this.dict["platform"] + 0,
		0x2000 + (len || 0x64000)
	);

	view.fill(0);
}

class FranzXDevice extends FranzDevice {
	constructor(ram, dictionary){
		if(!dictionary["mail"])
			throw new Error(`Missing mail Address Identifier`);

		if(!dictionary["mcode"])
			throw new Error(`Missing mcode Address Identifier`);

		super(ram, dictionary);

		this.tail = 0;
		this.pins = [];
	}
}

FranzXDevice.prototype.write = function(mcode){
	if(!(mcode instanceof Buffer))
		throw new Error(`Mismatch Type Not Binary`);

	this.pins.push(this.tail);
	this.writeUnsafe(this.dict["mcode"] + this.tail, mcode);

	this.tail = this.tail + mcode.length;
}

class FranzMachine extends events.EventEmitter {
	constructor(){
		super();

		this._kernel = null;
		this.memory = null;
		this.xmem = null;
		this.apiUser = {};
		this.api = new FranzAPI(this, this.apiUser);
		this.status = 0;
	}
}

//const net = require('net');
FranzMachine.prototype.interrupt = async function() {
	/*const wakeCommand = {
	    "execute": "human-monitor-command",
	    "arguments": { "command-line": "mwp 0x02000000 1" }
	};

	try {
		await this.client.write(JSON.stringify(wakeCommand));
	} catch(err){
		console.log(err);
	}*/

	await this.memory.interrupt();
};


FranzMachine.prototype.kernel = async function(path, ldpath){
	const kernel = await fs.readFile(path || "franz_kernel.asm");
	const ld = await fs.readFile(ldpath || "franz.ld");
	console.log("[Franz] Kernel");
	console.log(kernel.toString());
	console.log("─".repeat(40));
	console.log("[Franz] Kernel");
	console.log(ld.toString());
	console.log("─".repeat(40));

	const mcode = await mod.assemble(kernel.toString(), ld.toString());
	console.log("[Franz] Kernel", mcode);
	console.log("─".repeat(40));

	this._kernel = mcode;
	this.memory = await mod.ram();
	this.xmem = await mod.xram();
	this.emit("kernel");

	const machine = this;
	let clock = 0;
	async function ctxsw(){
		machine.emit("return", clock);
		clock = 0;
	}

	let current = 0;
	let api = 0;
	let last = 0;
	let tick = 100;
	const timer = (f, tick) => {
		if(clock < 20){
			clock++;

			return setImmediate(f);
		}

		clock++;
		//return setTimeout(f, tick)
		return setImmediate(f);
	}

	timer(async function f(){
		if((api = machine.memory.offsetAPI()) != 0){
			machine.memory.resetAPI();
			const apiid = api.toString(16).toLowerCase();
			const apio = { id: apiid };
			machine.emit("api", api, apio);
			machine.emit(`api.${apiid}`, apio);
		}

		if((current = machine.memory.offsetOne()) == last)
			return timer(f, tick);

		last = current;
		await ctxsw();
		timer(f, tick);
	}, tick);
	console.warn("FRANZMACHINE NEED TIMER CLEANUP ROUTINE")
}

FranzMachine.prototype.run = async function(cb, norun = 0){
	const machine = this;
	this.status = 1;

	let buff = '';
	console.log("[RUN]", this._kernel);
	if(!norun) mod.run(this._kernel, cb || function serial(output){
		if(output)
			process.stdout.write(output);

		if(buff === 0)
			return ;

		if(output)
			buff += output

		if(buff.includes(">")){
			machine.emit("run");

			buff = 0;
		}
	});

	if(norun) setImmediate(function(){
		machine.emit("run", "unknown-machine");
	});

	/*const client = this.client = net.createConnection(
		'/data/data/com.termux/files/home/franz-qmp.sock'
	);
	client.on("error", function(...args){
		// ignore lmao
		console.log(args);
	});

	client.on("uncaughtException", function(...args){
		// ignore lmao
		console.log(args);
	});
	try {
		await events.once(client, "connect");
		await client.write(JSON.stringify({
			"execute": "qmp_capabilities"
		}));
	} catch(err){
		console.log(err);
	}*/
}

FranzMachine.prototype.kill = async function(cb, norun = 0){
	mod.kill();
}

class FranzProgram extends events.EventEmitter {
	constructor(machine, asm, ld){
		super();

		/*if(machine.status != 1)
			throw new Error("Machine is not running");*/

		this.machine = machine;
		this.mcode = null;
		this.asm = null;

		this.task = this.write(asm, ld);
	}
}

FranzProgram.prototype.write = async function(asm, ld){
	const mcode = await mod.assemble(asm, ld);
	this.ld = ld;
	this.asm = asm;
	this.mcode = mcode;
	this.machine.xmem.write(mcode);
	this.emit("ready");
}

class FranzMono extends FranzProgram {}
FranzMono.prototype.write = async function(asm, ld){
	const mcode = await mod.assemble(asm, ld);
	this.ld = ld;
	this.asm = asm;
	this.mcode = mcode;
	/*this.machine.xmem.tail = 0;
	this.machine.xmem.write(mcode);
	this.machine.xmem.tail = 0;
	*/
	this.emit("ready");
}

FranzMono.prototype.load = async function(asm, ld){
	false && console.log(`[Loading] ${
		this.mcode.toString()
			.split('')
			.map(c => c.charCodeAt())
	}`);
	this.machine.xmem.tail = 0;
	this.machine.xmem.write(this.mcode);
	this.machine.xmem.tail = 0;
	this.emit("load");
}

mod.FranzDevice = FranzDevice;
mod.FranzXDevice = FranzXDevice;
mod.FranzMachine = FranzMachine;
mod.FranzProgram = FranzProgram;
mod.FranzMono = FranzMono;
