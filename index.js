// index.js

// Imports and Initial Configurations
const clear = require('console-clear');
const figlet = require('figlet');
const Table = require('cli-table3');
const colors = require('colors');
const axios = require('axios');
const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');

// Import Telegram functions
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

// Function to ask the user (using readline-sync)
function askQuestion(question) {
    return readlineSync.question(question);
}

// Function to log in with a phone number
async function loginWithPhoneNumber(account) {
    const { id, api_id, api_hash, phone_number } = account;
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, Number(api_id), api_hash, { connectionRetries: 5 });

    console.log(`Logging in with phone number: ${phone_number}`);

    await client.start({
        phoneNumber: async () => phone_number,
        phoneCode: async () => await askQuestion(`Enter the code you received on ${phone_number}: `),
        password: async () => await askQuestion("Enter your password (if required): "),
        onError: (error) => console.error("Error:", error),
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
        console.log(`Extracted tgWebAppData for account ${phoneNumber}: ${tgWebAppData}`);

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

// Function to display the accounts table
const displayAccountsTable = async () => {
    const table = new Table({
        head: [
            'ID'.red,
            'Name'.red,
            'PX Farmed'.red,
            'Paint Chances'.red,
            'League'.red,
            'Squad'.red
        ]
    });

    for (let i = 0; i < accountsWebAppData.length; i++) {
        const tgWebAppData = accountsWebAppData[i];
        if (!tgWebAppData) {
            table.push([
                i + 1,
                'No tgWebAppData'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red
            ]);
            continue;
        }
        try {
            const userInfo = await getUserInfo(tgWebAppData);
            const miningStatus = await getMiningStatus(tgWebAppData);

            const name = userInfo.firstName.split(' ')[0];
            const balance = userInfo.balance;
            const charges = miningStatus.charges;
            const league = userInfo.league;
            const squadName = userInfo.squad && userInfo.squad.name ? userInfo.squad.name : 'N/A';

            table.push([
                i + 1,
                name,
                balance,
                charges,
                league,
                squadName
            ]);
        } catch (error) {
            table.push([
                i + 1,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red
            ]);
        }
    }

    console.log(table.toString());
};

// Function to pause execution until the user presses Enter
const pause = () => {
    return new Promise((resolve) => {
        readlineSync.question('\nPress Enter to return to the main menu...');
        resolve();
    });
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

// Option 1: Paint the World
const paintTheWorld = async () => {
    console.log('\n🔄 '.blue + "Let's Paint the World with all your Users".blue);

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

                    // Wait 500ms between requests
                    await new Promise(res => setTimeout(res, 500));
                }

            } catch (error) {
                console.log(`⛔️ Error processing account ${i + 1}.`.red);
            }
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Option 2: Claim Mining Rewards
const claimRewards = async () => {
    console.log('\n⛏ '.yellow + "Claiming Rewards for all Users".yellow);

    for (let i = 0; i < accountsWebAppData.length; i++) {
        let tgWebAppData = accountsWebAppData[i];
        if (!tgWebAppData) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(tgWebAppData);
                const firstName = userInfo.firstName.split(' ')[0];

                const claimResponse = await claimMiningRewards(tgWebAppData);
                const claimed = claimResponse.claimed;

                console.log(`\n🎉 ${firstName} has successfully claimed ${claimed} in Mining Rewards`.magenta);
            } catch (error) {
                console.log(`⛔️ Could not claim rewards for account ID ${i + 1}.`.red);
            }

            // Wait 500ms between requests
            await new Promise(res => setTimeout(res, 500));
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Option 3: Improve Account
const improveAccount = async () => {
    console.log('\nSelect a sub-option to improve the account:'.yellow);
    console.log('🎨 1. Paint Reward'.green);
    console.log('🔋 2. Recharge Speed'.green);
    console.log('🪫  3. Energy Limit'.green);
    console.log('🔙 4. Return to Main Menu'.green);

    const subChoice = askQuestion('Enter the number of the sub-option: ');

    let improvementFunction = null;

    switch (subChoice) {
        case '1':
            improvementFunction = 'Paint Reward';
            break;
        case '2':
            improvementFunction = 'Recharge Speed';
            break;
        case '3':
            improvementFunction = 'Energy Limit';
            break;
        case '4':
            return;
        default:
            console.log('Invalid option. Returning to main menu.'.red);
            return;
    }

    for (let i = 0; i < accountsWebAppData.length; i++) {
        let tgWebAppData = accountsWebAppData[i];
        if (!tgWebAppData) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(tgWebAppData);
                const firstName = userInfo.firstName.split(' ')[0];

                console.log(`\n⚙️  Improving ${improvementFunction} for ${firstName}`.blue);

                let improveResponse;
                switch (improvementFunction) {
                    case 'Paint Reward':
                        improveResponse = await improvePaintReward(tgWebAppData);
                        if (improveResponse.paintReward === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}`.green);
                        } else {
                            console.log(`⛔️ ${firstName} cannot improve this feature now. Acquire more points and try again.`.red);
                        }
                        break;
                    case 'Recharge Speed':
                        improveResponse = await improveRechargeSpeed(tgWebAppData);
                        if (improveResponse.reChargeSpeed === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}`.green);
                        } else {
                            console.log(`⛔️ ${firstName} cannot improve this feature now. Acquire more points and try again.`.red);
                        }
                        break;
                    case 'Energy Limit':
                        improveResponse = await improveEnergyLimit(tgWebAppData);
                        if (improveResponse.energyLimit === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}`.green);
                        } else {
                            console.log(`⛔️ ${firstName} cannot improve this feature now. Acquire more points and try again.`.red);
                        }
                        break;
                    default:
                        break;
                }

            } catch (error) {
                console.log(`⛔️ Error improving account ${i + 1}.`.red);
            }

            // Wait 500ms between requests
            await new Promise(res => setTimeout(res, 500));
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Main function
const main = async () => {
    displayHeader();
    await displayAccountsTable();

    // Display the menu
    console.log('\nSelect an option:'.yellow);
    console.log('🎨 1. Paint the World'.green);
    console.log('🪙  2. Claim Mining Rewards'.green);
    console.log('🔗 3. Improve Account'.green);
    console.log('✖️  4. Exit'.green);

    const choice = askQuestion('Enter the option number: ');

    switch (choice) {
        case '1':
            await paintTheWorld();
            break;
        case '2':
            await claimRewards();
            break;
        case '3':
            await improveAccount();
            break;
        case '4':
            console.log('Exiting...'.green);
            process.exit(0);
            break;
        default:
            console.log('Invalid option. Please try again.'.red);
            await pause();
            break;
    }

    await pause();
    main();
};

// Start the program
(async () => {
    await loadAllAccounts();
    await updateWebAppData();
    main();
})();
