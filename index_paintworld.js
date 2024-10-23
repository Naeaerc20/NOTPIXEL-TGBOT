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
const Jimp = require('jimp');

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
    const colorsArray = JSON.parse(colorsData);
    // Extract only the hex color codes
    colorsList = colorsArray.map(item => item[0]); // Assuming each item is ["#E46E6E", "coral"]
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
        await delay(50); // Añadimos una demora de 50ms
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
        await delay(50); // Añadimos una demora de 50ms
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

            // Retry the action after renewing
            try {
                return await actionFunction();
            } catch (retryError) {
                console.error(`Retry failed: ${retryError.message}`.red);
                throw retryError;
            }
        } else {
            console.error(`Unhandled error: ${error.message}`.red);
            throw error;
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
            // Obtener estado de minería
            const miningStatus = await performActionWithRetry(() => getMiningStatus(tgWebAppData), i);

            // Obtener PX Minados
            const pxFarmed = miningStatus.userBalance !== undefined ? Math.floor(miningStatus.userBalance) : 'N/A';

            // Obtener Oportunidades de Pintura
            const paintChances = miningStatus.charges !== undefined ? miningStatus.charges : 'N/A';

            // Obtener información del usuario
            const userInfo = await performActionWithRetry(() => getUserInfo(tgWebAppData), i);
            const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';

            // Obtener otros datos del usuario
            const league = userInfo.league || 'N/A';
            const squad = userInfo.squad && userInfo.squad.name ? userInfo.squad.name : 'N/A';

            // Añadir datos a la tabla
            table.push([
                i + 1,
                name,
                pxFarmed,
                paintChances,
                league,
                squad
            ]);

            // Introducir un pequeño retraso entre el procesamiento de cada cuenta para evitar sobrecarga
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

// Function to set default template for assigned templates to each account
async function setDefaultTemplateForAccounts(templateAssignments) {
    console.log(`\n🔄 Setting default templates for all accounts.`.blue);
    for (let i = 0; i < accountsWebAppData.length; i++) {
        let query_id = accountsWebAppData[i];
        const assignedTemplate = templateAssignments[i];
        const account = telegramAPIs[i];

        if (!query_id) {
            console.log(`\n⛔️ Account ID ${i + 1} does not have a valid tgWebAppData.`.red);
            continue;
        }

        try {
            // Obtener información del usuario para obtener el nombre
            const userInfo = await performActionWithRetry(() => getUserInfo(query_id), i);
            const name = userInfo.firstName ? userInfo.firstName.trim().split(/\s+/)[0] : 'N/A';

            // Intentar establecer la plantilla predeterminada
            const response = await setDefaultTemplate(query_id, assignedTemplate.templateId);
            if (response === 200 || response === 201) { // Asumiendo códigos de éxito
                console.log(`✅ ${assignedTemplate.name} Template Successfully set for ${name}`.green);
            }
        } catch (error) {
            if (error.response && [402, 403].includes(error.response.status)) {
                // Obtener información del usuario para obtener el nombre
                try {
                    const userInfo = await getUserInfo(query_id);
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
    }
}

// Function to start the painting process
const startToPaint = async () => {
    // Preguntar al usuario si desea usar plantillas aleatorias
    const useRandomTemplatesInput = askQuestion('Do you wish to use Random Templates for each user? (y/n): ').toLowerCase();
    const useRandomTemplates = useRandomTemplatesInput === 'y';

    let templateAssignments = []; // Arreglo para almacenar la plantilla asignada a cada cuenta

    if (useRandomTemplates) {
        // Asignar una plantilla aleatoria a cada cuenta
        for (let i = 0; i < accountsWebAppData.length; i++) {
            const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
            templateAssignments.push(randomTemplate);
        }
    } else {
        // Mostrar lista de plantillas y permitir al usuario seleccionar una
        const selectedTemplate = selectTemplate();
        if (selectedTemplate === null) {
            console.log('No template selected. Exiting...'.red);
            return;
        }
        // Asignar la misma plantilla a todas las cuentas
        for (let i = 0; i < accountsWebAppData.length; i++) {
            templateAssignments.push(selectedTemplate);
        }
    }

    // Preguntar al usuario si desea mantener el código corriendo constantemente
    let keepRunning = false;
    const userChoice = askQuestion('Do you wish to keep running the code constantly? (y/n): ').toLowerCase();
    if (userChoice === 'y') {
        keepRunning = true;
        isRunning = true; // Establecer la bandera global
    }

    // Establecer las plantillas asignadas como predeterminadas para cada cuenta
    await setDefaultTemplateForAccounts(templateAssignments);

    console.log('\n🔄 Starting the painting process with the selected template(s)'.blue);

    // Objeto para rastrear el progreso de cada plantilla
    const templateProgress = {};

    // Función para obtener la lista de píxeles a pintar para una plantilla
    const getPixelsToPaint = (template) => {
        const colorMatrix = templateColorMatrices[template.templateId];
        const { minX, minY, maxX, maxY } = template;
        const width = colorMatrix[0].length;
        const height = colorMatrix.length;

        const pixelsToPaint = [];
        for (let y = 0; y < height; y++) {
            const gameY = minY + y;
            if (gameY < minY || gameY > maxY) {
                continue; // Saltar si está fuera del rango Y
            }
            for (let x = 0; x < width; x++) {
                const gameX = minX + x;
                if (gameX < minX || gameX > maxX) {
                    continue; // Saltar si está fuera del rango X
                }
                const pixelId = gameY * 1000 + gameX;
                const imageColor = colorMatrix[y][x];

                if (!imageColor) {
                    continue; // Saltar píxeles sin color (transparente)
                }

                // Mapear el color de la imagen al color más cercano del juego
                const targetColor = findClosestColor(imageColor);

                pixelsToPaint.push({
                    x: gameX,
                    y: gameY,
                    pixelId,
                    targetColor
                });
            }
        }
        return pixelsToPaint;
    };

    // Cargar las imágenes de las plantillas y crear matrices de colores
    const templateColorMatrices = {};
    for (const template of templates) {
        templateColorMatrices[template.templateId] = await loadTemplateImage(template);
    }

    const executePainting = async () => {
        // Almacenar las cuentas que tienen oportunidades de pintura
        const accountsWithCharges = [];

        // Primero, verificar y recopilar las cuentas con oportunidades de pintura
        for (let i = 0; i < accountsWebAppData.length; i++) {
            let query_id = accountsWebAppData[i];
            if (!query_id) {
                continue;
            }

            // Obtener el estado de minería y las oportunidades de pintura
            let miningStatus;
            try {
                miningStatus = await performActionWithRetry(() => getMiningStatus(query_id), i);
                accountCharges[i] = miningStatus.charges !== undefined ? miningStatus.charges : 0;

                if (accountCharges[i] > 0) {
                    accountsWithCharges.push({
                        index: i,
                        query_id: query_id,
                        charges: accountCharges[i],
                        template: templateAssignments[i]
                    });
                }
            } catch (error) {
                accountCharges[i] = 0;
                continue;
            }

            // Introducir un pequeño retraso entre solicitudes
            await delay(50);
        }

        // Si no hay cuentas con oportunidades, mostrar un mensaje y salir
        if (accountsWithCharges.length === 0) {
            console.log('🔴 No accounts have painting opportunities left. Exiting painting process.'.red);
            return;
        }

        // Procesar las cuentas con oportunidades de pintura
        while (true) {
            let anyChargesLeft = false;

            for (const accountData of accountsWithCharges) {
                const { index: i, query_id, template } = accountData;
                const templateId = template.templateId;

                // Verificar si la cuenta aún tiene oportunidades
                if (accountCharges[i] <= 0) {
                    continue;
                }

                anyChargesLeft = true;

                // Obtener o inicializar currentPixelIndex para esta plantilla y cuenta
                if (!templateProgress[templateId]) {
                    templateProgress[templateId] = {};
                }
                if (templateProgress[templateId][i] === undefined) {
                    templateProgress[templateId][i] = 0;
                }

                const currentPixelIndex = templateProgress[templateId][i];

                // Obtener los píxeles a pintar para esta plantilla
                const pixelsToPaint = getPixelsToPaint(template);

                // Si hemos procesado todos los píxeles, continuar con la siguiente cuenta
                if (currentPixelIndex >= pixelsToPaint.length) {
                    console.log(`✅ All pixels painted for template ID ${templateId} by account ID ${i + 1}.`.green);
                    continue;
                }

                console.log(`\n🎨 Processing template: ${template.name} (ID: ${template.templateId}) for account ID ${i + 1}`);
                console.log(`✅ Account ID ${i + 1} has ${accountCharges[i]} painting opportunities remaining.`);

                // Procesar los píxeles desde currentPixelIndex
                while (accountCharges[i] > 0 && templateProgress[templateId][i] < pixelsToPaint.length) {
                    const pixelData = pixelsToPaint[templateProgress[templateId][i]];
                    const { x: gameX, y: gameY, pixelId, targetColor } = pixelData;

                    // Definir la acción para obtener detalles del píxel
                    const actionGetPixelDetails = async () => {
                        const pixelDetails = await getPixelDetails(query_id, pixelId);
                        const currentColor = pixelDetails.pixel.color;

                        if (currentColor.toLowerCase() !== targetColor.toLowerCase()) {
                            // Definir la acción para iniciar el repintado
                            const actionStartRepaint = async () => {
                                const repaintResponse = await startRepaint(query_id, targetColor, pixelId);
                                if (repaintResponse.balance !== undefined) {
                                    const balance = parseFloat(repaintResponse.balance).toFixed(2);
                                    console.log(`✅ Pixel (${gameX}, ${gameY}) painted with color ${targetColor}. Your Points are now: ${balance}`.green);
                                    accountCharges[i] -= 1;
                                } else {
                                    console.log(`⛔️ Could not paint Pixel (${gameX}, ${gameY}).`.red);
                                }
                            };
                            await performActionWithRetry(actionStartRepaint, i);
                        } else {
                            console.log(`ℹ️ Pixel (${gameX}, ${gameY}) already has the correct color.`.cyan);
                        }
                    };
                    await performActionWithRetry(actionGetPixelDetails, i);

                    // Incrementar currentPixelIndex para avanzar al siguiente píxel
                    templateProgress[templateId][i] += 1;

                    // Retraso entre cada píxel
                    await delay(300);
                }

                console.log(`✅ Finished processing for account ID ${i + 1}.`.green);

                // Introduce un pequeño retraso entre cuentas
                await delay(200);
            }

            // Verificar si todas las cuentas se han quedado sin oportunidades o todas las plantillas se han completado
            if (!anyChargesLeft) {
                console.log('🔴 All accounts have used their painting opportunities or all templates are completed. Exiting painting process.'.red);
                break;
            }
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
            // Reiniciar templateProgress para comenzar desde el inicio en la siguiente ejecución
            for (let templateId in templateProgress) {
                templateProgress[templateId] = {};
            }
            await executePainting();
        }, 10 * 60 * 1000); // 10 minutos en milisegundos
    }
};

// Function to display the main menu and handle user input
const main = async () => {
    displayHeader();
    await displayAccountsTable();

    // Mostrar el menú
    console.log('\nSelect an option:'.yellow);
    console.log('1. Start to Paint'.green);
    console.log('2. Exit'.green);

    const choice = askQuestion('Enter the option number: ');

    switch (choice) {
        case '1':
            await startToPaint();
            // Después de startToPaint, verificar si isRunning es true
            if (!isRunning) {
                // Si no se está ejecutando continuamente, volver al menú principal
                await pause();
                main();
            } else {
                // Si se está ejecutando continuamente, no volver al menú principal
                // Informar al usuario que el proceso está en ejecución
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
};

// Start the program
(async () => {
    await loadAllAccounts();
    await updateWebAppData();
    main();
})();
