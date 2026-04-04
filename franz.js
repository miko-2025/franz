const Discord = require("discord.js");
const { Client, GatewayIntentBits, Options } = Discord;

class Franz extends Discord.Client {
	constructor(...args){
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages
			],
			makeCache: Options.cacheWithLimits({
				MessageManager: 0,
				ThreadManager: 0,
				PresenceManager: 0,
				ReactionManager: 0,
				GuildMemberManager: 0,
				UserManager: 0,
				GuildEmojiManager: 0,
			}),
			sweepers: {
				...Options.DefaultSweeperSettings,

				messages: {
				    interval: 300,
				    lifetime: 60,
				},
			},

			...args[0]
		}, ...args.slice(1));
	}
}

module.exports = Franz;
