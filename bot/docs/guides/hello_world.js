const franz = require("franz/bot");
const { options } = franz;
const {
	REST,
	Routes,
	SlashCommandBuilder,
	MessageFlags
} = require('discord.js');
franz.on("select.guides.gui_hello_world", async function({ interaction }){
	await interaction.reply({
		embeds: [ { ...options.embed.style,
			description: [
"## Hello, World",
"Franz supports only RISC-V, so the following guide is meant",
"to teach a newcomer into RISC-V programming, starting with",
"a simple Hello, World"
			].join('\n')
		} ],
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: 'gui_hello_world:1'
			} ]
		} ]
	});
})

franz.on("button.gui_hello_world", async function({ interaction }, [ index ]){
	index = Number(index);
	const start = {
		components: [ {
			type: 1,
			components: [ {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_hello_world:${index + 1}`
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
				custom_id: `gui_hello_world:${index - 1}`
			}, {
				type: 2,
				label: 'Next',
				style: 2,
				custom_id: `gui_hello_world:${index + 1}`
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
				custom_id: `gui_hello_world:${index - 1}`
			}, {
				type: 2,
				label: 'Close',
				style: 2,
				custom_id: `gui_hello_world:-1`
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
"## Hello, World",
"Franz supports only RISC-V, so the following guide is meant",
"to teach a newcomer into RISC-V programming, starting with",
"a simple Hello, World"
			].join('\n')
		} ],

		...start
	}));

	(index == 1) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Before writing our first instruction, we must first
determine where our code will be in memory.

The memory layout in assembly is divided into sections.
our topmost section is the \`text\` section.

We will write our instructions there. The reason being
our kernel is configured to jump to the very first address
of the user code, which is the topmost section.

To move our pen to the \`text\` section, we write the following
				`,
				"```x86asm",
				`
.section .text
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 2) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next instruction is the \`global\` instruction, this
ensures our _start label is visible during linking.

If you didn't understand that, it is fine. Our kernel
ignores this process, however, we include it anyway for compatibility
				`,
				"```x86asm",
				`
.section .text
.global _start
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 3) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next is the \`_start\` label, a label allows marking an address,
so instead of writing an address in ram, you write the label instead.
this makes your code readable, by writing \`la t1, _start\` instead of
\`la t1, 0x80200000\`
				`,
				"```x86asm",
				`
.section .text
.global _start
_start:
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 4) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Okay, so we had the position, and label, so it's time for our
first instruction right? Well! not quite.

Before our actual first instruction, we will have to
instruct the machine to set aside a space in ram for us to
write to.

to do that, write \`PUSH_FRAME 16\`, this will give us 16 bytes,
and stores our return address. More on that later

I say not actual instruction because it is a macro, a sort
of "label" that allows you to use pre-written instructions.

the macro is not on our definitions however, therefore we
need to include a pre-written source file. \`franz.inc\`,
which contains the information about kernel abi layout, and our
macro. More on that later.
				`,
				"```x86asm",
				`
.include "franz.inc"     # <- include our macro definition here
.section .text
.global _start
_start:
	PUSH_FRAME 16
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 5) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Finally, our first real RISC-V instruction.
\`la a0, message\`

This put the address stored on our message label inside a0,
we haven't written the message label yet. More on that later.

instead, let's focus on what a0 is. a0 is a register,

what is that?

If you come from another programming language, imagine a
variable. It's something you can store a value in right?

Now, RISC-V only have 32 registers. so imagine 32 registers,
and that is all you can use. **Only** that, and a0 is one of
them.

I won't list the 32 registers here, instead I'll put them on
separate page.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 6) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Next, we write \`KCALL UART_PUTS\`, which as you may
have guessed, is a macro, or rather, two of them, let
me explain.

KCALL is a macro that remembers it's position, jump
to kernel, executes kernel instructions, and go back
to your code.

in a nutshell, it's a mailman, it brings your letter to
kernel, and brings you back the reply.

now, where does the mailman go? that's the UART_PUTS.
UART_PUTS hold the address to a kernel room, which
spares you from writing the room number manually, like
room 32 (\`KCALL 32\`), for example

Now we have broken it down, what does UART_PUTS do?
it takes the address we stored in a0 earlier, check it's
content, letter by letter, and send it through the uart.
our small terminal, fax, or messenger app if you may.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 7) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Finally, we end our instructions with \`POP_FRAME\` and \`ret\`.
POP_FRAME returns the ram space we just borrowed, so other
people can use it. now, we do need to say how much we borrowed,
too less and you will have a couple bytes that is lost forever,
and can never be used again, too much and you stole someone
else's ram, making the wonder where had their data gone to.

then the \`ret\` instruction. This tell the machine to go
back to kernel, and not the next line, where there's nothing.

With that, our instructions are done. But, this is not the end
yet. We still need to write our message label.
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
	POP_FRAME 16
	ret
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));


	(index == 8) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
And there we go, everything's set. after running the code,
we should get a result on our uart
				`,
				"```x86asm",
				`
.include "franz.inc"
.section .text
.global _start
_start:
	PUSH_FRAME 16
	la a0, message
	KCALL UART_PUTS
	POP_FRAME 16
	ret

message:
	.asciz "Hello, World!\\n"
				`,
				"```"
			].join('\n')
		} ],

		...next
	}));

	(index == 9) && (await interaction.message.edit({
		embeds: [ { ...options.embed.style,
			description: [,
				`
Perfect!, and there you have it, a basic Hello, World program
in RISC-V Assembly
				`,
				"```x86asm",
				`
> Hello, World
>
				`,
				"```"
			].join('\n')
		} ],

		...end
	}));
});
