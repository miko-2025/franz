const { TOKEN } = require("franz/config.json");
const events = require("events");
const Franz = require("franz");
const franz = new Franz.Franz();
const fs = require("fs/promises");
const machine = require("franz/bot/machine");
let status = "off";

franz.login(TOKEN)
machine.apiUser.bot = franz;

const options = { embed: {
	style: {
		color: 0x4FCF6F
	},
	error: {
		color: 0xFC6F4F
	}
} }

const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
const commands = [
	[ "paste", "paste code lines", [
		[ 1, "row", "line number", 1 ]
	] ],
	[ "cut", "cut code lines", [
		[ 1, "start", "start line number", 1 ],
		[ 2, "end", "end line number", 1 ],
	] ],
	[ "set", "set code line", [
		[ 1, "row", "line number", 1 ],
		[ 0, "code", "line code", 1 ]
	] ],
	[ "get", "get code line", [
		[ 1, "row", "line number", 1 ]
	] ],
	[ "run", "run code", [

	] ],

	[ "status", "check virtual machine status", [] ],
	[ "reset", "reset the virtual machine", [] ]
].map(function(command){
	const [
		name,
		description,
		options
	] = command;

	const slash = new SlashCommandBuilder();
	if(name) slash.setName(name)
	if(description) slash.setDescription(description);
	if(options) for(const option of options){
		const [ type, name, description, required ] = option;
		function set(option){
			option.setName(name);
			option.setDescription(description);
			option.setRequired(Boolean(required));

			return option;
		}

		if(type == 0){
			slash.addStringOption(set);
		}

		if(type == 1){
			slash.addIntegerOption(set);
		}
	}

	return slash;
});

const rest = new REST({ version: '10' }).setToken(TOKEN);
async function slashUpdate(){
	await events.once(franz, "ready");
	try {
		await rest.put(
			Routes.applicationCommands(franz.application.id),
				{ body: commands }
		);
		console.log('Successfully registered slash commands.');
	} catch (error) {
		console.error(error);
	}
}

if(process.argv.includes("update"))
	slashUpdate();

const FranzDB = require("franz/bot/sqlite.js");
const db = new FranzDB();
const cooldown = new Map();
franz.on("interactionCreate", async function(interaction){
	if(interaction.isButton()){
		const [ button, ...args ] = interaction.customId
			.split(':')
		;

		console.log(`button.${button}`);
		franz.emit(`button.${button}`, {
			interaction
		}, args);

		return ;
	}

	if(interaction.isModalSubmit()){
		const [ modal, ...args ] = interaction.customId
			.split(':')
		;

		console.log(`modal.${modal}`);
		franz.emit(`modal.${modal}`, {
			interaction
		}, args);

		return ;
	}

	const { user, options, commandName } = interaction;
	const [ delay ] = cooldown.get(`${commandName}-${user.id}`) || [];
	const [ _, commandDelay ] = cooldown.get(`${commandName}`) || [];
	const now = Date.now();
	if(now < delay){
		//[ delay ] = cooldown.get(`warn-${user.id}`);
		return interaction.reply({
			content: `Wait ${(now - delay)/1000}s `
				+ "before using this command again.",
			flags: [ MessageFlags.Ephemeral ]
		});
	}

	if(commandDelay)
		cooldown.set(`${commandName}-${user.id}`,
			[ now + commandDelay, commandDelay ]);

	/*interaction.commandName
	interaction.user.id*/

	//console.log(interaction);
	const components = [
		{
			type: 1, // Action Row
			components: [
				{
					type: 2,
					label: '↑',
					style: 2,
					custom_id: 'b1'
				},
				{
					type: 2,
					label: '↓',
					style: 2,
					custom_id: 'b2'
				},
				{
					type: 2,
					label:'e',
					style: 2,
					custom_id: 'b3'
				},
				{
					type: 2,
					label: '×',
					style: 2,
					custom_id: 'b4'
				},
				{
					type: 2,
					label: '→',
					style: 2,
					custom_id: 'b5'
				}
			]
		},
		{
			type: 1, // Action Row
			components: [
				{
					type: 2,
					label: 'One',
					style: 2,
					custom_id: 'b6'
				},
				{
					type: 2,
					label: 'Two',
					style: 2,
					custom_id: 'b7'
				},
				{
					type: 2,
					label: 'Three',
					style: 2,
					custom_id: 'b8'
				},
				{
					type: 2,
					label: 'Four',
					style: 2,
					custom_id: 'b9'
				},
				{
					type: 2,
					label: 'Five',
					style: 2,
					//url: 'https://google.com'
					custom_id: 'b10'
				}
			]
		}

	];

	const carg = { components, interaction, user };
	switch(commandName){
		case "set": {
			franz.emit(`command.${commandName}`,
				carg, {
					row: options.getInteger("row"),
					code: options.getString("code")
				}
			);

			return ;
		}
		case "get": {
			franz.emit(`command.${commandName}`,
				carg, {
					row: options.getInteger("row")
				}
			);

			return ;
		}
		case "run": {
			franz.emit(`command.${commandName}`,
				carg
			);

			return ;
		}
		case "status": {
			franz.emit(`command.${commandName}`,
				carg
			);

			return ;
		}
		case "reset": {
			franz.emit(`command.${commandName}`,
				carg
			);

			return ;
		}
	}

	try {
		await interaction.reply(interaction.commandName);
	} catch(error){
		await interaction.reply("Error: Unimplemented");
		console.log(interaction);
	}
});

cooldown.set("set", [ 0, 5000 ]);
cooldown.set("get", [ 0, 5000 ]);
cooldown.set("cut", [ 0, 5000 ]);
cooldown.set("paste", [ 0, 5000 ]);
cooldown.set("delete", [ 0, 5000 ]);
cooldown.set("status", [ 0, 5000 ]);

franz.on("command.set", async function({ interaction, user }, {
	row,
	code
}){
	db.set(user.id, row, code.split('\n'));
	await interaction.reply({
		content: "Set",
		flags: [ MessageFlags.Ephemeral ]
	});
});

const ld = `
ENTRY(_start)

SECTIONS
{
	. = 0x82100000;

	.text : {
		*(.text .text.*)
	}

	.rodata : {
		*(.rodata .rodata.*)
	}

	.data : {
		*(.data .data.*)
	}

	/DISCARD/ : {
		*(.eh_frame)
		*(.comment)
	}
}
`

const rqueue = [];
franz.on("command.run", async function f({ interaction, user }){
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
	status = "running";
	machine.memory.push();
	const task = new Promise(async function(res, rej){
		const controller = new AbortController();
		const to = setTimeout(function(){
			rej();
			controller.abort();
		}, 5000);
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

			machine.buffer += output;
			machine.buffer = machine.buffer.slice(-4000000);
			if(output.includes('>'))
				machine.emit("run");
		});
		await events.once(machine, "run");
		console.log("RESTART");
		res();
	})

	interaction.editReply({ embeds: [ { ...options.embed.style,
		title: `UART / <@${user.id}>`,
		description: '```\n'
			+ machine.buffer.slice(-4000)
			+ '```'
	} ] });

	next();
});

async function get({
	components,
	interaction,
	user,
}, {
	row
}){
	console.log(row);

	const { min, max } = Math;
	const control = components[0].components;
	const control2 = components[1].components
	row = Number(row);
	row = max(0, row);
	control[0].custom_id = `up:${max(0, row - 1)}`;
	control[1].custom_id = `upm:${max(0, row - 5)}`;
	control[2].custom_id = `down:${row + 1}`;
	control[3].custom_id = `downm:${row + 5}`;
	control[4].custom_id = "edit";

	control2[0].custom_id = `insert:${row}`;
	control2[1].custom_id = `delete:${row}`;
	control2[2].custom_id = "cut";
	control2[3].custom_id = "paste";
	control2[4].custom_id = "none";

	control[0].label = "🔼";
	control[1].label = "⏫";
	control[2].label = "🔽";
	control[3].label = "⏬";
	control[4].label = "📝";

	control2[0].label = "📥";
	control2[1].label = "📤";
	control2[2].label = "📋";
	control2[3].label = "📄";
	control2[4].label = "⬛";


	const nlen = `${row + 50}`.length;
	const sfix = (str, len) =>
		' '.repeat(len - `${str}`.length)
		+ `${str}`

	let data = db.get(user.id, row);
	const lines = "0"
		.repeat(30)
		.split('')
		.map(function(_, i){
			return `${sfix(row + i, nlen)}│ `;
		});

	if(!(data instanceof Array))
		data = [ { row: 0, code: `# ` + lines } ];

	for(const entry of data){
		lines[entry.row - row]
			= `${sfix(entry.row, nlen)}│ `
			+ `${entry.code}`
	}

	let content = '```x86asm\n' + lines.slice(0, 30)
		.join('\n')
		+ '```'
	;

	content = content
		.split(`${row}│`)
	;

	content[0] += `${row}╚`;
	content = content[0] + content
		.slice(1)
		.join(`${row}│`)
	;

	await interaction.reply({
		embeds: [ { ...options.embed.style,
			title: `Franz Code Editor / <@${user.id}>`,
			description: content
		} ],

		components
	});
}


async function update({
	components,
	interaction,
	user,
}, {
	row
}){
	row = Number(row) || 0;
	const { min, max } = Math;
	const control = components[0].components;
	const control2 = components[1].components;
	row = max(0, row);
	control[0].custom_id = `up:${max(0, row - 1)}`;
	control[1].custom_id = `upm:${max(0, row - 5)}`;
	control[2].custom_id = `down:${row + 1}`;
	control[3].custom_id = `downm:${row + 5}`;
	control[4].custom_id = "edit";

	control2[0].custom_id = `insert:${row}`;
	control2[1].custom_id = `delete:${row}`;
	control2[2].custom_id = "cut";
	control2[3].custom_id = "paste";
	control2[4].custom_id = "none";

	control[0].label = "🔼";
	control[1].label = "⏫";
	control[2].label = "🔽";
	control[3].label = "⏬";
	control[4].label = "📝";

	control2[0].label = "📥";
	control2[1].label = "📤";
	control2[2].label = "📋";
	control2[3].label = "📄";
	control2[4].label = "⬛";


	const nlen = `${row + 50}`.length;
	const sfix = (str, len) =>
		' '.repeat(len - `${str}`.length)
		+ `${str}`

	let data = db.get(user.id, row);
	const lines = "0"
		.repeat(30)
		.split('')
		.map(function(_, i){
			return `${sfix(row + i, nlen)}│ `;
		});

	if(!(data instanceof Array))
		data = [ { row: 0, code: `# ` + lines } ];

	for(const entry of data){
		lines[entry.row - row]
			= `${sfix(entry.row, nlen)}│ `
			+ `${entry.code}`
	}

	let content = '```x86asm\n' + lines.slice(0, 30)
		.join('\n')
		+ '```'
	;

	content = content
		.split(`${row}│`)
	;

	content[0] += `${row}╚`;
	content = content[0] + content
		.slice(1)
		.join(`${row}│`)
	;

	await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			title: `UART / <@${user.id}>`,
			description: content
		} ],

		components
	});
}

franz.on("command.get", async function(...args){
	await get(...args);
});

function objjcopy(obj){
	return JSON.parse(JSON.stringify(obj));
}

async function updateRow({ interaction }, row){
	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});

	const { message } = interaction;
	const { min, max } = Math;
	const components = objjcopy(message.components);
	const control = components[0].components;
	const control2 = components[1].components
	console.log("---o", row);
	row = Number(row);
	row = max(0, row);
	control[0].custom_id = `up:${max(0, row - 1)}`;
	control[1].custom_id = `upm:${max(0, row - 5)}`;
	control[2].custom_id = `down:${row + 1}`;
	control[3].custom_id = `downm:${row + 5}`;

	control2[0].custom_id = `insert:${row}`;
	control2[1].custom_id = `delete:${row}`;

	const [ originCode ] = message.embeds;
	const code = JSON.parse(JSON.stringify(originCode));
	code.description = code.description
		.split(`╚`)
		.join(`│`)
	;

	console.log(`--> ${row}`);
	code.description = code.description
		.split(`${row}│`)
	;
	if(!(code.description[0].endsWith('\n')
		|| code.description[0].endsWith(' ')
	)){
		code.description[1] = null;
	}

	if(!code.description[1])
		return await update({
			interaction,
			components: interaction.message.components,
			user: interaction.user
		}, {
			row
		});

	//code.description[0] += `${row}║`;
	code.description[0] += `${row}╚`;
	code.description = code.description[0] + code.description
		.slice(1)
		.join(`${row}│`)
	;

	await message.edit({
		components: components,
		embeds: [
			code
		]
	});
}

franz.on("button.up", updateRow);
franz.on("button.down", updateRow);
franz.on("button.upm", updateRow);
franz.on("button.downm", updateRow);

async function textInput(id, title, { interaction }){
	const component = {
		type: 4, // Text Input
		custom_id: 'code',
		label: "Enter code",
		style: 2, // 1 for Short, 2 for Paragraph (Long)
		min_length: 1,
		max_length: 600,
		placeholder: "li a0, 'A'",
		required: true
	};

	// This must be a RESPONSE to an interaction (button, command, etc.)
	await interaction.showModal({
		custom_id: id,
		title,
		components: [
			{
				type: 1, // Action Row
				components: [
					component
				]
			}
		]
	});
}

franz.on("button.edit", async function(row){
	await textInput(`edit:${row}`, "Franz Code Editor",
		{ interaction },
		row
	);
});

franz.on("modal.edit", async function({ interaction }, row){
	const code = interaction.fields.getTextInputValue("code");
	const lines = code.split('\n').reverse();
	db.delete(interaction.user.id, row);
	for(const line of lines){
		db.insert(interaction.user.id, row, line);
	}

	await update({
		interaction,
		user: interaction.user,
		components: interaction.message.components
	}, {
		row
	});
});

franz.on("button.delete", async function({ interaction }, row){
	const { user, message } = interaction;
	const { components } = message
	db.delete(user.id, row);

	await update({
		interaction,
		user,
		components
	}, {
		row
	});

	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});
});

franz.on("button.insert", async function({ interaction }, row){
	await textInput(`insert:${row}`, "Franz Code Editor",
		{ interaction },
		row
	);
});

franz.on("modal.insert", async function({ interaction }, row){
	const code = interaction.fields.getTextInputValue("code");
	const lines = code.split('\n').reverse();
	for(const line of lines){
		db.insert(interaction.user.id, row, line);
	}

	await update({
		interaction,
		user: interaction.user,
		components: interaction.message.components
	}, {
		row
	});

	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});
});

franz.on("command.status", async function({ interaction, user }){
	await interaction.reply({
		content: "Status",
		embeds: [{ ...options.embed.style,
			description: status || "Error."
		}]
	});
});

franz.on("command.reset", async function({ interaction, user }){
	await interaction.reply({
		content: "Reset"
	});
});


machine.buffer = '';
machine.once("kernel", function(){ machine.run(function(output){
	if(!output)
		return ;

	machine.buffer += output;
	machine.buffer = machine.buffer.slice(-4000000);
});
	status = "idle";
	setInterval(function(){
		machine.memory[machine.memory.dict["mail"] + 3] = Date.now();
	}, 10)
});

machine.on("return", function(){
	status = "idle";
});
