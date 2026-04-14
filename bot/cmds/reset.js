const { db, ld, options, franz, machine } = require("franz/bot");
const { MessageFlags } = require('discord.js');
franz.on("command.reset", async function({ interaction, user }){
	await interaction.reply({
		content: "Reset"
	});
});

