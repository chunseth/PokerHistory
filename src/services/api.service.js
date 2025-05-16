import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

const apiService = {
    // Get all hands with optional filters
    getHands: async (filters = {}) => {
        try {
            const response = await axiosInstance.get('/hands', { params: filters });
            return response.data;
        } catch (error) {
            console.error('Error fetching hands:', error);
            throw error;
        }
    },

    // Get a single hand by ID
    getHand: async (id) => {
        try {
            const response = await axiosInstance.get(`/hands/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching hand:', error);
            throw error;
        }
    },

    // Create a new hand
    createHand: async (handData) => {
        try {
            const response = await axiosInstance.post('/hands', handData);
            return response.data;
        } catch (error) {
            console.error('Error creating hand:', error);
            throw error;
        }
    },

    // Delete a hand
    deleteHand: async (id) => {
        try {
            const response = await axiosInstance.delete(`/hands/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting hand:', error);
            throw error;
        }
    },

    // Upload hand history file
    uploadHandHistory: async (formData, onProgress) => {
        try {
            const response = await axiosInstance.post('/hands/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress) {
                        onProgress({
                            processedHands: progressEvent.loaded,
                            totalHands: progressEvent.total
                        });
                    }
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error uploading hand history:', error);
            throw error;
        }
    },

    async getHandsByDateRange(startDate, endDate) {
        try {
            const response = await axiosInstance.get('/hands', {
                params: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching hands by date range:', error);
            throw error;
        }
    },

    async getHandsByPosition(position) {
        try {
            const response = await axiosInstance.get('/hands', {
                params: { position }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching hands by position:', error);
            throw error;
        }
    },

    // Update a hand
    updateHand: async (id, updates) => {
        try {
            const response = await axiosInstance.patch(`/hands/${id}`, updates);
            return response.data;
        } catch (error) {
            console.error('Error updating hand:', error);
            throw error;
        }
    },

    // Get unique usernames
    getUsernames: async () => {
        try {
            const response = await axiosInstance.get('/hands/usernames');
            return response.data;
        } catch (error) {
            console.error('Error fetching usernames:', error);
            throw error;
        }
    }
};

export default apiService; 