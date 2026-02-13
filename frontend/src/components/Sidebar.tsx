"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Search,
    History,
    Settings,
    Database,
    Terminal,
    LogOut
} from "lucide-react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/" },
    { name: "Start Scraping", icon: Search, href: "/scrape" },
    { name: "Lead History", icon: History, href: "/history" },
    { name: "Database", icon: Database, href: "/database" },
    { name: "Debug Logs", icon: Terminal, href: "/logs" },
    { name: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="w-72 h-screen bg-[#050507] border-r border-white/5 flex flex-col fixed left-0 top-0 z-50">
            <div className="p-8">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-transform group-hover:scale-110">
                        <Search className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tighter text-white">MAPSCRAPE</span>
                        <span className="text-[10px] font-bold text-indigo-500 tracking-[0.2em] -mt-1">INTELLIGENCE</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-6 py-4 space-y-2">
                {navItems.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                            pathname === item.href
                                ? "bg-white/5 text-white"
                                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]"
                        )}
                    >
                        {pathname === item.href && (
                            <motion.div
                                layoutId="active-nav"
                                className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                            />
                        )}
                        <item.icon className={cn(
                            "w-5 h-5 transition-colors",
                            pathname === item.href ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                        )} />
                        <span className="font-bold text-sm tracking-tight">{item.name}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-6">
                <div className="p-6 rounded-[2rem] bg-indigo-600/5 border border-indigo-600/10">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest text-center">Engine v1.0 Live</p>
                </div>
            </div>
        </div>
    );
}
