// scripts/apis.js

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const http = require('http');
const https = require('https');

const BASE_URL = 'https://notpx.app/api/v1';
const SERVER_BASE_URL = 'http://147.45.41.171:4000';
const DEFAULT_OTP = 'SET YOUR OTP HERE';

const createHttpAgent = (proxy) => {
    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        try {
            return new SocksProxyAgent(proxy);
        } catch (error) {}
    }
    return new http.Agent({ keepAlive: true });
};

const createHttpsAgent = (proxy) => {
    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        try {
            return new SocksProxyAgent(proxy);
        } catch (error) {}
    }
    return new https.Agent({ keepAlive: true });
};

const createAxiosInstance = (proxy, userAgent) => {
    const headers = {
        'User-Agent': userAgent || 'Mozilla/5.0',
        'Content-Type': 'application/json',
    };

    const config = {
        headers: headers,
        timeout: 10000,
        httpAgent: createHttpAgent(proxy),
        httpsAgent: createHttpsAgent(proxy),
    };

    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        config.proxy = false;
    }

    return axios.create(config);
};

const getPublicIP = async (proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get('https://api.ipify.org?format=json', {
            timeout: 5000
        });
        return response.data.ip;
    } catch (error) {
        return 'N/A';
    }
};

const getGeolocation = async (ip) => {
    if (ip === 'N/A') return 'N/A';
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`, {
            timeout: 5000
        });
        return response.data.country || 'N/A';
    } catch (error) {
        return 'N/A';
    }
};

const getUserInfo = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/users/me`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const getMiningStatus = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/status`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const startRepaint = async (queryId, proxy, userAgent, newColor, pixelId) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const payload = {
        newColor,
        pixelId
    };
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.post(`${BASE_URL}/repaint/start`, payload, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const setDefaultTemplate = async (queryId, proxy, userAgent, templateId) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.put(`${BASE_URL}/image/template/subscribe/${templateId}`, null, config);
        return response.status;
    } catch (error) {
        throw error;
    }
};

const getPixelDetails = async (queryId, pixelId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/image/get/${pixelId}`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkPixelColor = async (templateId, pixelId, proxy, userAgent) => {
    const url = `${SERVER_BASE_URL}/getPixelDetail`;
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(url, {
            headers: {
                'x-otp': DEFAULT_OTP,
                'Content-Type': 'application/json'
            },
            params: {
                templateId: templateId,
                pixelId: pixelId
            },
            timeout: 5000
        });
        return response.data.color;
    } catch (error) {
        throw error;
    }
};

const claimMiningRewards = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/claim`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const improvePaintReward = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/boost/check/paintReward`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const improveRechargeSpeed = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/boost/check/reChargeSpeed`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const improveEnergyLimit = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/boost/check/energyLimit`, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

const getSquadRatingsBronze = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/ratings/squads?league=bronze`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusSilver = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/leagueBonusSilver`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusGold = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/leagueBonusGold`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusPlatinum = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/leagueBonusPlatinum`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkPaint20Pixels = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/paint20pixels`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkMakePixelAvatar = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/makePixelAvatar`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const completeBoinkTask = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/boinkTask`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const completeJettonTask = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/jettonTask`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const completePixelInNameTask = async (queryId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    try {
        const response = await axiosInstance.get(`${BASE_URL}/mining/task/check/pixelInNickname`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    setDefaultTemplate,
    checkPixelColor,
    getPixelDetails,
    getPublicIP,
    getGeolocation,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit,
    getSquadRatingsBronze,
    checkLeagueBonusSilver,
    checkLeagueBonusGold,
    checkLeagueBonusPlatinum,
    checkPaint20Pixels,
    checkMakePixelAvatar,
    completeBoinkTask,
    completeJettonTask,
    completePixelInNameTask
};
