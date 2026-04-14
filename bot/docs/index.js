const franz = require("franz/bot");
const { options } = franz;
const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
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
});
