"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Chat", href: "/", icon: MessageSquare },
    { name: "Knowledge Base", href: "/knowledge", icon: BookOpen },
    { name: "Settings", href: "/settings", icon: Settings },
];


export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col w-64 border-r bg-card text-card-foreground h-screen sticky top-0">
            <div className="p-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    EditorIO
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>


        </div>
    );
}
