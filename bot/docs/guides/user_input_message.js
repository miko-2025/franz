const franz = require("franz/bot");
const { options } = franz;
const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
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

