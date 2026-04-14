const events = require("events");
const { db, ld, options, franz, machine } = require("franz/bot");
const { MessageFlags } = require('discord.js');
const rqueue = [];
franz.on("command.run", async function f({ interaction, user }, input){
	async function next(){
		rqueue.shift()
		if(rqueue[0])
			f(...rqueue[0]);
	}

	await interaction.deferReply();
	if(rqueue[0])
		return rqueue.push([ { interaction, user } ]);

	rqueue.push([ { interaction, user } ]);
	machine.apiUser.interaction = interaction;

	const code = await db.compile(user.id);
	let program;

	status = "setup";

	try {
		//console.log(code);
		//console.log(machine);
		program = new machine.Program(
			machine,
			code,
			ld
		);

		await program.task;
		await program.load();
	} catch(error){
		let title = "Failed."
		let description = `Unknown Server Error. ${error.message}`;
		try {
			const err = await fs.readFile("asm_error.log");
			description = "```" + err + "```";
			title = "Assembly Error";
			await fs.unlink("asm_error.log");
		} catch(error){}

		description = description.trim() || `${error.message}`;

		await interaction.editReply({
			embeds: [{ ...options.embed.style,
				...options.embed.error,
				title,
				description
			}]
		});

		return next();
	}

	const uinput = [
		input.input,
		interaction.user.id
	].join(String.fromCharCode(12));

	await machine.memory.writeAPI(uinput);

	status = "running";
	machine.memory.push();
	const task = new Promise(async function(res, rej){
		const controller = new AbortController();
		const to = setTimeout(function(){
			rej();
			controller.abort();
		}, 10000);
		rqueue[0].rej = function(...args){
			clearTimeout(to);
			controller.abort();
			rej(...args);
		};
		rqueue[0].res = function(...args){
			clearTimeout(to);
			controller.abort();
			res(...args);
		};

		try {
			await events.once(machine, "return", {
				signal: controller.signal
			});
		} catch(err){ return rej(); }

		clearTimeout(to);
		res();
	})
	try {
		await task;
	} catch(err){

	}

	// remove this once hot swap works
 	await new Promise(async function patch(res){
		await machine.kill();
		machine.run(function(output){
			if(!output)
				return ;

			console.log(output);

			machine.buffer += output;
			machine.buffer = machine.buffer.slice(-4000000);
			if(output.includes('>'))
				machine.emit("run");
		});
		await events.once(machine, "run");
		console.log("RESTART");
		res();
	})

	if(input.uart !== false || input.uart === null){
		await interaction.editReply({ embeds: [ {
			...options.embed.style,
			title: `UART / <@${user.id}>`,
			description: '```\n'
				+ machine.buffer.slice(-4000)
				+ '```'
		} ] });
	} else {
		await interaction.deleteReply();
	}

	next();
});
