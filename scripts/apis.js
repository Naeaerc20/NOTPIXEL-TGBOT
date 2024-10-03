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

// Función para mejorar la recompensa por pintado
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

// Función para mejorar la velocidad de recarga
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

// Función para mejorar el límite de energía (cantidad máxima de pintados)
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

// Nuevas APIs para reclamar recompensas de ligas
const getSquadRatingsBronze = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/ratings/squads?league=bronze`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusSilver = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/task/check/leagueBonusSilver`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusGold = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/task/check/leagueBonusGold`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkLeagueBonusPlatinum = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/task/check/leagueBonusPlatinum`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

const checkPaint20Pixels = async (queryId) => {
    try {
        const response = await axios.get(`${BASE_URL}/mining/task/check/paint20pixels`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Exportar todas las funciones
module.exports = {
    getUserInfo,
    getMiningStatus,
    startRepaint,
    claimMiningRewards,
    improvePaintReward,
    improveRechargeSpeed,
    improveEnergyLimit,
    getSquadRatingsBronze,
    checkLeagueBonusSilver,
    checkLeagueBonusGold,
    checkLeagueBonusPlatinum,
    checkPaint20Pixels
};

