const { db, ld, options, franz, machine } = require("franz/bot");
const { MessageFlags } = require('discord.js');
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
