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
    improveEnergyLimit,
    getPublicIP,
    getGeolocation,
    getSquadRatingsBronze,
    checkLeagueBonusSilver,
    checkLeagueBonusGold,
    checkLeagueBonusPlatinum,
    checkPaint20Pixels,
    checkMakePixelAvatar, // Importar la nueva función
    completeBoinkTask,
    completeJettonTask,
    completePixelInNameTask
} = require('./scripts/apis');

// Import promise-limit for concurrency control
const promiseLimit = require('promise-limit');

// Directories and file paths
const sessionsFolder = path.join(__dirname, 'sessions');
const colorsPath = path.join(__dirname, 'colors.json');
const accountsPath = path.join(__dirname, 'accounts.json');
const telegramAPIsPath = path.join(__dirname, 'TelegramAPIs.json');
const proxiesPath = path.join(__dirname, 'proxies.txt');
const userAgentsPath = path.join(__dirname, 'user_agents.txt');

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

// Load TelegramAPIs.json
let telegramAPIs = [];

try {
    const telegramAPIsData = fs.readFileSync(telegramAPIsPath, 'utf-8');
    telegramAPIs = JSON.parse(telegramAPIsData);
} catch (error) {
    console.error('Error loading TelegramAPIs.json'.red);
    process.exit(1);
}

// Load proxies and user agents
let proxies = [];
let userAgents = [];

try {
    const proxiesData = fs.readFileSync(proxiesPath, 'utf-8');
    proxies = proxiesData.split('\n').map(line => line.trim()).filter(line => line);
} catch (error) {
    console.error('Error reading proxies.txt:', error.message.red);
    proxies = []; // Continue without proxies
}

try {
    const userAgentsData = fs.readFileSync(userAgentsPath, 'utf-8');
    userAgents = userAgentsData.split('\n').map(line => line.trim()).filter(line => line);
    if (userAgents.length === 0) {
        throw new Error('No user agents found in user_agents.txt');
    }
} catch (error) {
    console.error('Error reading user_agents.txt:', error.message.red);
    process.exit(1);
}

// Function to ask the user (using readline-sync)
function askQuestion(question) {
    return readlineSync.question(question);
}

// Ask the user if they wish to use proxies
const useProxiesInput = askQuestion('Do you wish to use Proxies in your accounts? (y/n): ').toLowerCase();
const useProxies = useProxiesInput === 'y';

// Map to store accounts and their clients
const accounts = new Map();

// Load accounts.json
let accountsData = [];

try {
    const accountsFileData = fs.readFileSync(accountsPath, 'utf-8');
    accountsData = JSON.parse(accountsFileData);
} catch (error) {
    // If it doesn't exist, initialize it as an empty array
    accountsData = [];
}

// Function to log in with a phone number
async function loginWithPhoneNumber(account) {
    const { id, api_id, api_hash, phone_number } = account;
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, Number(api_id), api_hash, { connectionRetries: 5 });

    console.log(`Logging in with phone number: ${phone_number}\n`);

    await client.start({
        phoneNumber: async () => phone_number,
        phoneCode: async () => await askQuestion(`Enter the code you received on ${phone_number}: `),
        password: async () => await askQuestion("Enter your password (if required): "),
        onError: (error) => console.error("Error:", error),
    });

    console.log('Successfully logged in\n');

    const sessionString = client.session.save();
    const sessionFile = path.join(sessionsFolder, `${id}_session`);

    fs.writeFileSync(sessionFile, sessionString, 'utf8');
    console.log(`Session saved in ${sessionFile}\n`);
    accounts.set(phone_number, client);
}

// Function to log in with session file or phone number
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
        console.log(colors.green(`Logged in using the session file for account ID: ${id}`));
        accounts.set(phone_number, client);
    } catch (error) {
        console.error(`Error logging in using the session file for account ID ${id}:`, error.message);
        await loginWithPhoneNumber(account);
    }
}

async function requestWebViewForClient(client, phoneNumber, accountId) {
    const botPeer = '@notpx_bot';
    const url = 'https://app.notpx.app/';

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
            console.error(colors.red(`⛔️ Could not extract tgWebAppData for account ID ${accountId}`));
            return null;
        }

        // tgWebAppData is URL-encoded, keep it as is
        console.log(colors.green(`✅ Extracted tgWebAppData for account ID ${accountId}: ${tgWebAppData}`));

        return tgWebAppData;
    } catch (error) {
        console.error(colors.red(`⛔️ Error requesting WebView for account ID ${accountId}: ${error.message}`));
        return null;
    }
}

// Function to update tgWebAppData
async function updateWebAppData() {
    const accountsList = []; // Initialize an empty array

    for (let i = 0; i < telegramAPIs.length; i++) {
        const accountEntry = telegramAPIs[i];
        const { id, phone_number } = accountEntry;
        const client = accounts.get(phone_number);
        if (!client) {
            console.error(`Client not found for account ${phone_number}\n`.red);
            continue;
        }

        const tgWebAppData = await requestWebViewForClient(client, phone_number, id);
        if (!tgWebAppData) {
            continue;
        }

        // Assign user agents (mandatory)
        const userAgent = userAgents[i % userAgents.length];

        // Assign proxies if useProxies is true
        let proxy = null;
        if (useProxies) {
            proxy = proxies[i % proxies.length] || null;
        }

        // Store account data
        accountsList.push({
            id: id,
            queryId: tgWebAppData,
            proxy: proxy,
            userAgent: userAgent
        });
    }

    // Save accountsList to accounts.json
    fs.writeFileSync(accountsPath, JSON.stringify(accountsList, null, 2), 'utf8');
    console.log('📄 accounts.json updated with new tgWebAppData\n');

    // Update accountsData in memory
    accountsData = accountsList;
}

// Function to load all accounts
async function loadAllAccounts() {
    for (const account of telegramAPIs) {
        await loginWithSessionFile(account);
    }
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
    console.log('');
};

// Function to select a random color
const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * colorsList.length);
    return colorsList[randomIndex][0]; // Returns the color code
};

// Function to generate a random pixelId between 1 y 1,000,000
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
            'Squad'.red,
            'IP'.red,
            'Country'.red
        ]
    });

    // Define the concurrency limit
    const limit = promiseLimit(5); // Adjust as needed

    const results = new Array(accountsData.length);

    const processAccount = async (i) => {
        const accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;

        if (!queryId) {
            results[i] = [
                id || 'N/A'.red,
                'No tgWebAppData'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red
            ];
            return;
        }

        try {
            const userInfo = await getUserInfo(queryId, proxy, userAgent);
            const miningStatus = await getMiningStatus(queryId, proxy, userAgent);

            const name = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';
            const balance = userInfo.balance !== undefined ? userInfo.balance : 'N/A';
            const charges = miningStatus.charges !== undefined ? miningStatus.charges : 'N/A';
            const league = userInfo.league || 'N/A';
            const squadName = userInfo.squad && userInfo.squad.name ? userInfo.squad.name : 'N/A';

            // Get IP and country
            const ip = await getPublicIP(proxy, userAgent);
            const country = await getGeolocation(ip);

            results[i] = [
                id,
                name,
                balance,
                charges,
                league,
                squadName,
                ip || 'N/A',
                country || 'N/A'
            ];

        } catch (error) {
            results[i] = [
                id || 'N/A'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red,
                'Error'.red
            ];
        }
    };

    // Process accounts concurrently
    const accountPromises = accountsData.map((_, i) => limit(() => processAccount(i)));
    await Promise.all(accountPromises);

    // Add results to table
    results.forEach(row => {
        table.push(row);
    });

    console.log(table.toString());
};

// Function to pause execution until the user presses Enter
const pause = () => {
    return new Promise((resolve) => {
        readlineSync.question('\nPress Enter to return to the main menu...');
        resolve();
    });
};

// Function to handle errores y reintentos de acciones
async function performActionWithRetry(actionFunction, dataIndex) {
    try {
        await actionFunction();
    } catch (error) {
        if (error.response && [401, 403].includes(error.response.status)) {
            console.log(`\ntgWebAppData for account ID ${dataIndex + 1} expired. Updating...\n`.yellow);
            const accountEntry = telegramAPIs[dataIndex];
            await loginWithSessionFile(accountEntry);
            const client = accounts.get(accountEntry.phone_number);
            const newWebAppData = await requestWebViewForClient(client, accountEntry.phone_number, accountEntry.id);
            if (newWebAppData) {
                // Update the in-memory variable and accounts.json
                accountsData[dataIndex].queryId = newWebAppData;
                fs.writeFileSync(accountsPath, JSON.stringify(accountsData, null, 2), 'utf8');
                console.log('📄 accounts.json updated with new tgWebAppData\n'.green);
                // Retry the action
                await actionFunction();
            } else {
                console.error(`Could not update tgWebAppData for account ID ${accountEntry.id}\n`.red);
            }
        } else {
            throw error;
        }
    }
}

// Option 1: Paint the World
const paintTheWorld = async () => {
    console.log('\n🔄 '.blue + "Let's Paint the World with all your Users".blue + '\n');

    for (let i = 0; i < accountsData.length; i++) {
        let accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;
        if (!queryId) {
            console.log(`\n⛔️ Account ID ${id} does not have valid tgWebAppData.`.red);
            console.log('');
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(queryId, proxy, userAgent);
                const miningStatus = await getMiningStatus(queryId, proxy, userAgent);

                const firstName = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';
                const charges = miningStatus.charges;

                if (charges === 0) {
                    console.log(`\n🔴 ${firstName} cannot paint now. Wait 10 minutes for the next painting.`.red);
                    return;
                }

                console.log(`\n🎨 Painting with ${firstName} - Please wait while creating art...`.yellow);

                for (let j = 0; j < charges; j++) {
                    const newColor = getRandomColor();
                    const pixelId = getRandomPixelId();

                    try {
                        const repaintResponse = await startRepaint(queryId, proxy, userAgent, newColor, pixelId);
                        if (repaintResponse.balance !== undefined) {
                            const balance = parseFloat(repaintResponse.balance).toFixed(2);
                            console.log(`✅ ${firstName} - Painted pixel ${pixelId} with color ${newColor} - Your points are now ${balance}.`.green);
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
                console.log(`⛔️ Error processing account ID ${id}.`.red);
            }
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Option 2: Claim Mining Rewards
const claimRewards = async () => {
    console.log('\n⛏ '.yellow + "Claiming Rewards for all Users".yellow + '\n');

    for (let i = 0; i < accountsData.length; i++) {
        let accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;
        if (!queryId) {
            console.log(`\n⛔️ Account ID ${id} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(queryId, proxy, userAgent);
                const firstName = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';

                const claimResponse = await claimMiningRewards(queryId, proxy, userAgent);
                const claimed = claimResponse.claimed;

                console.log(`🎉 ${firstName} has successfully claimed ${claimed} in Mining Rewards.\n`.magenta);
            } catch (error) {
                console.log(`⛔️ Could not claim rewards for account ID ${id}.\n`.red);
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

    for (let i = 0; i < accountsData.length; i++) {
        let accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;
        if (!queryId) {
            console.log(`\n⛔️ Account ID ${id} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(queryId, proxy, userAgent);
                const firstName = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';

                console.log(`\n⚙️  Improving ${improvementFunction} for ${firstName}.\n`.blue);

                let improveResponse;
                switch (improvementFunction) {
                    case 'Paint Reward':
                        improveResponse = await improvePaintReward(queryId, proxy, userAgent);
                        if (improveResponse.paintReward === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}.`.green);
                        } else {
                            console.log(`🔵 ${firstName} has already maximized ${improvementFunction} and cannot improve it further.`.blue);
                        }
                        break;
                    case 'Recharge Speed':
                        improveResponse = await improveRechargeSpeed(queryId, proxy, userAgent);
                        if (improveResponse.reChargeSpeed === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}.`.green);
                        } else {
                            console.log(`🔵 ${firstName} has already maximized ${improvementFunction} and cannot improve it further.`.blue);
                        }
                        break;
                    case 'Energy Limit':
                        improveResponse = await improveEnergyLimit(queryId, proxy, userAgent);
                        if (improveResponse.energyLimit === true) {
                            console.log(`✅ ${firstName} has successfully improved ${improvementFunction}.`.green);
                        } else {
                            console.log(`🔵 ${firstName} has already maximized ${improvementFunction} and cannot improve it further.`.blue);
                        }
                        break;
                    default:
                        break;
                }

            } catch (error) {
                console.log(`⛔️ Error improving account ID ${id}.`.red);
            }
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Option 4: Claim Rewards for Leagues
const claimLeagueRewards = async () => {
    console.log('\n🏆 '.yellow + "Claiming League Rewards for all Users".yellow + '\n');

    for (let i = 0; i < accountsData.length; i++) {
        let accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;
        if (!queryId) {
            console.log(`\n⛔️ Account ID ${id} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(queryId, proxy, userAgent);
                const firstName = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';
                const league = userInfo.league.toLowerCase();

                let rewardsClaimed = false;

                // Function to claim reward for a specific league
                const claimLeague = async (leagueName, claimFunction) => {
                    try {
                        const response = await claimFunction(queryId, proxy, userAgent);
                        if (response[Object.keys(response)[0]] === true) {
                            const updatedUserInfo = await getUserInfo(queryId, proxy, userAgent);
                            const newPoints = updatedUserInfo.balance;
                            console.log(`✅ ${firstName} has claimed points for reaching the ${leagueName} league - Your points are now: ${newPoints}`.green);
                            rewardsClaimed = true;
                        }
                    } catch (error) {
                        if (error.response && error.response.status === 400) {
                            console.log(`❌ ${firstName} has already claimed rewards for the ${leagueName} league or needs to do it manually.`.red);
                        } else {
                            console.log(`❌ ${firstName} had a problem while claiming rewards for the ${leagueName} league. Please try again later.`.red);
                        }
                    }
                };

                // Claim rewards based on the user's league
                if (['bronze', 'silver', 'gold', 'platinum'].includes(league)) {
                    await claimLeague('Bronze', getSquadRatingsBronze);
                }

                if (['silver', 'gold', 'platinum'].includes(league)) {
                    await claimLeague('Silver', checkLeagueBonusSilver);
                }

                if (['gold', 'platinum'].includes(league)) {
                    await claimLeague('Gold', checkLeagueBonusGold);
                }

                if (league === 'platinum') {
                    await claimLeague('Platinum', checkLeagueBonusPlatinum);
                }

                // Claim points for painting 20 pixels
                try {
                    const paintResponse = await checkPaint20Pixels(queryId, proxy, userAgent);
                    if (paintResponse.paint20pixels === true) {
                        const updatedUserInfo = await getUserInfo(queryId, proxy, userAgent);
                        const newPoints = updatedUserInfo.balance;
                        console.log(`✅ ${firstName} has claimed points for painting the world 20 times - Your points are now: ${newPoints}`.green);
                        rewardsClaimed = true;
                    }
                } catch (error) {
                    if (error.response && error.response.status === 400) {
                        console.log(`❌ ${firstName} has already claimed points for painting the world 20 times or needs to do it manually.`.red);
                    } else {
                        console.log(`❌ ${firstName} had a problem while claiming points for painting the world 20 times. Please try again later.`.red);
                    }
                }

                // Claim points for "Make Pixel Avatar" task
                try {
                    const avatarResponse = await checkMakePixelAvatar(queryId, proxy, userAgent);
                    if (avatarResponse.makePixelAvatar === true) {
                        const updatedUserInfo = await getUserInfo(queryId, proxy, userAgent);
                        const newPoints = updatedUserInfo.balance;
                        console.log(`✅ ${firstName} has successfully completed the "Make Pixel Avatar" task - Your points are now: ${newPoints}`.green);
                        rewardsClaimed = true;
                    }
                } catch (error) {
                    if (error.response && error.response.status === 400) {
                        console.log(`❌ ${firstName} has already claimed points for the "Make Pixel Avatar" task or needs to do it manually.`.red);
                    } else {
                        console.log(`❌ ${firstName} had a problem while claiming points for the "Make Pixel Avatar" task. Please try again later.`.red);
                    }
                }

                if (!rewardsClaimed) {
                    console.log(`ℹ️ ${firstName} has no pending league rewards to claim.`.cyan);
                }

            } catch (error) {
                console.log(`❌ Error processing account ID ${id}.`.red);
            }

            // Wait 500ms between requests
            await new Promise(res => setTimeout(res, 500));
        };

        await performActionWithRetry(actionFunction, i);
    }
};

// Option 5: Auto Complete Tasks
const autoCompleteTasks = async () => {
    console.log('\n⚙️  Auto Completing Tasks for all Users'.yellow + '\n');

    for (let i = 0; i < accountsData.length; i++) {
        let accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;
        if (!queryId) {
            console.log(`\n⛔️ Account ID ${id} does not have valid tgWebAppData.`.red);
            continue;
        }

        const actionFunction = async () => {
            try {
                const userInfo = await getUserInfo(queryId, proxy, userAgent);
                const firstName = userInfo.firstName ? userInfo.firstName.split(' ')[0] : 'N/A';

                // Complete Boink Task
                try {
                    const boinkResponse = await completeBoinkTask(queryId, proxy, userAgent);
                    if (boinkResponse.boinkTask === true) {
                        console.log(`✅ ${firstName} has completed Boink Task.\n`.green);
                    } else {
                        console.log(`🟠 Boink Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    }
                } catch (error) {
                    if (error.response && error.response.status === 400) {
                        console.log(`🟠 Boink Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    } else {
                        console.log(`⛔️ Error completing Boink Task for ${firstName}.\n`.red);
                    }
                }

                // Wait 2 seconds between tasks
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Complete Jetton Task
                try {
                    const jettonResponse = await completeJettonTask(queryId, proxy, userAgent);
                    if (jettonResponse.jettonTask === true) {
                        console.log(`✅ ${firstName} has completed Jetton Task.\n`.green);
                    } else {
                        console.log(`🟠 Jetton Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    }
                } catch (error) {
                    if (error.response && error.response.status === 400) {
                        console.log(`🟠 Jetton Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    } else {
                        console.log(`⛔️ Error completing Jetton Task for ${firstName}.\n`.red);
                    }
                }

                // Wait 2 seconds between tasks
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Complete Pixel in Nickname Task
                try {
                    const pixelInNameResponse = await completePixelInNameTask(queryId, proxy, userAgent);
                    if (pixelInNameResponse.pixelInNickname === true) {
                        console.log(`✅ ${firstName} has completed Pixel in Nickname Task.\n`.green);
                    } else {
                        console.log(`🟠 Pixel in Nickname Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    }
                } catch (error) {
                    if (error.response && error.response.status === 400) {
                        console.log(`🟠 Pixel in Nickname Task is already completed for ${firstName} or needs to be completed manually.\n`.red);
                    } else {
                        console.log(`⛔️ Error completing Pixel in Nickname Task for ${firstName}.\n`.red);
                    }
                }

            } catch (error) {
                console.log(`⛔️ Error completing tasks for account ID ${id}.\n`.red);
                throw error;
            }
        };

        await performActionWithRetry(actionFunction, i);

        // Wait 1 second before moving to the next account
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log('🏆 4. Claim Rewards for Leagues'.green);
    console.log('⚙️  5. Auto Complete Tasks'.green);
    console.log('✖️  6. Exit'.green);

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
            await claimLeagueRewards();
            break;
        case '5':
            await autoCompleteTasks();
            break;
        case '6':
            console.log('Exiting...'.green);
            process.exit(0);
            break;
        default:
            console.log('Invalid option. Please try again.'.red);
            console.log('');
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
