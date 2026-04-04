const {
	FranzMachine,
	FranzProgram
} = require("franz");

const fs = require("fs/promises");
const franz = new FranzMachine();
async function test(){
	const list = await fs.readdir(`${__dirname}/tests`);
	for(const test of list){
		await (require(`${__dirname}/tests/${test}`))(franz);
	}
}

franz.once("kernel", function(){
	if(process.argv.includes("-noboot"))
		franz.run(null, 1);
	else
		franz.run();
});

franz.once("run", function(){
	console.log("run");
	new Promise(test);
});

franz.kernel();
