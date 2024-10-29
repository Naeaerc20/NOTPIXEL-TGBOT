# NOTPIXEL-TGBOT
A tool that will help you to farm automatically NOTPIXEL Telegram Airdrop Bot.

# Definition of new files and changes to current files.

# index.js

Now you have the option to make calls and manage multiple accounts with proxies included. Some small bugs still need to be fixed but it Will run without problema

# index_paintworld.js

Support for using proxies, geolocation and obtaining IPs of each account added, each account will be able to paint in a random template. 
Strategy: The code makes multiple requests to verify pixels within the coordinate ranges, when an incorrect pixel is found, it is painted, the templates are previously loaded and the code defines the color of each pixel within the coordinate ranges

# IndexV4.js

This new file has been created that uses a custom API to request the correct colors of each pixel according to the template being painted, completely avoiding the multiple interaction of NotPixel APIs. (Requires OTP Authentication code).

It has the option of double color verification if wished to avoid loss of painting opportunities, it handles query renewal, various proxies, accounts & UserAgents etc.

To use it you can contact me through Twitter (x.com/naeaex_dev) This code will have a small and unique cost of 15 USD. You can make your transaction to one of the following addresses and send me the Hash, I will proceed to verify it and send you your own OTP for the correct functioning of it. (we can also make a deal via PM) You will also be able to get my personal support in any problem presented.

# Addresses:
ETH (EVM): 0x0c5871732fC0163FfEDe082b817a1CB60340A115
SOL (SVM): 8WJ6VrPwBJCYsSSUUYg5U6uPivqnRVfDEpLc6ep5mW5v 

# UserAgentGenerator.js

Generate your own UserAgents to make your requests to act more smoothly and normals as in a normal device thry Will be saved in a file called user_agents.txt

# proxies.txt

add your proxies here on the following format "socks5://$USER:PASSWORD@IP:PORT" you can get them from 2captcha server "https://2captcha.com/proxy"
