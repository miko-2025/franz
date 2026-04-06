console.log("bot/index.js ok")

const { TOKEN } = require("franz/config.json");
const events = require("events");
const Franz = require("franz");
const franz = new Franz.Franz();
const fs = require("fs/promises");
const machine = require("franz/bot/machine");
let status = "off";

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
		[ 3, "uart", "set to true to show uart, default is true", 0 ],
		[ 0, "input", "a text to pass to the user code", 0 ],
		[ 2, "user", "the user whose code you wanted to run", 0 ]
	] ],

	[ "help", "Franz RISC-V Assembler and Execution Manual", [
		[ 0, "page", "page index to open", 0 ],
		[ 1, "topic", "topic to look for", 0 ],
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

		if(type == 2){
			slash.addUserOption(set);
		}

		if(type == 3){
			slash.addBooleanOption(set);
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

	if(interaction.isStringSelectMenu()){
		const [ modal, ...args ] = interaction.customId
			.split(':')
		;

		console.log(`select.${modal}`);
		franz.emit(`select.${modal}`, {
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
				carg, {
				 	input: options.getString("input"),
					user: options.getUser("user"),
					uart: options.getBoolean("uart")
				}
			);

			return ;
		}
		case "help": {
			franz.emit(`command.${commandName}`,
				carg, {
					page: options.getInteger("page"),
					topic: options.getString("topic")
				}
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
	control2[2].custom_id = `cut:${row}`;
	control2[3].custom_id = "paste:${row}";
	control2[4].custom_id = "run";

	control[0].label = "🔼";
	control[1].label = "⏫";
	control[2].label = "🔽";
	control[3].label = "⏬";
	control[4].label = "📝";

	control2[0].label = "↪️";
	control2[1].label = "❌";
	control2[2].label = "✂️";
	control2[3].label = "📋";
	control2[4].label = "▶️";


	const nlen = `${row + 50}`.length;
	const sfix = (str, len) =>
		' '.repeat(Math.max(0, len - `${str}`.length))
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
	control2[2].custom_id = `cut:${row}`;
	control2[3].custom_id = "paste:${row}";
	control2[4].custom_id = "run";

	control[0].label = "🔼";
	control[1].label = "⏫";
	control[2].label = "🔽";
	control[3].label = "⏬";
	control[4].label = "📝";

	control2[0].label = "↪️";
	control2[1].label = "❌";
	control2[2].label = "✂️";
	control2[3].label = "📋";
	control2[4].label = "▶️";

	const nlen = `${row + 50}`.length;
	const sfix = (str, len) =>
		' '.repeat(Math.max(0, len - `${str}`.length))
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
	control2[2].custom_id = `cut:${row}`;
	control2[3].custom_id = "paste:${row}";
	control2[4].custom_id = "run";

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

async function cutInput(id, title, { interaction }, row){
	const size = {
		type: 4,
		custom_id: `row`,
		label: "How many lines to cut?",
		style: 1,
		placeholder: "1",
		required: true
	};

	await interaction.showModal({
		custom_id: id,
		title,
		components: [
			{
				type: 1,
				components: [
					size
				]
			}
		]
	});
}

franz.on("button.edit", async function({ interaction }, row){
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

franz.on("button.run", async function({ interaction }, row){
	return interaction.reply({ content:
		"This button is currently broken. Use the /run command"
	});
});

franz.on("modal.cut", async function({ interaction }, row){
	return interaction.reply({ content:
		"This button is currently broken. Sorry for the inconvenience"
	})

	const end = Number(interaction.fields.getTextInputValue("row"));
	if(isNaN(end))
		return await interaction.reply({
			flags: [ MessageFlags.Ephmeral ],
			content: `${end} is not a valid number.`
		});

	db.cut(interaction.user.id, row, end)
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

franz.on("button.cut", async function({ interaction }, row){
	await cutInput(`cut:${row}`, "Franz Code Editor",
		{ interaction },
		row
	);
});

franz.on("button.paste", async function({ interaction }, row){
	// TODO: out of order, sqlite cut does not preserve order
	return interaction.reply({ content:
		"This button is currently broken. Sorry for the inconvenience"
	})

	db.paste(interaction.user.id, row);

	await update({
		interaction,
		user: interaction.user,
		components: interaction.message.components
	}, {
		row
	});

	await interaction.reply({
		content: "Ok.",
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

function help_grsel(){
	const gselect = [
		{
			label: "Franz Code Editor",
			value: "gui_code_editor",
			description: "Introduction to Franz Code Editor"
		},
		{
			label: "Hello, World!",
			value: "gui_hello_world",
			description: "Get started with RISC-V programming "
				+ "by checking our Hello, World example"
		},
		{
			label: "Sending Message in Discord",
			value: "gui_send_message",
			description: "Send message in chat with our Discord "
				+ "API Integration"
		},
		{
			label: "Reading User Input from Discord",
			value: "gui_user_input_message",
			description: "Read user input specified "
				+ "within the /run command"
		}
	]

	const rselect = [
		{
			label: "Core, Graphics, Audio, and Network",
			value: "ref_1",
			description: "Print text to uart, manipulate pixels"
				+ ", emit sounds and send network requests"
		},
		{
			label: "CPU & Time",
			value: "ref_2",
			description: "CPU Delay, Frequencies, and More"
		},
		{
			label: "Strings & Memory",
			value: "ref_3",
			description: "Manipulate strings and ram data"
		}
	]

	return [ gselect, rselect ];
}

franz.on("command.help", async function({ interaction }, { page, topic }){
	const banner = { ...options.embed.style,
		image: {
			url: `https://cdn.discordapp.com/attachments/1426823437636337768/1490251893157662762/help_page_manual.jpg?ex=69d360ba&is=69d20f3a&hm=2d6f60161851243ecdf18d9274ee9e5d1523855343126cd9c3cf05cf475a1fa8&`
		}
	}

	const [ gselect, rselect ] = help_grsel();

	try {
		const commands = await franz.application.commands.fetch();
		const list = Array.from(commands).map(([ _, cmd ], i) =>
			`</${cmd.name}:${cmd.id}>`
				+ ((i % 2)
					? "\n\n## "
					: ' '.repeat(20 - cmd.name.length)
				)
		);

		const content = { ...options.embed.style,
			color: 0xACCF54,
			description: [
				`## Commands`,
				`## ${list.join('')} \` \``,
				'-# __' + ' '.repeat(80) + '__',
			].join('\n')
		}

		const egui = { ...options.embed.style,
			description: [
				`## Guides`,
				gselect.map(r => '- ' + r.label).join('\n'),
				'-# __' + ' '.repeat(80) + '__',
			].join('\n')

		}

		const eref = { ...options.embed.style,
			color: 0xACCFFF,
			description: [
				`## References`,
				rselect.map(r => '- ' + r.label).join('\n'),
				'-# __' + ' '.repeat(80) + '__',
			].join('\n')
		}

		await interaction.reply({ embeds: [
			banner,
			content,
			egui,
			eref
		], components: [
			{
				type: 1,
				components: [{
					type: 3,
					custom_id: "guides",
					placeholder: "Guides",
					options: [
						...gselect
					]
				}]
			},
			{
				type: 1,
				components: [{
					type: 3,
					custom_id: "references",
					placeholder: "References",
					options: [
						...rselect
					]
				}]
			}
		] });

		return ;
	} catch (error) {
		console.error('Error fetching commands:', error);
	}

	try {
		await interaction.reply(`Something went wrong.`)
	} catch(error){

	}

	return ;
});

franz.on("select.guides", async function(...args){
	const [ select ] = args[0].interaction.values;
	franz.emit(`select.guides.${select}`, ...args);

	const [ gselect, rselect ] = help_grsel();
	try {
		await args[0].interaction.message.edit({
			 components: [
				{
					type: 1,
					components: [{
						type: 3,
						custom_id: "guides",
						placeholder: "Guides",
						options: [
							...gselect
						]
					}]
				},
				{
					type: 1,
					components: [{
						type: 3,
						custom_id: "references",
						placeholder: "References",
						options: [
							...rselect
						]
					}]
				}
			]
		})
	} catch(err){

	}
})

const guides = [];
guides.push(async function({ interaction }){

});

/*
*/
franz.on("select.guides.gui_code_editor", async function({ interaction }){
	await interaction.reply({
		embeds: [ { ...options.embed.style,
			description: [
"## Franz Code Editor",
"Franz code editor is made as an interface to ",
"write your code into the bot.",
"",
"It is meant for ease of use and to replace the /set commands."
			].join('\n')
		} ],
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: 'gui_code_editor:1'
			} ]
		} ]
	});
})

franz.on("button.gui_code_editor", async function({ interaction }, [ index ]){
	index = Number(index);
	const start = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_code_editor:${index + 1}`
			} ]
		} ]
	};

	const next = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Previous',
				style: 2,
				custom_id: `gui_code_editor:${index - 1}`
			}, {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_code_editor:${index + 1}`
			} ]
		} ]
	};

	const end = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Previous',
				style: 2,
				custom_id: `gui_code_editor:${index - 1}`
			}, {
				type: 2,
				label: 'Close',
				style: 2,
				custom_id: `gui_code_editor:-1`
			} ]
		} ]
	};

	console.log(index, next);

	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});

	if(index < 0)
		return await interaction.message.delete();


	(index == 0) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
"## Franz Code Editor",
"Franz code editor is made as an interface to ",
"write your code into the bot.",
"",
"It is meant for ease of use and to replace the /set commands."
			].join('\n')
		} ],

		...start
	}));

	(index == 1) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
				"## Opening the Editor",
				"Run the /get command to open the editor. "
				+ "Specify a line and it will open the editor",
				"starting with that line."
			].join('\n'),
			image: {
				url: "https://cdn.discordapp.com/attachments/1447617158124408912/1490331302174527699/sketch1775392919095.jpg?ex=69d3aaaf&is=69d2592f&hm=2446808f74276f380308f5894c6b06ed2ca83370de26ce165e8afa82450f106a&"
			}
		} ],

		...next
	}));

	(index == 2) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
				"## Controls",
				"There are 10 control buttons total.",
				"",
				"- up",
				"`    ` moves the cursor up one line",
				"- up2",
				"`    ` moves the cursor up 5 lines",
				"- down",
				"`    ` moves the cursor down one line",
				"- down2",
				"`    ` moves the cursor down 5 lines",
				"- edit",
				"`    ` edit the line you selected "
					+ "(notice the cursor)",
				"",
				"The numbers on the left shows where "
					+ "the lines are"
			].join('\n'),
			image: {
				url: "https://cdn.discordapp.com/attachments/1447617158124408912/1490331302455541770/sketch1775392980735.jpg?ex=69d3aaaf&is=69d2592f&hm=573d96b7ab01f080a890dbd4cb98327cdad616e0ac9348eb64d17fc250a47bf0&"
			}
		} ],

		...next
	}));

	(index == 3) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
				"## Controls",
				"- insert",
				"`    ` insert at cursor, moving down the rest",
				"- delete",
				"`    ` delete at cursor, moving up the rest",
				"- cut",
				"`    ` cut at cursor",
				"- paste",
				"`    ` paste at cursor, inserting cut lines",
				"- run",
				"`    ` run your code",
				"",
			].join('\n'),
			image: {
				url: "https://cdn.discordapp.com/attachments/1447617158124408912/1490331302740885615/sketch1775392993643.jpg?ex=69d3aaaf&is=69d2592f&hm=69a77c0fe43e0ccd55f5941480a59101cf9ceef041fba88f67e9d2d07a57b318&"
			}
		} ],

		...next
	}));

	(index == 4) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
"# Insert",
`Insertion writes your code at the cursor and then moves down the rest.`,
"You may specify multiple lines of code, and the bot will ",
"handle the rest automatically",
"",
"Upon pressing the insert button, you will be prompted to write your code",
"after you finish writing, press the submit button and your changes will",
"be reflected at the editor."
			].join('\n'),
			image: {
				url: "https://cdn.discordapp.com/attachments/1447617158124408912/1490331303013388409/sketch1775393011572.jpg?ex=69d3aaaf&is=69d2592f&hm=3e5cee8bf827a841eff994c84a3834a4971c40fafee9fee7ce164245d0db44da&"
			}
		} ],

		...next
	}));

	(index == 5) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			image: {
				url: "https://cdn.discordapp.com/attachments/1447617158124408912/1490331303298596965/sketch1775393037161.jpg?ex=69d3aaaf&is=69d2592f&hm=b5eb6862c44112721e16a467cba166e5a5eaf79f3dd3f0a55bf0d682d3da3d8f&"
			}
		} ],

		...end
	}));
});


franz.on("select.guides.gui_hello_world", async function({ interaction }){
	await interaction.reply({
		embeds: [ { ...options.embed.style,
			description: [
"## Hello, World",
"Franz supports only RISC-V, so the following guide is meant",
"to teach a newcomer into RISC-V programming, starting with",
"a simple Hello, World"
			].join('\n')
		} ],
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: 'gui_hello_world:1'
			} ]
		} ]
	});
})

franz.on("button.gui_hello_world", async function({ interaction }, [ index ]){
	index = Number(index);
	const start = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_hello_world:${index + 1}`
			} ]
		} ]
	};

	const next = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Previous',
				style: 2,
				custom_id: `gui_hello_world:${index - 1}`
			}, {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_hello_world:${index + 1}`
			} ]
		} ]
	};

	const end = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Previous',
				style: 2,
				custom_id: `gui_hello_world:${index - 1}`
			}, {
				type: 2,
				label: 'Close',
				style: 2,
				custom_id: `gui_hello_world:-1`
			} ]
		} ]
	};

	console.log(index, next);

	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});

	if(index < 0)
		return await interaction.message.delete();


	(index == 0) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [
"## Hello, World",
"Franz supports only RISC-V, so the following guide is meant",
"to teach a newcomer into RISC-V programming, starting with",
"a simple Hello, World"
			].join('\n')
		} ],

		...start
	}));

	(index == 1) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Before writing our first instruction, we must first
determine where our code will be in memory.

The memory layout in assembly is divided into sections.
our topmost section is the \`text\` section.

We will write our instructions there. The reason being
our kernel is configured to jump to the very first address
of the user code, which is the topmost section.

To move our pen to the \`text\` section, we write the following
				`,
				"```x86asm",
				`
.section .text
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 2) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next instruction is the \`global\` instruction, this
ensures our _start label is visible during linking.

If you didn't understand that, it is fine. Our kernel
ignores this process, however, we include it anyway for compatibility
				`,
				"```x86asm",
				`
.section .text
.global _start
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 3) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next is the \`_start\` label, a label allows marking an address,
so instead of writing an address in ram, you write the label instead.
this makes your code readable, by writing \`la t1, _start\` instead of
\`la t1, 0x80200000\`
				`,
				"```x86asm",
				`
.section .text
.global _start
_start:
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 4) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Okay, so we had the position, and label, so it's time for our
first instruction right? Well! not quite.

Before our actual first instruction, we will have to
instruct the machine to set aside a space in ram for us to
write to.

to do that, write \`PUSH_FRAME 16\`, this will give us 16 bytes,
and stores our return address. More on that later

I say not actual instruction because it is a macro, a sort
of "label" that allows you to use pre-written instructions.

the macro is not on our definitions however, therefore we
need to include a pre-written source file. \`franz.inc\`,
which contains the information about kernel abi layout, and our
macro. More on that later.
				`,
				"```x86asm",
				`
.include "franz.inc"     # <- include our macro definition here
.section .text
.global _start
_start:
	PUSH_FRAME 16
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 5) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Finally, our first real RISC-V instruction.
\`la a0, message\`

This put the address stored on our message label inside a0,
we haven't written the message label yet. More on that later.

instead, let's focus on what a0 is. a0 is a register,

what is that?

If you come from another programming language, imagine a
variable. It's something you can store a value in right?

Now, RISC-V only have 32 registers. so imagine 32 registers,
and that is all you can use. **Only** that, and a0 is one of
them.

I won't list the 32 registers here, instead I'll put them on
separate page.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 6) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next, we write \`KCALL UART_PUTS\`, which as you may
have guessed, is a macro, or rather, two of them, let
me explain.

KCALL is a macro that remembers it's position, jump
to kernel, executes kernel instructions, and go back
to your code.

in a nutshell, it's a mailman, it brings your letter to
kernel, and brings you back the reply.

now, where does the mailman go? that's the UART_PUTS.
UART_PUTS hold the address to a kernel room, which
spares you from writing the room number manually, like
room 32 (\`KCALL 32\`), for example

Now we have broken it down, what does UART_PUTS do?
it takes the address we stored in a0 earlier, check it's
content, letter by letter, and send it through the uart.
our small terminal, fax, or messenger app if you may.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 7) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Finally, we end our instructions with \`POP_FRAME\` and \`ret\`.
POP_FRAME returns the ram space we just borrowed, so other
people can use it. now, we do need to say how much we borrowed,
too less and you will have a couple bytes that is lost forever,
and can never be used again, too much and you stole someone
else's ram, making the wonder where had their data gone to.

then the \`ret\` instruction. This tell the machine to go
back to kernel, and not the next line, where there's nothing.

With that, our instructions are done. But, this is not the end
yet. We still need to write our message label.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
	POP_FRAME 16
	ret
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));


	(index == 8) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
And there we go, everything's set. after running the code,
we should get a result on our uart
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
	POP_FRAME 16
	ret

message:
	.asciz "Hello, World!\n"
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 9) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Perfect!, and there you have it, a basic Hello, World program
in RISC-V Assembly
				`,
				"```x86asm",
				`
> Hello, World
>
				`,
				"```"
			].join('\n')
		} ],

		...end
	}));
});

// Kver jer


franz.on("select.guides.gui_send_message", async function({ interaction }){
	await interaction.reply({
		embeds: [ { ...options.embed.style,
			description: [
"## Send Message",
"Franz provides a dozen KCALL addresses to interact ",
"with Discord API.",
"",
"One of them is PL_CH_MSG_NEW",
"The usage is similar to the hello world program",
"load string to a0, and it will send them",
"",
"You can provide message json string instead, for",
"complex messages such as components and embeds",
"json must end with `__json__` however",
"```x86asm",
`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL PL_CH_MSG_NEW
	la a0, complex
	KCALL PL_CH_MSG_NEW
	POP_FRAME 16
	ret

message: .asciz "Hello, Chat!"
complex: .asciz "{ \\\"embeds\\\": [ { \\\"title\\\": \\\"My Embed\\\", \\\"description\\\": \\\"My Description\\\" } ] }__json__"
`,
"```"
			].join('\n')
		} ],
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Close',
				style: 2,
				custom_id: `gui_send_message:-1`
			} ]
		} ]
	});
})


franz.on("button.gui_send_message", async function(
	{ interaction }, [ index ]
){
	index = Number(index);
	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});

	if(index < 0)
		return await interaction.message.delete();
});


franz.on("select.guides.gui_user_input_message", async function(
	{ interaction }
){
	await interaction.reply({
		embeds: [ { ...options.embed.style,
			description: [
"## User Input Message",
"Franz provides the user code with user input and information",
"at the start of the execution.",
"",
"It is stored at the API result address, which is offset `0x2008`",
"from mailbox `s0`",
"```x86asm",
`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	li a0, 0x2008
	add a0, s0, a0
	KCALL UART_PUTS
	POP_FRAME 16
	ret
`,
"```"
			].join('\n')
		} ],
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Close',
				style: 2,
				custom_id: `gui_send_message:-1`
			} ]
		} ]
	});
})

franz.on("button.gui_user_input_message", async function(
	{ interaction }, [ index ]
){
	index = Number(index);
	await interaction.deferUpdate({
		flags: [ MessageFlags.Ephemeral ]
	});

	if(index < 0)
		return await interaction.message.delete();
});

franz.on("ready", function(){
	machine.kernel();
})

franz.login(TOKEN)
