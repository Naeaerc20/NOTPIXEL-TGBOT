// index_paintworld.js

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
    getPixelDetails,
    setDefaultTemplate
} = require('./scripts/apis');

// Directories and file paths
const sessionsFolder = path.join(__dirname, 'sessions');
const colorsPath = path.join(__dirname, 'colors.json');
const accountsPath = path.join(__dirname, 'accounts.json');
const telegramAPIsPath = path.join(__dirname, 'TelegramAPIs.json');
const templatesPath = path.join(__dirname, 'templates.json');

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

// Load templates.json
let templates = [];

try {
    const templatesData = fs.readFileSync(templatesPath, 'utf-8');
    templates = JSON.parse(templatesData);
} catch (error) {
    console.error('Error loading templates.json'.red);
    process.exit(1);
}

// Map to store accounts and their clients
const accounts = new Map();

// Global Running Flag
let isRunning = false;

// Array to track painting opportunities (charges) per account
let accountCharges = [];

// Function to ask the user (using readline-sync)
function askQuestion(question) {
    return readlineSync.question(question);
}

// Function to introduce a delay (ms)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        console.log(`Logged in using the session file for account ID: ${id}`);
        accounts.set(phone_number, client);
    } catch (error) {
        console.error(`Error logging in using the session file for account ID ${id}:`, error.message);
        await loginWithPhoneNumber(account);
    }
}

// Function to load all accounts without fetching charges
async function loadAllAccounts() {
    for (const account of telegramAPIs) {
        await loginWithSessionFile(account);
        // Introduce a small delay between account logins to prevent rapid consecutive requests
        await delay(100);
    }
}

// Function to request WebView and obtain the tgWebAppData
async function requestWebViewForClient(client, phoneNumber) {
    const botPeer = '@notpx_bot';
    const url = 'https://t.me/notpixel/app?startapp=f7274608889_s573790';

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

        // Introduce a small delay between account updates to prevent rapid consecutive requests
        await delay(100);
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

// Function to pause execution until the user presses Enter
const pause = () => {
    return new Promise((resolve) => {
        readlineSync.question('\nPress Enter to continue...');
        resolve();
    });
};

// Function to handle errors and retry actions
async function performActionWithRetry(actionFunction, dataIndex) {
    try {
        return await actionFunction();
    } catch (error) {
        console.error(`Error encountered: ${error.message}`.red);

        // Check if error has response and status
        const status = error.response ? error.response.status : null;

        if ([401, 403].includes(status)) {
            console.log(`tgWebAppData for account ID ${dataIndex + 1} expired. Renewing...`.yellow);
            await renewQueryId(dataIndex);

            // Introduce a delay after renewing to prevent immediate retry
            await delay(100);

            // Reintentar la acción después de renovar
            try {
                return await actionFunction();
            } catch (retryError) {
                console.error(`Retry failed: ${retryError.message}`.red);
                throw retryError; // O manejar según sea necesario
            }
        } else {
            console.error(`Unhandled error: ${error.message}`.red);
            throw error; // O manejar según sea necesario
        }
    }
}

// Function to renew the query_id for a specific account
async function renewQueryId(dataIndex) {
    const accountEntry = telegramAPIs[dataIndex];
    const { id, phone_number } = accountEntry;

    console.log(`Renewing query_id for account ID: ${id} (${phone_number})`.yellow);

    try {
        // Re-login with the session file
        await loginWithSessionFile(accountEntry);

        const client = accounts.get(phone_number);
        if (!client) {
            throw new Error(`Client not found after re-login for account ID: ${id}`);
        }

        // Request new tgWebAppData
        const newWebAppData = await requestWebViewForClient(client, phone_number);
        if (newWebAppData) {
            // Update the in-memory variable and accounts.json
            accountsWebAppData[dataIndex] = newWebAppData;
            fs.writeFileSync(accountsPath, JSON.stringify(accountsWebAppData, null, 2), 'utf8');
            console.log('accounts.json updated with new tgWebAppData'.green);
        } else {
            throw new Error(`Failed to obtain new tgWebAppData for account ID: ${id}`);
        }

        // Introduce a delay after renewing to prevent immediate subsequent requests
        await delay(100);
    } catch (error) {
        console.error(`Failed to renew query_id for account ID ${id}: ${error.message}`.red);
    }
}

// Function to check painting opportunities when error 400 occurs
async function checkPaintingOpportunities(dataIndex) {
    const accountEntry = telegramAPIs[dataIndex];
    const { phone_number } = accountEntry;
    const query_id = accountsWebAppData[dataIndex];

    if (!query_id) {
        console.log(`⛔️ Account ID ${dataIndex + 1} does not have a valid tgWebAppData.`.red);
        accountCharges[dataIndex] = 0;
        return;
    }

    try {
        const miningStatus = await getMiningStatus(query_id);
        if (miningStatus.charges > 0) {
            console.log(`✅ Account ID ${dataIndex + 1} has ${miningStatus.charges} painting opportunities remaining.`.green);
            accountCharges[dataIndex] = miningStatus.charges;
        } else {
            console.log(`🔴 Account ID ${dataIndex + 1} has no more painting opportunities. Skipping to next account.`.red);
            accountCharges[dataIndex] = 0;
        }
    } catch (error) {
        console.error(`⛔️ Error fetching mining status for account ID ${dataIndex + 1}: ${error.message}`.red);
        accountCharges[dataIndex] = 0;
    }
}

// Global Pixel Tracker
let currentPixelId = 0;

// Function to set default template for all accounts
async function setDefaultTemplateForAll(templateId) {
    console.log(`\n🔄 Setting default template ID ${templateId} for all accounts.`.blue);
    for (let i = 0; i < accountsWebAppData.length; i++) {
        let query_id = accountsWebAppData[i];
        if (!query_id) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have a valid tgWebAppData.`.red);
            continue;
        }

        try {
            const response = await setDefaultTemplate(query_id, templateId);
            if (response === 200 || response === 201) { // Assuming success status codes
                console.log(`✅ Default template set for account ID ${i + 1}.`.green);
            }
        } catch (error) {
            if (error.response && [402, 403].includes(error.response.status)) {
                console.log(`ℹ️ Default template already set for account ID ${i + 1}.`.cyan);
            } else {
                console.log(`⛔️ Could not set default template for account ID ${i + 1}.`.red);
            }
        }

        // Delay of 10ms between template selections
        await delay(10);

        // Introduce a small delay between processing accounts to prevent rapid consecutive requests
        await delay(100);
    }
}

// Function to start the painting process
const startToPaint = async (selectedTemplate) => {
    // Prompt to keep running the code constantly at the start
    let keepRunning = false;
    const userChoice = askQuestion('Do you wish to keep running the code constantly? (y/n): ').toLowerCase();
    if (userChoice === 'y') {
        keepRunning = true;
        isRunning = true; // Set the global flag
    }

    console.log('\n🔄 Starting the painting process with the selected template'.blue);

    // Set the selected template as default for all accounts
    await setDefaultTemplateForAll(selectedTemplate.templateId);

    // Initialize currentPixelId
    const { minPixelId, maxPixelId, minX, maxX, minY, maxY, color: targetColor } = selectedTemplate;
    if (currentPixelId === 0) {
        currentPixelId = minPixelId;
    }

    const executePainting = async () => {
        for (let i = 0; i < accountsWebAppData.length; i++) {
            let query_id = accountsWebAppData[i];
            if (!query_id) {
                console.log(`\n⛔️ Account ID ${i + 1} does not have a valid tgWebAppData.`.red);
                continue;
            }

            // Definir la acción para obtener el estado de minería
            const actionGetMiningStatus = async () => {
                const miningStatus = await getMiningStatus(query_id);
                return miningStatus;
            };

            let miningStatus;
            try {
                miningStatus = await performActionWithRetry(actionGetMiningStatus, i);
                accountCharges[i] = miningStatus.charges !== undefined ? miningStatus.charges : 0;
                console.log(`✅ Account ID ${i + 1} has ${accountCharges[i]} painting opportunities remaining.`);
            } catch (error) {
                console.error(`⛔️ Error fetching mining status for account ID ${i + 1}: ${error.message}`.red);
                accountCharges[i] = 0;
                continue;
            }

            // Skip account if no charges
            if (accountCharges[i] <= 0) {
                console.log(`🔴 Account ID ${i + 1} has no painting opportunities left. Skipping...`.red);
                continue;
            }

            console.log(`\n🎨 Processing template: ${selectedTemplate.name} (ID: ${selectedTemplate.templateId}) for account ID ${i + 1}`);

            while (currentPixelId <= maxPixelId && accountCharges[i] > 0) {
                // Convert pixel ID to X and Y coordinates
                const pixelY = Math.floor(currentPixelId / 1000); // Extract Y from the pixel ID
                const pixelX = currentPixelId % 1000; // Extract X from the pixel ID

                // Verify if the pixel is within the template boundaries
                if (pixelX < minX || pixelX > maxX || pixelY < minY || pixelY > maxY) {
                    console.log(`ℹ️ Pixel ID ${currentPixelId} (X:${pixelX}, Y:${pixelY}) is out of the template boundaries. Skipping...`.cyan);

                    // Jump to the next line (next Y coordinate)
                    currentPixelId = (pixelY + 1) * 1000 + minX; // Reset to the beginning of the next Y row
                    continue;
                }

                // Define la acción para obtener detalles del pixel
                const actionGetPixelDetails = async () => {
                    const pixelDetails = await getPixelDetails(query_id, currentPixelId);
                    const currentColor = pixelDetails.pixel.color;

                    if (currentColor.toLowerCase() !== targetColor.toLowerCase()) {
                        // Define la acción para iniciar el repintado
                        const actionStartRepaint = async () => {
                            const repaintResponse = await startRepaint(query_id, targetColor, currentPixelId);
                            if (repaintResponse.balance !== undefined) {
                                const balance = parseFloat(repaintResponse.balance).toFixed(2);
                                console.log(`✅ Pixel ID ${currentPixelId} painted with color ${targetColor}. Your Points are now: ${balance}`.green);
                                // Decrementar las oportunidades de pintura después de un repintado exitoso
                                accountCharges[i] -= 1;
                            } else {
                                console.log(`⛔️ Could not paint Pixel ID ${currentPixelId}.`.red);
                            }
                        };

                        // Manejar la acción de repintado con retry
                        await performActionWithRetry(actionStartRepaint, i);
                    } else {
                        console.log(`ℹ️ Pixel ID ${currentPixelId} already has the correct color.`.cyan);
                    }
                };

                // Manejar la acción de obtener detalles del pixel con retry
                await performActionWithRetry(actionGetPixelDetails, i);

                currentPixelId++;

                // Delay de 300ms entre verificaciones de pixel
                await delay(300);
            }

            console.log(`✅ Finished processing for account ID ${i + 1}.`.green);

            // Delay de 200ms antes de pasar a la siguiente cuenta
            await delay(200);

            // Reset currentPixelId si excede maxPixelId
            if (currentPixelId > maxPixelId) {
                console.log('🔄 Reached the maximum Pixel ID. Resetting to minPixelId.'.blue);
                currentPixelId = minPixelId;
            }

            // Introduce una pequeña demora entre procesar cada cuenta
            await delay(100);
        }

        console.log('\n🔄 Painting process completed.'.blue);
    };

    // Ejecutar el proceso de pintura
    await executePainting();

    // Si el usuario desea mantener el código corriendo constantemente, programar cada 10 minutos
    if (keepRunning) {
        console.log('🕒 The process will run every 10 minutes.'.yellow);
        setInterval(async () => {
            console.log('\n🔄 Starting scheduled painting execution.'.blue);
            await executePainting();
        }, 10 * 60 * 1000); // 10 minutos en milisegundos
    }
};

// Function to select the template
const selectTemplate = () => {
    console.log('\nSelect a template to paint:'.yellow);
    templates.forEach(template => {
        console.log(`${template.id}. ${template.name}`);
    });

    const templateIdInput = askQuestion('Enter the ID of the template to use: ');
    const templateId = parseInt(templateIdInput);

    const selectedTemplate = templates.find(t => t.id === templateId);

    if (!selectedTemplate) {
        console.log('Invalid template ID. Returning to the main menu.'.red);
        return null;
    }

    return selectedTemplate;
};

// Function to display accounts table with specified columns
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
        const account = telegramAPIs[i];

        if (!tgWebAppData) {
            table.push([
                i + 1,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red,
                'N/A'.red
            ]);
            continue;
        }

        try {
            // Obtener el estado de minería, que ahora contiene PX Farmed y Paint Chances
            const miningStatus = await performActionWithRetry(() => getMiningStatus(tgWebAppData), i);

            // Obtener el balance (PX Farmed) desde userBalance y redondearlo sin decimales
            const pxFarmed = miningStatus.userBalance !== undefined ? Math.floor(miningStatus.userBalance) : 'N/A';

            // Obtener las oportunidades de pintar (Paint Chances)
            const paintChances = miningStatus.charges !== undefined ? miningStatus.charges : 'N/A';

            // Obtener el nombre del usuario desde getUserInfo
            const userInfo = await performActionWithRetry(() => getUserInfo(tgWebAppData), i);
            const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';

            // Obtener otros datos del usuario
            const league = userInfo.league || 'N/A';
            const squad = userInfo.squad && userInfo.squad.name ? userInfo.squad.name : 'N/A';

            // Añadir los datos a la tabla
            table.push([
                i + 1,
                name,
                pxFarmed,
                paintChances,
                league,
                squad
            ]);

            // Introduce una pequeña demora entre procesar cada cuenta para evitar sobrecarga
            await delay(100);
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

// Main function
const main = async () => {
    displayHeader();
    await displayAccountsTable();

    // Display the menu
    console.log('\nSelect an option:'.yellow);
    console.log('1. Start to Paint'.green);
    console.log('2. Exit'.green);

    const choice = askQuestion('Enter the option number: ');

    switch (choice) {
        case '1':
            const selectedTemplate = selectTemplate();
            if (selectedTemplate !== null) {
                await startToPaint(selectedTemplate);
                // After startToPaint, check if isRunning is true
                if (!isRunning) {
                    // If not running continuously, return to main menu
                    await pause();
                    main();
                } else {
                    // If running continuously, do not return to main menu
                    // Inform the user that the process is running
                    console.log('\n🔄 The painting process is now running continuously every 10 minutes.'.yellow);
                }
            } else {
                // If no template selected, return to main menu
                await pause();
                main();
            }
            break;
        case '2':
            console.log('Exiting...'.green);
            process.exit(0);
            break;
        default:
            console.log('Invalid option. Please try again.'.red);
            await pause();
            main();
            break;
    }
};

// Start the program
(async () => {
    await loadAllAccounts();
    await updateWebAppData();
    main();
})();

