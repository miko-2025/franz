const franz = require("franz/bot");
const { options } = franz;
const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
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
