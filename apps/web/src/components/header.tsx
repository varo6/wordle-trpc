import { Link } from "@tanstack/react-router";
import { Terminal, Cpu, Binary, Code2 } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/todos", label: "Todos" },
  ];

  return (
    <header className="border-b-2 border-blue-100 bg-white backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Terminal className="w-8 h-8 text-blue-600" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            </div>
            <h1 className="text-2xl font-mono font-bold text-gray-900">
              TRUSTLAB<span className="text-blue-600">WORDLE</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors">
              <Binary className="w-5 h-5 text-blue-600" />
            </button>
            <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors">
              <Cpu className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
