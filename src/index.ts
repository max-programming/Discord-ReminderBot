import * as config from "./config.json";
import { BOT_TOKEN, DEV_TOKEN, ADMIN_ID } from "./token.json";
import * as Discord from "discord.js";
import * as fs from "fs";
import { commandList } from "./Commands";
import ReminderManager from "./ReminderManager";
import Repeating from "./Reminders/Repeating";
import Single from "./Reminders/Single";

const prefix = config.PREFIX;
var queuedReminders: (Single | Repeating)[] = [];

const client = new Discord.Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
client.login(DEV_TOKEN);

ReminderManager.loadStoredReminders();

setInterval(() => {
    queueReminders();
}, 100);

setInterval(() => {
    checkReminder();
}, 500);

setInterval(() => {
    dumpRM();
}, 1000 * 60 * 60);

//dump when the app is closed
process.on("exit", dumpRM);

//catches ctrl+c event
process.on("SIGINT", exitHandler);

// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler);
process.on("SIGUSR2", exitHandler);

//catches uncaught exceptions
process.on("uncaughtException", exitHandler);

function exitHandler() {
    process.exit();
}

function dumpRM() {
    fs.writeFileSync(
        "./data/UserReminderData.json",
        JSON.stringify(ReminderManager.getUserReminders())
    );

    let date = new Date();

    console.log(`${date.getHours()}:${date.getMinutes()} Dumped UserReminders`);
}

function commandReceived(message: Discord.Message, success: boolean) {
    if (success) {
        message.react("✅");
    } else {
        message.react("❎");
    }
}

function deleteElement(array: (Single | Repeating)[], key: Single | Repeating) {
    const index = array.indexOf(key, 0);
    if (index > -1) {
        array.splice(index, 1);
    }
}

function queueReminders() {
    const date = new Date();

    const second = ReminderManager.getSecondByDate(date);
    if (!second) {
        return;
    }

    queuedReminders.push(...second.reminders);

    let parent = second.parent;

    delete parent.seconds[date.getSeconds()];

    ReminderManager.clean(parent, date);
}

function checkReminder() {
    queuedReminders.forEach((reminder) => {
        reminder.sendMessage(client);

        deleteElement(
            ReminderManager.getUserReminders().users[reminder.user],
            reminder
        );
    });

    queuedReminders = [];
}

client.on("ready", () => {
    client.user.setActivity("!help");
    client.user
        .setAvatar("./assets/avatar.png")
        .then((user) => console.log("New avatar set!"))
        .catch(console.error);
    console.log("Bot is ready!");
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const commandBody = message.content.slice(prefix.length);
    let call = commandBody.substr(0, commandBody.indexOf(" ")).toLowerCase();
    let body = commandBody.substr(commandBody.indexOf(" ") + 1);

    if (call === "") {
        call = body.toLowerCase();
    }

    commandList.forEach((command) => {
        if (command.aliases.includes(call)) {
            commandReceived(message, command.call(message, body));
        }
    });

    if (call == "dump" && message.author.id == ADMIN_ID) {
        dumpRM();
    }
});
