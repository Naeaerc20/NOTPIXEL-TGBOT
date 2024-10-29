// scripts/apis.js

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const http = require('http');
const https = require('https');

// Configuración base de la API
const BASE_URL = 'https://notpx.app/api/v1';
const SERVER_BASE_URL = 'http://147.45.41.171:4000';
const DEFAULT_OTP = 'SET YOUR OTP HERE';

// Función para crear agentes HTTP y HTTPS con Keep-Alive
const createHttpAgent = (proxy) => {
    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        try {
            return new SocksProxyAgent(proxy);
        } catch (error) {
            // No imprimir mensajes adicionales
        }
    }
    return new http.Agent({ keepAlive: true });
};

const createHttpsAgent = (proxy) => {
    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        try {
            return new SocksProxyAgent(proxy);
        } catch (error) {
            // No imprimir mensajes adicionales
        }
    }
    return new https.Agent({ keepAlive: true });
};

// Función para crear una instancia de Axios con proxy y user agent
const createAxiosInstance = (proxy, userAgent) => {
    const headers = {
        'User-Agent': userAgent || 'Mozilla/5.0',
        'Content-Type': 'application/json',
    };

    const config = {
        headers: headers,
        timeout: 10000, // Tiempo de espera de 10 segundos
        httpAgent: createHttpAgent(proxy),
        httpsAgent: createHttpsAgent(proxy),
    };

    if (typeof proxy === 'string' && proxy && proxy !== 'N/A') {
        config.proxy = false; // Deshabilita la configuración proxy por defecto de Axios
    }

    return axios.create(config);
};

// Función para obtener la IP pública a través del proxy
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

// Función para obtener la geolocalización basada en la IP
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

// Función para obtener información básica del usuario
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

// Función para obtener el estado de minería y oportunidades de pintura
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

// Función para iniciar un repintado de píxel
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

// Función para establecer una plantilla como predeterminada
const setDefaultTemplate = async (queryId, proxy, userAgent, templateId) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.put(`${BASE_URL}/image/template/subscribe/${templateId}`, null, config);
        return response.status; // Retorna el código de estado
    } catch (error) {
        throw error;
    }
};

// Función para obtener detalles de un píxel específico (incluyendo el color actual)
const getPixelDetails = async (queryId, pixelId, proxy, userAgent) => {
    const axiosInstance = createAxiosInstance(proxy, userAgent);
    const config = {
        headers: {
            authorization: `initData ${queryId}`
        }
    };
    try {
        const response = await axiosInstance.get(`${BASE_URL}/image/get/${pixelId}`, config);
        return response.data; // Asegúrate de que response.data tenga la estructura correcta
    } catch (error) {
        throw error;
    }
};

// Función para obtener el color de un píxel en una plantilla
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
        return response.data.color; // Asumiendo que la respuesta tiene la estructura { "color": "#FFFFFF" }
    } catch (error) {
        throw error;
    }
};

// Funciones adicionales que fueron omitidas, ahora integradas con proxies y user agents

// Función para reclamar recompensas de minería
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

// Funciones para mejorar el rendimiento
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

module.exports = {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    setDefaultTemplate,
    checkPixelColor,
    getPixelDetails, // Exportamos la nueva función
    getPublicIP,
    getGeolocation,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit
};
