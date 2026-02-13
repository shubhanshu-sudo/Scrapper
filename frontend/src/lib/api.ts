import axios from "axios";

// Single source of truth for API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const scrapeApi = {
    // Mission Control
    startScraping: (keywords: string[], locations: string[]) =>
        api.post("/scrape", { keywords, locations }),

    getStatus: (taskId: string) =>
        api.get(`/status/${taskId}`),

    // Lead Management
    getAllLeads: (page: number = 1, limit: number = 50, search: string = "", keyword: string = "") => {
        let url = `/leads/all?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        return api.get(url);
    },

    deleteLead: (id: string) =>
        api.delete(`/leads/${id}`),

    bulkDelete: (leadIds: string[]) =>
        api.post("/leads/bulk-delete", { lead_ids: leadIds }),

    // Helpers
    getKeywords: () =>
        api.get("/keywords"),

    getStats: () =>
        api.get("/stats"),

    getLeadsByTask: (taskId: string) =>
        api.get(`/leads/${taskId}`),
};

export default api;
