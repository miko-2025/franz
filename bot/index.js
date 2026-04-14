const { TOKEN } = require("franz/config.json");
const events = require("events");
const Franz = require("franz");
const franz = new Franz.Franz();
franz.franz = franz;
const fs = require("fs/promises");
const machine = require("franz/bot/machine");
let status = "off";

machine.apiUser.bot = franz;
module.exports = franz;

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
franz.ld = ld;
const FranzDB = require("franz/bot/sqlite.js");
const db = new FranzDB();
const cooldown = new Map();

franz.db = db;
const options = { embed: {
	style: {
		color: 0x4FCF6F
	},
	error: {
		color: 0xFC6F4F
	}
} }

franz.machine = machine;
franz.options = Object.assign(franz.options, options);

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

	try {
		require(`franz/bot/cmds/${command[0]}`)
	} catch(error){
		console.log(error);
	}

	return slash;
});

try {
	const modules = [ "editor" ];
	require(`franz/bot/mod/${modules[0]}`)
} catch(error){
	console.log(error);
}

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

[ "./docs/",
	"./docs/guides",
	"./docs/guides/code_editor",
	"./docs/guides/hello_world",
	"./docs/guides/send_message",
	"./docs/guides/user_input_message"
].map(e => require(e));


franz.on("ready", function(){
	machine.kernel();
})

franz.login(TOKEN)
