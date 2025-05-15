import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

const apiService = {
    // Get all hands with optional filters
    getHands: async (filters = {}) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/hands`, { params: filters });
            return response.data;
        } catch (error) {
            console.error('Error fetching hands:', error);
            throw error;
        }
    },

    // Get a single hand by ID
    getHand: async (id) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/hands/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching hand:', error);
            throw error;
        }
    },

    // Create a new hand
    createHand: async (handData) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/hands`, handData);
            return response.data;
        } catch (error) {
            console.error('Error creating hand:', error);
            throw error;
        }
    },

    // Delete a hand
    deleteHand: async (id) => {
        try {
            const response = await axios.delete(`${API_BASE_URL}/hands/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting hand:', error);
            throw error;
        }
    },

    // Upload hand history file
    uploadHandHistory: async (formData, onProgress) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/hands/upload`, formData, {
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
            const response = await axios.get(`${API_BASE_URL}/hands`, {
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
            const response = await axios.get(`${API_BASE_URL}/hands`, {
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
            const response = await axios.patch(`${API_BASE_URL}/hands/${id}`, updates);
            return response.data;
        } catch (error) {
            console.error('Error updating hand:', error);
            throw error;
        }
    }
};

export default apiService; 