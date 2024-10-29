// Import the necessary modules
const UserAgent = require('user-agents');
const { faker } = require('@faker-js/faker');
const fs = require('fs');

// Function to save user agents to a file
function saveUserAgentsToFile(userAgents, filename) {
    const data = Array.from(userAgents).join('\n');
    fs.writeFileSync(filename, data, 'utf8');
}

// Function to generate User-Agent using user-agents library
function generateFromUserAgentsLibrary() {
    const userAgent = new UserAgent().toString();
    return userAgent;
}

// Function to generate User-Agent using faker library
function generateFromFaker() {
    const userAgent = faker.internet.userAgent();
    return userAgent;
}

// Function to generate a custom User-Agent string
function generateCustomUserAgent() {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Brave', 'Vivaldi', 'Internet Explorer'];
    const operatingSystems = ['Windows NT 10.0; Win64; x64', 'Macintosh; Intel Mac OS X 10_15_7', 'X11; Linux x86_64', 'iPhone; CPU iPhone OS 14_0 like Mac OS X', 'Android 11; Mobile'];
    const devices = ['AppleWebKit/537.36 (KHTML, like Gecko)', 'Gecko/20100101 Firefox/89.0', 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'];

    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const os = operatingSystems[Math.floor(Math.random() * operatingSystems.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const browserVersion = `${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`;

    let userAgent = '';

    switch (browser) {
        case 'Chrome':
        case 'Edge':
        case 'Opera':
        case 'Brave':
        case 'Vivaldi':
            userAgent = `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${browserVersion} Safari/537.36`;
            break;
        case 'Firefox':
            userAgent = `Mozilla/5.0 (${os}; rv:${Math.floor(Math.random() * 100)}.0) Gecko/20100101 Firefox/${Math.floor(Math.random() * 100)}.0`;
            break;
        case 'Safari':
            userAgent = `Mozilla/5.0 (${os}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${Math.floor(Math.random() * 20)}.0 Safari/605.1.15`;
            break;
        case 'Internet Explorer':
            userAgent = `Mozilla/5.0 (${os}; Trident/7.0; rv:11.0) like Gecko`;
            break;
        default:
            userAgent = `Mozilla/5.0 (${os}) ${device} ${browser}/${browserVersion}`;
    }

    return userAgent;
}

// Main function to generate unique User-Agents
function main() {
    const numUserAgents = 100;
    const generatedUserAgents = new Set();

    while (generatedUserAgents.size < numUserAgents) {
        // Randomly choose a generation method
        const method = Math.floor(Math.random() * 3); // 0, 1, or 2

        let userAgent = '';

        switch (method) {
            case 0:
                userAgent = generateFromUserAgentsLibrary();
                break;
            case 1:
                userAgent = generateFromFaker();
                break;
            case 2:
                userAgent = generateCustomUserAgent();
                break;
            default:
                userAgent = generateFromUserAgentsLibrary();
        }

        // Add to the set (duplicates are automatically ignored)
        generatedUserAgents.add(userAgent);
    }

    const filename = 'user_agents.txt';
    saveUserAgentsToFile(generatedUserAgents, filename);

    console.log(`${numUserAgents} unique and varied User-Agents generated and saved to ${filename}:\n`);
    generatedUserAgents.forEach(ua => console.log(ua));
}

// Execute the main function
main();
