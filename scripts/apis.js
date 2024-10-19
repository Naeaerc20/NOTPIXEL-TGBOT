// scripts/apis.js

const axios = require('axios');

// Configuración base de la API
const BASE_URL = 'https://notpx.app/api/v1';

// Función para obtener información básica del usuario
const getUserInfo = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/users/me`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Función para obtener el estado de minería y oportunidades de pintado
const getMiningStatus = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/status`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Función para iniciar un pintado de pixel
const startRepaint = async (queryId, newColor, pixelId) => {
    try {
        const payload = {
            newColor,
            pixelId
        };
        const response = await axios.post(`${BASE_URL}/repaint/start`, payload, {
            headers: {
                authorization: `initData ${queryId}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Función para reclamar recompensas de minería
const claimMiningRewards = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/claim`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Funciones para mejorar el rendimiento
const improvePaintReward = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/boost/check/paintReward`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const improveRechargeSpeed = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/boost/check/reChargeSpeed`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const improveEnergyLimit = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/boost/check/energyLimit`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};


// Función para obtener detalles de un pixel específico
const getPixelDetails = async (queryId, pixelId) => {
    try {
        const response = await axios.get(`${BASE_URL}/image/get/${pixelId}`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Función para verificar una plantilla
const checkTemplate = async (queryId, templateId) => {
    try {
        const response = await axios.get(`${BASE_URL}/image/template/${templateId}`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.status; // Devolvemos el código de estado
    } catch (error) {
        if (error.response) {
            return error.response.status; // Devolvemos el código de error
        }
        throw error;
    }
};

// Función para establecer una plantilla como predeterminada
const setDefaultTemplate = async (queryId, templateId) => {
    try {
        const response = await axios.put(`${BASE_URL}/image/template/subscribe/${templateId}`, null, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.status; // Devolvemos el código de estado
    } catch (error) {
        throw error;
    }
};

module.exports = {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit,
    getPixelDetails,
    checkTemplate,
    setDefaultTemplate
};
