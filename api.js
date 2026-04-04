function FranzAPIHandler(handler, machine, user){ return function(api){
	return handler({ api, user },
		function read(len){
			return machine.memory.readAPI(len);
		},
		function write(str){
			return machine.memory.writeAPI(str)
		},
		function push(){
			return machine.interrupt();
		},
		function clean(len){
			return machine.memory.cleanAPI(len)
		}
	);
} }

class FranzAPI {
	constructor(machine, user){
		for(const [ event, handler ] of Object.entries(FranzAPI.api))
			machine.on(event, FranzAPIHandler(
				handler,
				machine,
				user
			));

		machine.on("api", function(id){
			console.log(`APIID -> ${id.toString()}`);
		});
	}
}

const api = FranzAPI.api = {};
/** PL_CH_MSG_NEW */
api["api.1810"] = async function(context, read, write, push, clean){
	const { interaction, bot } = context.user;
	const { message } = interaction;
	let content = await read(2048);
	if(content.endsWith("__json__")){
		try {
			content = JSON.parse(content.slice(0, -8));
		} catch(err){
			content = `${content} \n-# <@${interaction.user.id}> `
				+ `${(new Date()).toUTCString()}`
			;
		}
	} else {
		content = `${content} \n-# <@${interaction.user.id}> `
			+ `${(new Date()).toUTCString()}`
		;
	}

	const channel = await bot.channels.fetch(interaction.channelId);
	let sent;
	try {
		sent = await channel.send(typeof content == "object"
			? {
				...content,
				content: (content.content || "")
					+ `-# <@${interaction.user.id}>`
					+ ` ${(new Date()).toUTCString()}`
			} : {
				content
			}
		);
	} catch(err){

	}

	clean();

	await push();
}

module.exports = FranzAPI;
