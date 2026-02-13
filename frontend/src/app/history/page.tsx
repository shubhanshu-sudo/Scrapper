"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
    Download,
    Search,
    Trash2,
    ExternalLink,
    Mail,
    Phone,
    Loader2,
    Tag,
    CheckSquare,
    Square,
    AlertCircle,
    X,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

export default function HistoryPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deleting, setDeleting] = useState(false);

    // Pagination & Filter States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
    const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);

    const limit = 20;

    const fetchKeywords = async () => {
        try {
            const res = await axios.get("http://127.0.0.1:8000/keywords");
            setAvailableKeywords(res.data);
        } catch (err) {
            console.error("Keywords Error:", err);
        }
    };

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            let url = `http://127.0.0.1:8000/leads/all?page=${page}&limit=${limit}`;
            if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
            if (selectedKeyword) url += `&keyword=${encodeURIComponent(selectedKeyword)}`;

            const response = await axios.get(url);
            setLeads(response.data.leads);
            setTotalPages(response.data.pages);
            setTotalLeads(response.data.total);
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, selectedKeyword]);

    useEffect(() => {
        fetchKeywords();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchLeads();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [fetchLeads]);

    const handleSelectAll = () => {
        if (selectedIds.length === leads.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(leads.map(l => l._id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const deleteSingle = async (id: string) => {
        if (!confirm("Are you sure you want to delete this lead?")) return;
        try {
            await axios.delete(`http://127.0.0.1:8000/leads/${id}`);
            fetchLeads();
            setSelectedIds(selectedIds.filter(i => i !== id));
        } catch (err) {
            alert("Failed to delete lead");
        }
    };

    const deleteBulk = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} leads?`)) return;
        setDeleting(true);
        try {
            await axios.post("http://127.0.0.1:8000/leads/bulk-delete", { lead_ids: selectedIds });
            fetchLeads();
            setSelectedIds([]);
        } catch (err) {
            alert("Failed to delete leads");
        } finally {
            setDeleting(false);
        }
    };

    const exportCSV = () => {
        if (leads.length === 0) return;
        const headers = ["Name", "Address", "Phone", "Website", "Email", "Country", "City", "Keyword"];
        const rows = leads.map(l => [l.name, l.address, l.phone, l.website, l.email, l.country, l.city, l.keyword]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "scraping_leads.csv");
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Lead Intelligence</h1>
                    <p className="text-zinc-500 font-medium">Found {totalLeads} records in your database.</p>
                </div>
                <div className="flex gap-4">
                    <AnimatePresence>
                        {selectedIds.length > 0 && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={deleteBulk}
                                disabled={deleting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all text-sm font-bold text-red-400"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Bulk Delete ({selectedIds.length})
                            </motion.button>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-6 py-2.5 premium-gradient rounded-2xl hover:opacity-90 transition-all text-sm font-bold text-white shadow-xl shadow-indigo-500/20"
                    >
                        <Download className="w-4 h-4" />
                        Export Page
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search leads via backend..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1); // Reset to first page on search
                        }}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-[1.5rem] pl-12 pr-4 py-4 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 max-w-full no-scrollbar">
                    <button
                        onClick={() => { setSelectedKeyword(null); setPage(1); }}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${!selectedKeyword ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-zinc-500 border border-white/10 hover:bg-white/10'}`}
                    >
                        All Categories
                    </button>
                    {availableKeywords.map(kw => (
                        <button
                            key={kw}
                            onClick={() => { setSelectedKeyword(kw); setPage(1); }}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap uppercase tracking-wider ${selectedKeyword === kw ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-zinc-500 border border-white/10 hover:bg-white/10'}`}
                        >
                            {kw}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden">
                {loading ? (
                    <div className="p-32 flex flex-col items-center justify-center gap-6 text-zinc-500">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                        <p className="font-black tracking-[0.2em] uppercase text-[10px]">Filtering Backend Intelligence...</p>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="p-32 text-center flex flex-col items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-zinc-700" />
                        </div>
                        <p className="text-zinc-500 font-medium italic">No leads found matching your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.03] border-b border-white/5">
                                    <th className="px-8 py-6 w-12">
                                        <button onClick={handleSelectAll} className="text-zinc-500 hover:text-indigo-400 transition-colors">
                                            {selectedIds.length === leads.length ? <CheckSquare className="w-6 h-6 text-indigo-500" /> : <Square className="w-6 h-6" />}
                                        </button>
                                    </th>
                                    <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Identity & Source</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Geo-Metrics</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Communication</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Assets</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {leads.map((lead) => (
                                    <tr key={lead._id} className={`hover:bg-white/[0.02] transition-all group ${selectedIds.includes(lead._id) ? 'bg-indigo-500/[0.04]' : ''}`}>
                                        <td className="px-8 py-6">
                                            <button onClick={() => toggleSelect(lead._id)} className="text-zinc-600 transition-colors">
                                                {selectedIds.includes(lead._id) ? <CheckSquare className="w-6 h-6 text-indigo-500" /> : <Square className="w-6 h-6" />}
                                            </button>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-black text-white mb-2 group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-sm line-clamp-1">{lead.name}</div>
                                            <div className="flex items-center gap-2 px-3 py-1 w-fit rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-[0.1em]">
                                                <Tag className="w-3 h-3" />
                                                {lead.keyword}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="text-sm text-zinc-400 font-semibold line-clamp-1 max-w-[240px] mb-1.5">{lead.address}</div>
                                            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.1em]">{lead.city}, {lead.country}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-200">
                                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><Phone className="w-4 h-4" /></div>
                                                    {lead.phone}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-200">
                                                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Mail className="w-4 h-4" /></div>
                                                    <span className={`${lead.email === "No email" ? "text-zinc-700 italic font-medium" : "text-indigo-300"}`}>
                                                        {lead.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {lead.website !== "No website" ? (
                                                <a
                                                    href={lead.website}
                                                    target="_blank"
                                                    className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-sm"
                                                >
                                                    <span className="line-clamp-1 max-w-[120px]">Visit Registry</span>
                                                    <ExternalLink className="w-4 h-4 text-indigo-500" />
                                                </a>
                                            ) : (
                                                <span className="text-[10px] font-black text-zinc-700 tracking-widest uppercase px-4 py-2 bg-white/5 border border-white/[0.03] rounded-2xl">Offline</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button
                                                onClick={() => deleteSingle(lead._id)}
                                                className="p-3 rounded-2xl text-zinc-800 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Showing <span className="text-indigo-400">{(page - 1) * limit + 1}</span> to <span className="text-indigo-400">{Math.min(page * limit, totalLeads)}</span> of <span className="text-indigo-400">{totalLeads}</span> leads
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-1">
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPage(i + 1)}
                                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 hover:bg-white/5'}`}
                                >
                                    {i + 1}
                                </button>
                            )).slice(Math.max(0, page - 3), page + 2)}
                        </div>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
