"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name, color }: { name: string; color: string }) {
  switch (name) {
    case "inicio":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "prog":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 17l5-5 4 3 6-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 20h16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "hist":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" />
          <path d="M12 7.5V12l3 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "plano":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="2" />
          <path d="M4 9h16M9 3v4M15 3v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

const items = [
  { href: "/", key: "inicio", label: "INÍCIO", icon: "inicio" },
  { href: "/progressao", key: "prog", label: "PROG", icon: "prog" },
  { href: "/historico", key: "hist", label: "HISTÓRICO", icon: "hist" },
  { href: "/plano", key: "plano", label: "PLANO", icon: "plano" },
];

export default function BottomNav({ authEnabled }: { authEnabled?: boolean }) {
  const path = usePathname();
  if (path.startsWith("/login")) return null;

  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  const c = (href: string) => (active(href) ? "#D6FB3D" : "#5A5A63");

  // INÍCIO, PROG, [TREINAR central], HISTÓRICO, PLANO
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <div
      className="relative z-20 flex shrink-0 items-end justify-between border-t border-white/[0.07] px-3.5 pt-2.5"
      style={{
        background: "rgba(10,10,12,0.92)",
        backdropFilter: "blur(16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
      }}
    >
      {left.map((it) => (
        <Link key={it.key} href={it.href} className="flex flex-1 flex-col items-center gap-1">
          <Icon name={it.icon} color={c(it.href)} />
          <span className="font-mono text-[8px] tracking-[0.06em]" style={{ color: c(it.href) }}>
            {it.label}
          </span>
        </Link>
      ))}

      {/* Botão central TREINAR */}
      <Link href="/treinar" className="-mt-6 flex flex-1 flex-col items-center">
        <span
          className="flex h-[54px] w-[54px] items-center justify-center rounded-full border-4 border-bg bg-accent"
          style={{ boxShadow: "0 0 24px rgba(214,251,61,.45)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="#0A0A0C" />
          </svg>
        </span>
        <span
          className="mt-1 font-mono text-[8px] tracking-[0.06em]"
          style={{ color: c("/treinar") }}
        >
          TREINAR
        </span>
      </Link>

      {right.map((it) => (
        <Link key={it.key} href={it.href} className="flex flex-1 flex-col items-center gap-1">
          <Icon name={it.icon} color={c(it.href)} />
          <span className="font-mono text-[8px] tracking-[0.06em]" style={{ color: c(it.href) }}>
            {it.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
