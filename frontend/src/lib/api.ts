import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const scrapeApi = {
    startScraping: (keywords: string[], locations: string[], parallelCount: number = 1, syncToSheets: boolean = true) =>
        api.post("/scrape", { keywords, locations, parallel_count: parallelCount, sync_to_sheets: syncToSheets }),

    getStatus: (taskId: string) =>
        api.get(`/status/${taskId}`),

    getLeads: (taskId: string) =>
        api.get(`/leads/${taskId}`),

    getAllLeads: () =>
        api.get("/leads/all") // We need to add this endpoint to backend
};

export default api;
