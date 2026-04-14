const { db, ld, options, franz, machine } = require("franz/bot");
const { MessageFlags } = require('discord.js');
franz.on("command.status", async function({ interaction, user }){
	await interaction.reply({
		content: "Status",
		embeds: [{ ...options.embed.style,
			description: status || "Error."
		}]
	});
});
