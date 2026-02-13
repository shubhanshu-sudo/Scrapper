"use client";
import React, { useState, useEffect } from "react";
import {
    Play,
    Plus,
    X,
    MapPin,
    Search,
    Globe,
    Monitor,
    Loader2,
    CheckCircle2
} from "lucide-react";
import { scrapeApi } from "@/lib/api";

export default function ScrapePage() {
    const [keywords, setKeywords] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [kwInput, setKwInput] = useState("");
    const [locInput, setLocInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeTask, setActiveTask] = useState<any>(null);

    // Load existing task from localStorage on mount
    useEffect(() => {
        const savedTaskId = localStorage.getItem("active_scraping_task_id");
        if (savedTaskId) {
            checkExistingTask(savedTaskId);
        }
    }, []);

    const checkExistingTask = async (taskId: string) => {
        try {
            const response = await scrapeApi.getStatus(taskId);
            setActiveTask(response.data);
        } catch (err) {
            console.error("Error fetching saved task:", err);
            localStorage.removeItem("active_scraping_task_id");
        }
    };

    const addKeyword = () => {
        if (kwInput.trim()) {
            setKeywords([...keywords, kwInput.trim()]);
            setKwInput("");
        }
    };

    const addLocation = () => {
        if (locInput.trim()) {
            setLocations([...locations, locInput.trim()]);
            setLocInput("");
        }
    };

    const removeKeyword = (index: number) => setKeywords(keywords.filter((_, i) => i !== index));
    const removeLocation = (index: number) => setLocations(locations.filter((_, i) => i !== index));

    const handleLaunch = async () => {
        if (keywords.length === 0 || locations.length === 0) {
            alert("Please add at least one keyword and one location.");
            return;
        }

        setLoading(true);
        try {
            const response = await scrapeApi.startScraping(keywords, locations);
            setActiveTask(response.data);
            // Save ID to localStorage for persistence
            localStorage.setItem("active_scraping_task_id", response.data.task_id);
        } catch (err) {
            console.error("Launch Error:", err);
            alert("Failed to start scraping mission.");
        } finally {
            setLoading(false);
        }
    };

    // Poll for status if task is active
    useEffect(() => {
        let interval: any;
        if (activeTask && activeTask.status === "running") {
            interval = setInterval(async () => {
                try {
                    const response = await scrapeApi.getStatus(activeTask.task_id);
                    setActiveTask(response.data);
                    if (response.data.status !== "running") {
                        clearInterval(interval);
                        // We can keep it or clear it. Let's clear after completion to allow new tasks easily.
                        // localStorage.removeItem("active_scraping_task_id"); 
                    }
                } catch (err) {
                    console.error("Poll Error:", err);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [activeTask]);

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Start New Mission</h1>
                <p className="text-zinc-400">Configure your target keywords and locations for scanning.</p>
            </div>

            {activeTask && (
                <div className="p-6 rounded-3xl bg-indigo-600/10 border border-indigo-600/20 backdrop-blur-md animate-glow relative overflow-hidden">
                    {activeTask.status === "running" && (
                        <div className="absolute top-0 left-0 h-full bg-indigo-500/5 transition-all duration-1000" style={{ width: `${activeTask.progress}%` }} />
                    )}
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            {activeTask.status === "running" ? (
                                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            )}
                            <h3 className="font-bold text-lg">
                                {activeTask.status === "running" ? "Mission in Progress" : "Mission Completed"}
                            </h3>
                        </div>
                        <span className="text-sm font-black text-indigo-300 font-mono tracking-tighter">{activeTask.progress}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3 relative z-10">
                        <div
                            className="bg-indigo-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                            style={{ width: `${activeTask.progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-zinc-400 font-medium relative z-10 uppercase tracking-widest">{activeTask.message}</p>

                    {activeTask.status !== "running" && (
                        <button
                            onClick={() => {
                                setActiveTask(null);
                                localStorage.removeItem("active_scraping_task_id");
                            }}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 text-zinc-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 rounded-[2rem] glass-card space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400"><Search className="w-5 h-5" /></div>
                        <h3 className="text-lg font-bold">Target Keywords</h3>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text" value={kwInput} onChange={(e) => setKwInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                            placeholder="e.g. Photo Studio" className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium"
                        />
                        <button onClick={addKeyword} className="p-3.5 bg-indigo-600 rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"><Plus className="w-6 h-6 text-white" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[120px] p-5 bg-black/40 rounded-3xl border border-white/5">
                        {keywords.length === 0 && <p className="text-zinc-600 text-sm italic m-auto">No keywords added yet.</p>}
                        {keywords.map((kw, i) => (
                            <span key={i} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full text-xs font-bold uppercase tracking-tight">
                                {kw}<button onClick={() => removeKeyword(i)}><X className="w-3.5 h-3.5 hover:text-white" /></button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="p-8 rounded-[2rem] glass-card space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400"><MapPin className="w-5 h-5" /></div>
                        <h3 className="text-lg font-bold">Target Locations</h3>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text" value={locInput} onChange={(e) => setLocInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && addLocation()}
                            placeholder="e.g. New Delhi" className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-purple-500/50 transition-all text-sm font-medium"
                        />
                        <button onClick={addLocation} className="p-3.5 bg-purple-600 rounded-2xl hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"><Plus className="w-6 h-6 text-white" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[120px] p-5 bg-black/40 rounded-3xl border border-white/5">
                        {locations.length === 0 && <p className="text-zinc-600 text-sm italic m-auto">No locations added yet.</p>}
                        {locations.map((loc, i) => (
                            <span key={i} className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-full text-xs font-bold uppercase tracking-tight">
                                {loc}<button onClick={() => removeLocation(i)}><X className="w-3.5 h-3.5 hover:text-white" /></button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-10 rounded-[2.5rem] glass-card">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><Globe className="w-6 h-6 text-indigo-400" /> Execution Strategy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Parallel Browsers</label>
                        <div className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                            <input type="range" min="1" max="8" defaultValue="1" className="flex-1 accent-indigo-500" />
                            <span className="text-lg font-black text-white bg-indigo-500/20 px-4 py-1.5 rounded-xl border border-indigo-500/30">1</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Browser Mode</label>
                        <div className="flex items-center gap-4 p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition-all">
                            <Monitor className="w-6 h-6 text-indigo-400" />
                            <span className="text-sm font-bold text-zinc-300">New Headless Engine (Anti-Detection)</span>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={handleLaunch}
                disabled={loading || (activeTask && activeTask.status === "running")}
                className="w-full py-5 bg-indigo-600 rounded-[2rem] font-black text-lg tracking-widest flex items-center justify-center gap-4 hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-indigo-600/20 group"
            >
                {loading ? (
                    <Loader2 className="w-7 h-7 animate-spin text-white" />
                ) : (
                    <Play className="w-7 h-7 fill-white group-hover:scale-110 transition-transform" />
                )}
                LAUNCH SCRAPING MISSION
            </button>
        </div>
    );
}
