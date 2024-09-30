// AutoIndex.js

// Imports and Initial Configurations
const clear = require('console-clear');
const figlet = require('figlet');
const Table = require('cli-table3');
const colors = require('colors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

// Import functions from apis.js
const {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit
} = require('./scripts/apis');

// Directories and file paths
const sessionsFolder = path.join(__dirname, 'sessions');
const colorsPath = path.join(__dirname, 'colors.json');
const accountsPath = path.join(__dirname, 'accounts.json');
const telegramAPIsPath = path.join(__dirname, 'TelegramAPIs.json');

// Create directories if they don't exist
if (!fs.existsSync(sessionsFolder)) {
    fs.mkdirSync(sessionsFolder);
}

// Load colors.json
let colorsList = [];

try {
    const colorsData = fs.readFileSync(colorsPath, 'utf-8');
    colorsList = JSON.parse(colorsData);
} catch (error) {
    console.error('Error loading colors.json'.red);
    process.exit(1);
}

// Load accounts.json (tgWebAppData)
let accountsWebAppData = [];

try {
    const accountsData = fs.readFileSync(accountsPath, 'utf-8');
    accountsWebAppData = JSON.parse(accountsData);
} catch (error) {
    // If it doesn't exist, initialize it as an empty array
    accountsWebAppData = [];
}

// Load TelegramAPIs.json
let telegramAPIs = [];

try {
    const telegramAPIsData = fs.readFileSync(telegramAPIsPath, 'utf-8');
    telegramAPIs = JSON.parse(telegramAPIsData);
} catch (error) {
    console.error('Error loading TelegramAPIs.json'.red);
    process.exit(1);
}

// Map to store accounts and their clients
const accounts = new Map();

// Function to log in with a phone number
async function loginWithPhoneNumber(account) {
    const { id, api_id, api_hash, phone_number } = account;
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, Number(api_id), api_hash, { connectionRetries: 5 });

    console.log(`Logging in with phone number: ${phone_number}`);

    await client.start({
        phoneNumber: async () => phone_number,
        phoneCode: async () => {
            // Here you should implement a way to automatically obtain the verification code.
            // For full automation, you need a method to receive the code without manual intervention.
            // If you don't have one, this step cannot be fully automated.
            throw new Error("Cannot automate the entry of the verification code.");
        },
        password: async () => {
            // Similarly, if a password is required, you need to automate its retrieval.
            throw new Error("Cannot automate the entry of the password.");
        },
        onError: (error) => console.error("Error:", error),
    }).catch(error => {
        console.error(`Error logging in with ${phone_number}:`, error.message);
    });

    console.log('Successfully logged in');

    const sessionString = client.session.save();
    const sessionFile = path.join(sessionsFolder, `${id}_session`);

    fs.writeFileSync(sessionFile, sessionString, 'utf8');
    console.log(`Session saved in ${sessionFile}`);
    accounts.set(phone_number, client);
}

// Function to log in with a session file or phone number
async function loginWithSessionFile(account) {
    const { id, api_id, api_hash, phone_number } = account;
    const sessionFile = path.join(sessionsFolder, `${id}_session`);

    if (!fs.existsSync(sessionFile)) {
        console.log(`Session file for account ID ${id} not found.`);
        await loginWithPhoneNumber(account);
        return;
    }

    const sessionData = fs.readFileSync(sessionFile, 'utf-8');

    if (!sessionData || sessionData.trim() === '') {
        console.log(`The session file for account ID ${id} is empty or invalid.`);
        await loginWithPhoneNumber(account);
        return;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionData), Number(api_id), api_hash, { connectionRetries: 5 });
        await client.connect();
        console.log(`Logged in using the session file for account ID: ${id}`);
        accounts.set(phone_number, client);
    } catch (error) {
        console.error(`Error logging in using the session file for account ID ${id}:`, error.message);
        await loginWithPhoneNumber(account);
    }
}

// Function to load all accounts
async function loadAllAccounts() {
    for (const account of telegramAPIs) {
        await loginWithSessionFile(account);
    }
}

// Function to request WebView and obtain the tgWebAppData
async function requestWebViewForClient(client, phoneNumber) {
    const botPeer = '@notpx_bot';
    const url = 'https://app.notpx.app';

    try {
        const result = await client.invoke(
            new Api.messages.RequestWebView({
                peer: botPeer,
                bot: botPeer,
                fromBotMenu: false,
                url: url,
                platform: 'android',
            })
        );

        // Extract the URL fragment
        const urlFragment = result.url.split('#')[1];

        // Parse the fragment as URL parameters
        const params = new URLSearchParams(urlFragment);

        // Get tgWebAppData without decoding it
        const tgWebAppData = params.get('tgWebAppData');

        if (!tgWebAppData) {
            console.error(`Could not extract tgWebAppData for account ${phoneNumber}`);
            return null;
        }

        // tgWebAppData is URL-encoded, keep it that way
        console.log(colors.green(`Extracted tgWebAppData for account ${phoneNumber}: ${tgWebAppData}`));

        return tgWebAppData;
    } catch (error) {
        console.error("Error requesting WebView:", error);
        return null;
    }
}

// Function to update tgWebAppData
async function updateWebAppData() {
    accountsWebAppData = []; // Clear the in-memory variable

    for (const account of telegramAPIs) {
        const { phone_number } = account;
        const client = accounts.get(phone_number);
        if (!client) {
            console.error(`Client not found for account ${phone_number}`);
            accountsWebAppData.push(null);
            continue;
        }

        const tgWebAppData = await requestWebViewForClient(client, phone_number);
        if (tgWebAppData) {
            accountsWebAppData.push(tgWebAppData);
        } else {
            accountsWebAppData.push(null);
        }
    }

    fs.writeFileSync(accountsPath, JSON.stringify(accountsWebAppData, null, 2), 'utf8');
    console.log('accounts.json updated with new tgWebAppData');
}

// Function to clear the console and display the header
const displayHeader = () => {
    clear();
    const banner = figlet.textSync('NOTPIXEL', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });
    console.log(colors.blue(banner));
};

// Function to select a random color
const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * colorsList.length);
    return colorsList[randomIndex][0]; // Returns the color code
};

// Function to generate a random pixelId between 1 and 1,000,000
const getRandomPixelId = () => {
    return Math.floor(Math.random() * 1000000) + 1;
};

// Function to handle errors and retry actions
async function performActionWithRetry(actionFunction, dataIndex) {
    try {
        await actionFunction();
    } catch (error) {
        if (error.response && [401, 403].includes(error.response.status)) {
            console.log(`tgWebAppData for account ID ${dataIndex + 1} expired. Updating...`);
            const accountEntry = telegramAPIs[dataIndex];
            await loginWithSessionFile(accountEntry);
            const client = accounts.get(accountEntry.phone_number);
            const newWebAppData = await requestWebViewForClient(client, accountEntry.phone_number);
            if (newWebAppData) {
                accountsWebAppData[dataIndex] = newWebAppData;
                fs.writeFileSync(accountsPath, JSON.stringify(accountsWebAppData, null, 2), 'utf8');
                console.log('accounts.json updated with new tgWebAppData');
                // Retry the action
                await actionFunction();
            } else {
                console.error(`Could not update tgWebAppData for account ID ${accountEntry.id}`);
            }
        } else {
            throw error;
        }
    }
}

// Function to paint the world
const paintTheWorld = async () => {
    console.log('\n🔄 '.blue + "Painting the World with all your Users".blue);

    for (let i = 0; i < accountsWebAppData.length; i++) {
        let tgWebAppData = accountsWebAppData[i];
        if (!tgWebAppData) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(tgWebAppData);
                const miningStatus = await getMiningStatus(tgWebAppData);

                const firstName = userInfo.firstName.split(' ')[0];
                const charges = miningStatus.charges;

                if (charges === 0) {
                    console.log(`\n🔴 ${firstName} cannot paint now. Wait 10 minutes for the next painting.`.red);
                    return;
                }

                console.log(`\n🎨 Painting with ${firstName} - Please wait while creating art.`.yellow);

                for (let j = 0; j < charges; j++) {
                    const newColor = getRandomColor();
                    const pixelId = getRandomPixelId();

                    try {
                        const repaintResponse = await startRepaint(tgWebAppData, newColor, pixelId);
                        if (repaintResponse.balance !== undefined) {
                            const balance = parseFloat(repaintResponse.balance).toFixed(2);
                            console.log(`✅ ${firstName} - Painted pixel ${pixelId} with color ${newColor} - Your points are now ${balance}`.green);
                        } else {
                            console.log(`⛔️ ${firstName} could not paint pixel ${pixelId}.`.red);
                        }
                    } catch (error) {
                        console.log(`⛔️ ${firstName} could not paint pixel ${pixelId}.`.red);
                    }

                    // Wait 500ms between repaint attempts
                    await new Promise(res => setTimeout(res, 500));
                }

            } catch (error) {
                console.log(`⛔️ Error processing account ${i + 1}.`.red);
            }
        };

        await performActionWithRetry(actionFunction, i);

        // Wait 500ms between rotating accounts
        await new Promise(res => setTimeout(res, 500));
    }
};

// Main function for AutoIndex.js
const main = async () => {
    displayHeader();
    await loadAllAccounts();
    await updateWebAppData();

    // Function to execute painting and schedule the next execution
    const executePaint = async () => {
        await paintTheWorld();
        console.log('\n✅ Paint cycle completed. Waiting 10 minutes for the next cycle...'.green);
        setTimeout(executePaint, 10 * 60 * 1000); // 10 minutes in milliseconds
    };

    // Start the first cycle
    executePaint();
};

// Start the AutoIndex.js
(async () => {
    main();
})();
