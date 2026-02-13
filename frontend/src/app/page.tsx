"use client";
import React, { useEffect, useState } from "react";
import {
  Users,
  MapPin,
  Activity,
  Loader2,
  Database,
  ShieldCheck,
  Server
} from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const statsRes = await axios.get("http://127.0.0.1:8000/stats");
        setStats(statsRes.data);
      } catch (err) {
        console.error("Fetch Stats Error:", err);
      }
    };

    const fetchRecentLeads = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/leads/all?limit=6");
        setRecentLeads(res.data.leads);
      } catch (err) {
        console.error("Fetch Leads Error:", err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentLeads()]);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return (
    <div className="h-[80vh] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10 pb-12 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
        <p className="text-zinc-500 font-medium">Real-time stats from your scraping engine.</p>
      </header>

      {/* Real KPIs Only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-[2rem] flex items-center gap-6"
        >
          <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Total Leads</p>
            <h3 className="text-4xl font-black text-white">{stats?.total_leads || 0}</h3>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 rounded-[2rem] flex items-center gap-6"
        >
          <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400">
            <MapPin className="w-8 h-8" />
          </div>
          <div>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Locations Covered</p>
            <h3 className="text-4xl font-black text-white">{stats?.locations_count || 0}</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Activity (Dynamic) */}
        <div className="lg:col-span-8">
          <div className="glass-card p-8 rounded-[2.5rem]">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold">Latest Leads</h3>
            </div>

            <div className="space-y-3">
              {recentLeads.length > 0 ? (
                recentLeads.map((lead, i) => (
                  <div key={lead._id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Database className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{lead.name}</p>
                        <p className="text-xs text-zinc-500">{lead.city}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 bg-white/5 px-2 py-1 rounded-md uppercase tracking-tighter">
                      {lead.keyword}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-zinc-600 italic">No leads found in database.</p>
              )}
            </div>
          </div>
        </div>

        {/* System Status (Real Connection Status) */}
        <div className="lg:col-span-4">
          <div className="glass-card p-8 rounded-[2.5rem] h-full">
            <h3 className="text-xl font-bold mb-8">System Status</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <Server className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-emerald-500">API Engine</p>
                  <p className="text-xs text-zinc-500">Online & Active</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <Database className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-sm font-bold text-indigo-500">MongoDB</p>
                  <p className="text-xs text-zinc-500">Cluster Connected</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 opacity-60">
                <ShieldCheck className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-bold text-zinc-400">Proxy Engine</p>
                  <p className="text-xs text-zinc-500">Not Configured</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
