// IndexV4.js

// Imports and Initial Configurations
const clear = require('console-clear');
const figlet = require('figlet');
const Table = require('cli-table3');
const colors = require('colors');
const axios = require('axios');
const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

// Import Telegram functions
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

// Import functions from apis.js
const {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    setDefaultTemplate,
    checkPixelColor,
    getPublicIP,
    getGeolocation,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit,
    getPixelDetails // Importamos la nueva función
} = require('./scripts/apis');

// Import promise-limit for concurrency control
const promiseLimit = require('promise-limit');

// Directories and file paths
const sessionsFolder = path.join(__dirname, 'sessions');
const colorsPath = path.join(__dirname, 'colors.json');
const accountsPath = path.join(__dirname, 'accounts.json');
const telegramAPIsPath = path.join(__dirname, 'TelegramAPIs.json');
const templatesPath = path.join(__dirname, 'templates.json');
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
    const colorsArray = JSON.parse(colorsData);
    // Extract only the hex color codes
    colorsList = colorsArray.map(item => item[0]); // Assuming each item is ["#E46E6E", "coral"]
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

// Load templates.json
let templates = [];

try {
    const templatesData = fs.readFileSync(templatesPath, 'utf-8');
    templates = JSON.parse(templatesData);
} catch (error) {
    console.error('Error loading templates.json'.red);
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

// Ask the user if they wish to process multiple accounts at the same time
const processConcurrentlyInput = askQuestion('Do you wish to process multiple accounts at the same time? (y/n): ').toLowerCase();
const processConcurrently = processConcurrentlyInput === 'y';

// Ask the user if they wish to use proxies
const useProxiesInput = askQuestion('Do you wish to use Proxies in your accounts? (y/n): ').toLowerCase();
const useProxies = useProxiesInput === 'y';

// Map to store accounts and their clients
const accounts = new Map();

// Global Running Flag
let isRunning = false;

// Array to track painting opportunities (charges) per account
let accountCharges = [];

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
        console.log(colors.green(`Logged in using the session file for account ID: ${id}`));
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
        await delay(50); // Añadimos una demora de 50ms
    }
}

// Function to request WebView and obtain the tgWebAppData
async function requestWebViewForClient(client, phoneNumber, accountId) {
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

        // Extraer el fragmento de la URL
        const urlFragment = result.url.split('#')[1];

        // Analizar el fragmento como parámetros de URL
        const params = new URLSearchParams(urlFragment);

        // Obtener tgWebAppData sin decodificarlo
        const tgWebAppData = params.get('tgWebAppData');

        if (!tgWebAppData) {
            console.error(colors.red(`⛔️ Could not extract tgWebAppData for account ID ${accountId}`));
            return null;
        }

        // tgWebAppData está codificado en URL, mantenerlo así
        console.log(colors.green(`✅ Extracted tgWebAppData for account ID ${accountId}: ${tgWebAppData}`));

        return tgWebAppData;
    } catch (error) {
        console.error(colors.red(`⛔️ Error requesting WebView for account ID ${accountId}: ${error.message}`));
        return null;
    }
}

// Function to Update tgWebAppData creating an account array
async function updateWebAppData() {
    const accountsList = [];

    for (let i = 0; i < telegramAPIs.length; i++) {
        const accountEntry = telegramAPIs[i];
        const { id, phone_number } = accountEntry;
        const client = accounts.get(phone_number);
        if (!client) {
            console.error(`Client not found for account ${phone_number}`);
            continue;
        }

        const tgWebAppData = await requestWebViewForClient(client, phone_number, id);
        if (!tgWebAppData) {
            continue;
        }

        // Asignar user agents (obligatorio)
        const userAgent = userAgents[i % userAgents.length];

        // Asignar proxies si useProxies es verdadero
        let proxy = null;
        if (useProxies) {
            proxy = proxies[i % proxies.length] || null;
        }

        // Almacenar los datos de la cuenta
        accountsList.push({
            id: id,
            queryId: tgWebAppData,
            proxy: proxy,
            userAgent: userAgent
        });

        // Introducir una pequeña demora entre actualizaciones de cuenta para prevenir solicitudes consecutivas rápidas
        await delay(50); // Añadimos una demora de 50ms
    }

    // Guardar accountsList en accounts.json
    fs.writeFileSync(accountsPath, JSON.stringify(accountsList, null, 2), 'utf8');
    console.log('accounts.json updated with new tgWebAppData');
}

// Load accounts.json
let accountsData = [];

try {
    const accountsFileData = fs.readFileSync(accountsPath, 'utf-8');
    accountsData = JSON.parse(accountsFileData);
} catch (error) {
    // If it doesn't exist, initialize it as an empty array
    accountsData = [];
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
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        try {
            return await actionFunction();
        } catch (error) {
            attempts++;
            const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
            if (isTimeout) {
                // Timeout occurred, retry without additional prints
                await delay(1000); // Wait 1 second before retrying
                continue;
            } else if (error.response && [401, 403].includes(error.response.status)) {
                console.log(`tgWebAppData for account ID ${dataIndex + 1} expired. Renewing...`.yellow);
                await renewQueryId(dataIndex);

                // Introduce a delay after renewing to prevent immediate retry
                await delay(100);

                // Retry the action after renewing
                continue;
            } else {
                // Unhandled error, throw
                throw error;
            }
        }
    }
    throw new Error(`Failed after ${maxAttempts} attempts`);
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
        const newWebAppData = await requestWebViewForClient(client, phone_number, id);
        if (newWebAppData) {
            // Update the in-memory variable and accounts.json
            accountsData[dataIndex].queryId = newWebAppData;
            fs.writeFileSync(accountsPath, JSON.stringify(accountsData, null, 2), 'utf8');
            console.log('accounts.json updated with new tgWebAppData'.green);
        } else {
            throw new Error(`Failed to obtain new tgWebAppData for account ID: ${id}`);
        }

        // Introduce a delay after renewing to prevent immediate subsequent requests
        await delay(50); // Añadimos una demora de 50ms
    } catch (error) {
        console.error(`Failed to renew query_id for account ID ${id}: ${error.message}`.red);
    }
}

// Function to load template image and create a color matrix
async function loadTemplateImage(template) {
    const { templateId } = template;
    const imageUrl = `https://static.notpx.app/templates/${templateId}.png`;
    console.log(`Downloading template image from ${imageUrl}`);

    try {
        const image = await Jimp.read(imageUrl);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        console.log(`Template image loaded with dimensions: ${width}x${height}`);

        // Create a matrix to store color data
        const colorMatrix = [];

        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const pixelColorHex = image.getPixelColor(x, y);
                const rgba = Jimp.intToRGBA(pixelColorHex);
                const alpha = rgba.a;
                // Skip transparent pixels
                if (alpha === 0) {
                    row.push(null);
                } else {
                    const colorHexString = `#${((rgba.r << 16) + (rgba.g << 8) + rgba.b).toString(16).padStart(6, '0').toUpperCase()}`;
                    row.push(colorHexString);
                }
            }
            colorMatrix.push(row);
        }

        return colorMatrix;
    } catch (error) {
        console.error(`Error loading template image: ${error.message}`.red);
        throw error;
    }
}

// Function to find the closest color from the game's color palette
function findClosestColor(targetColor) {
    const targetRGB = hexToRgb(targetColor);

    let minDistance = Infinity;
    let closestColor = null;

    for (const colorHex of colorsList) {
        const colorRGB = hexToRgb(colorHex);
        const distance = colorDistance(targetRGB, colorRGB);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = colorHex;
        }
    }

    return closestColor;
}

// Function to convert hex color to RGB object
function hexToRgb(hex) {
    if (typeof hex !== 'string') {
        console.error(`Invalid hex value: ${hex}`);
        return { r: 0, g: 0, b: 0 }; // Or handle the error appropriately
    }
    // Remove "#" if present
    hex = hex.replace('#', '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return { r, g, b };
}

// Function to calculate color distance
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

// Function to select a template
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

    // Define el límite de concurrencia
    const limit = promiseLimit(5); // Puedes ajustar este valor

    // Arreglo para almacenar los resultados en el orden correcto
    const results = new Array(accountsData.length);

    // Función para procesar cada cuenta
    const processAccount = async (i) => {
        const accountData = accountsData[i];
        const { id, queryId, proxy, userAgent } = accountData;

        if (!queryId) {
            results[i] = [
                id || 'N/A'.red,
                'N/A'.red,
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
            // Obtener estado de minería
            const miningStatus = await performActionWithRetry(() => getMiningStatus(queryId, proxy, userAgent), i);

            // Obtener PX Minados
            const pxFarmed = miningStatus.userBalance !== undefined ? Math.floor(miningStatus.userBalance) : 'N/A';

            // Obtener Oportunidades de Pintura
            const paintChances = miningStatus.charges !== undefined ? miningStatus.charges : 'N/A';

            // Obtener información del usuario
            const userInfo = await performActionWithRetry(() => getUserInfo(queryId, proxy, userAgent), i);
            const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';

            // Obtener otros datos del usuario
            const league = userInfo.league || 'N/A';
            const squad = userInfo.squad && userInfo.squad.name ? userInfo.squad.name : 'N/A';

            // Obtener IP y país
            const ip = await getPublicIP(proxy, userAgent);
            const country = await getGeolocation(ip);

            // Añadir datos al resultado
            results[i] = [
                id,
                name,
                pxFarmed,
                paintChances,
                league,
                squad,
                ip || 'N/A',
                country || 'N/A'
            ];

            // Introducir un pequeño retraso entre el procesamiento de cada cuenta para evitar sobrecarga
            await delay(100);
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

    if (processConcurrently) {
        // Procesar cuentas concurrentemente
        const accountPromises = accountsData.map((_, i) => limit(() => processAccount(i)));
        await Promise.all(accountPromises);
    } else {
        // Procesar cuentas secuencialmente
        for (let i = 0; i < accountsData.length; i++) {
            await processAccount(i);
        }
    }

    // Agregar resultados a la tabla
    results.forEach(row => {
        table.push(row);
    });

    console.log(table.toString());
};

// Function to set default template for assigned templates to each account
async function setDefaultTemplateForAccounts(templateAssignments, paintConcurrently) {
    console.log(`\n🔄 Setting default templates for all accounts.`.blue);

    // Definir la función para procesar cada cuenta
    const processAccount = async (i) => {
        let query_id = accountsData[i].queryId;
        const assignedTemplate = templateAssignments[i];
        const account = accountsData[i];
        const proxy = account.proxy;
        const userAgent = account.userAgent;

        if (!query_id) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have a valid tgWebAppData.`.red);
            return;
        }

        try {
            // Obtener información del usuario para obtener el nombre
            const userInfo = await performActionWithRetry(() => getUserInfo(query_id, proxy, userAgent), i);
            const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';

            // Intentar establecer la plantilla predeterminada
            const response = await setDefaultTemplate(query_id, proxy, userAgent, assignedTemplate.templateId);
            if (response === 200 || response === 201) { // Asumiendo códigos de éxito
                console.log(`✅ ${assignedTemplate.name} Template Successfully set for ${name}`.green);
            }
        } catch (error) {
            if (error.response && [402, 403].includes(error.response.status)) {
                // Obtener información del usuario para obtener el nombre
                try {
                    const userInfo = await getUserInfo(query_id, proxy, userAgent);
                    const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';
                    console.log(`ℹ️ ${assignedTemplate.name} Template already set for ${name}.`.cyan);
                } catch (userError) {
                    console.log(`ℹ️ ${assignedTemplate.name} Template already set for account ID ${i + 1}.`.cyan);
                }
            } else {
                console.log(`⛔️ Could not set default template for account ID ${i + 1}.`.red);
            }
        }

        // Delay de 10ms entre selecciones de plantilla
        await delay(10);

        // Introducir una pequeña demora entre el procesamiento de cuentas para prevenir solicitudes consecutivas rápidas
        await delay(50);
    };

    if (paintConcurrently) {
        // Usar promise-limit para limitar la concurrencia
        const limit = promiseLimit(5); // Ajusta el límite de concurrencia según tus necesidades
        await Promise.all(accountsData.map((_, i) => limit(() => processAccount(i))));
    } else {
        // Procesar secuencialmente sin concurrencia
        for (let i = 0; i < accountsData.length; i++) {
            await processAccount(i);
        }
    }
}

// Function to get the list of pixels to paint for a template
const getPixelsToPaint = (template) => {
    const { minX, minY, maxX, maxY } = template;
    const pixelsToPaint = [];

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const pixelId = y * 1000 + x;
            pixelsToPaint.push({
                x: x,
                y: y,
                pixelId: pixelId
            });
        }
    }
    return pixelsToPaint;
};

// Function to start the painting process
const startToPaint = async () => {
    // Ask the user if they wish to use random templates
    const useRandomTemplatesInput = askQuestion('Do you wish to use Random Templates for each user? (y/n): ').toLowerCase();
    const useRandomTemplates = useRandomTemplatesInput === 'y';

    let templateAssignments = []; // Array to store the assigned template for each account

    if (useRandomTemplates) {
        // Assign a random template to each account
        for (let i = 0; i < accountsData.length; i++) {
            const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
            templateAssignments.push(randomTemplate);
        }
    } else {
        // Display list of templates and allow the user to select one
        const selectedTemplate = selectTemplate();
        if (selectedTemplate === null) {
            console.log('No template selected. Exiting...'.red);
            return;
        }
        // Assign the same template to all accounts
        for (let i = 0; i < accountsData.length; i++) {
            templateAssignments.push(selectedTemplate);
        }
    }

    // Ask the user if they wish to keep the code running constantly
    let keepRunning = false;
    const userChoice = askQuestion('Do you wish to keep running the code constantly? (y/n): ').toLowerCase();
    if (userChoice === 'y') {
        keepRunning = true;
        isRunning = true; // Set the global flag
    }

    // Ask the user if they wish to double verify pixel colors
    const doubleVerifyInput = askQuestion('Do you wish to Double verify Pixel Colors? (y/n): ').toLowerCase();
    const doubleVerify = doubleVerifyInput === 'y';

    // Ask the user if they wish to paint with various users at same time
    const paintConcurrentlyInput = askQuestion('Do you wish to paint with various users at same time? (y/n): ').toLowerCase();
    const paintConcurrently = paintConcurrentlyInput === 'y';

    // Set the assigned templates as default for each account
    await setDefaultTemplateForAccounts(templateAssignments, paintConcurrently);

    console.log('\n🔄 Starting the painting process with the selected template(s)'.blue);

    // Function to process the painting for each account
    const executePainting = async () => {
        // Store accounts that have painting opportunities
        const accountsWithCharges = [];

        // First, check and collect accounts with painting opportunities
        for (let i = 0; i < accountsData.length; i++) {
            let query_id = accountsData[i].queryId;
            const proxy = accountsData[i].proxy;
            const userAgent = accountsData[i].userAgent;

            if (!query_id) {
                continue;
            }

            // Get mining status and painting opportunities
            let miningStatus;
            try {
                miningStatus = await performActionWithRetry(() => getMiningStatus(query_id, proxy, userAgent), i);
                accountCharges[i] = miningStatus.charges !== undefined ? miningStatus.charges : 0;

                if (accountCharges[i] > 0) {
                    accountsWithCharges.push({
                        index: i,
                        query_id: query_id,
                        charges: accountCharges[i],
                        template: templateAssignments[i],
                        proxy: proxy,
                        userAgent: userAgent
                    });
                }
            } catch (error) {
                accountCharges[i] = 0;
                console.log(`⛔️ Error getting mining status for account ID ${i + 1}: ${error.message}`.red);
                continue;
            }

            // Introduce a small delay between requests
            await delay(300);
        }

        // If no accounts have charges, display a message and exit
        if (accountsWithCharges.length === 0) {
            console.log('🔴 No accounts have painting opportunities left. Exiting painting process.'.red);
            return;
        }

        // Define the function to process each account
        const processAccount = async (accountData) => {
            const { index: i, query_id, template, proxy, userAgent } = accountData;
            const templateId = template.templateId;

            // Get the pixels to paint for this template
            const pixelsToPaint = getPixelsToPaint(template);

            // Shuffle pixelsToPaint to randomize pixel selection
            const shuffledPixels = pixelsToPaint.sort(() => Math.random() - 0.5);

            // Initialize an index to keep track of processed pixels
            let currentPixelIndex = 0;

            console.log(`\n🎨 Processing template: ${template.name} (ID: ${templateId}) for account ID ${i + 1}`);

            while (accountCharges[i] > 0 && currentPixelIndex < shuffledPixels.length) {
                const pixelData = shuffledPixels[currentPixelIndex];
                const { x: gameX, y: gameY, pixelId } = pixelData;

                console.log(`Using pixel ID: ${pixelId}`);

                try {
                    // Get the color to paint using checkPixelColor
                    const colorToPaint = await checkPixelColor(templateId, pixelId, proxy, userAgent);

                    if (!colorToPaint) {
                        console.log(`⛔️ No color returned from checkPixelColor for Pixel ID ${pixelId}. Skipping.`.red);
                        currentPixelIndex += 1;
                        await delay(300);
                        continue;
                    }

                    // If doubleVerify is true, verify the current color of the pixel
                    if (doubleVerify) {
                        // Introduce a delay of 100ms between checkPixelColor and getPixelDetails
                        await delay(100);

                        try {
                            // Get the current color of the pixel using getPixelDetails
                            const pixelDetails = await getPixelDetails(query_id, pixelId, proxy, userAgent);
                            const currentColor = pixelDetails.pixel.color;

                            if (currentColor && currentColor.toUpperCase() === colorToPaint.toUpperCase()) {
                                console.log(`ℹ️ Pixel (${gameX}, ${gameY}) already has the correct color.`.cyan);
                                currentPixelIndex += 1;
                                await delay(300);
                                continue;
                            }
                        } catch (error) {
                            console.log(`⛔️ Error getting pixel details for Pixel ID ${pixelId}: ${error.message}`.red);
                            currentPixelIndex += 1;
                            await delay(300);
                            continue;
                        }
                    }

                    // Proceed to paint the pixel using startRepaint
                    const repaintResponse = await startRepaint(query_id, proxy, userAgent, colorToPaint, pixelId);
                    if (repaintResponse.balance !== undefined) {
                        const balance = parseFloat(repaintResponse.balance).toFixed(2);
                        console.log(`✅ Pixel (${gameX}, ${gameY}) painted with color ${colorToPaint}. Your Points are now: ${balance}`.green);
                        accountCharges[i] -= 1; // Decrement painting opportunities
                    } else {
                        console.log(`⛔️ Could not repaint Pixel (${gameX}, ${gameY}).`.red);
                    }
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        console.log(`⛔️ Error 404: Pixel ID ${pixelId} not found. Skipping.`.red);
                    } else {
                        console.log(`⛔️ Error processing Pixel ID ${pixelId}: ${error.message}`.red);
                    }
                }

                currentPixelIndex += 1;

                // Introduce a small delay between each request
                await delay(300);
            }

            console.log(`✅ Finished processing for account ID ${i + 1}. Remaining opportunities: ${accountCharges[i]}`.green);
        };

        if (paintConcurrently) {
            // Use promise-limit to limit concurrency
            const limit = promiseLimit(5); // Adjust concurrency limit as needed
            await Promise.all(accountsWithCharges.map(accountData => limit(() => processAccount(accountData))));
        } else {
            // Process sequentially without concurrency
            for (const accountData of accountsWithCharges) {
                await processAccount(accountData);
            }
        }

        console.log('\n🔄 Painting process completed.'.blue);
    };

    // Execute the painting process
    await executePainting();

    // If the user wants to keep the code running constantly, schedule every 10 minutes
    if (keepRunning) {
        console.log('🕒 The process will run every 10 minutes.'.yellow);
        setInterval(async () => {
            console.log('\n🔄 Starting scheduled painting execution.'.blue);
            await executePainting();
        }, 10 * 60 * 1000); // 10 minutes in milliseconds
    }
};

// Function to display the main menu and handle user input
async function main() {
    displayHeader();
    await displayAccountsTable();

    // Display the menu
    console.log('\nSelect an option:'.yellow);
    console.log('1. Start to Paint'.green);
    console.log('2. Exit'.green);

    const choice = askQuestion('Enter the option number: ');

    switch (choice) {
        case '1':
            await startToPaint();
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
}

// Start the program
(async () => {
    try {
        await loadAllAccounts();
        await updateWebAppData();
        // Reload accountsData after updating accounts.json
        const accountsFileData = fs.readFileSync(accountsPath, 'utf-8');
        accountsData = JSON.parse(accountsFileData);
        await main();
    } catch (error) {
        console.error('An error occurred during initialization:', error.message.red);
        process.exit(1);
    }
})();
