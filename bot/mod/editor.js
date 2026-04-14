const { db, ld, franz, machine } = require("franz/bot");
const { MessageFlags } = require('discord.js');
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
