const franz = require("franz/bot");
const { options } = franz;
const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
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
