// scripts/apis.js

const axios = require('axios');

// Base configuration of the API
const BASE_URL = 'https://notpx.app/api/v1';

// Function to get basic user information
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

// Function to get mining status and painting opportunities
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

// Function to start a pixel repaint
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

// Function to claim mining rewards
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

// Functions to improve performance
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

// Function to get details of a specific pixel
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

// Function to check a template
const checkTemplate = async (queryId, templateId) => {
    try {
        const response = await axios.get(`${BASE_URL}/image/template/${templateId}`, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.status; // Return the status code
    } catch (error) {
        if (error.response) {
            return error.response.status; // Return the error code
        }
        throw error;
    }
};

// Function to set a template as default
const setDefaultTemplate = async (queryId, templateId) => {
    try {
        const response = await axios.put(`${BASE_URL}/image/template/subscribe/${templateId}`, null, {
            headers: {
                authorization: `initData ${queryId}`
            }
        });
        return response.status; // Return the status code
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
