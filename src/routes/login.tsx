import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { loginWithPin } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    navigate({ to: "/" });
    return null;
  }

  async function tryLogin(code: string) {
    setLoading(true);
    setError(null);
    try {
      const contestant = await loginWithPin(code);
      if (contestant) {
        setUser({
          id: contestant.id,
          fullName: contestant.full_name,
          nickname: contestant.nickname,
          photo_url: contestant.photo_url,
        });
        toast.success(`Welcome, ${contestant.nickname ?? contestant.full_name.split(" ")[0]}! 🍺`);
        navigate({ to: "/" });
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setPin("");
        setError("Wrong PIN — try again");
      }
    } catch (err: any) {
      setPin("");
      setError(err.message ?? "Could not connect. Check setup.");
      toast.error(err.message ?? "Database error");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(digit: string) {
    if (loading) return;
    setError(null);

    if (digit === "⌫") {
      setPin((p) => p.slice(0, -1));
      return;
    }

    if (pin.length >= 4) return;

    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      // Small delay so user sees the 4th dot fill before we switch to loading
      setTimeout(() => tryLogin(next), 100);
    }
  }

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["⌫", "0", "✓"],
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 pb-12">
      {/* Logo */}
      <div className="mb-8 text-center select-none">
        <div className="text-6xl mb-2">🍺</div>
        <h1 className="text-3xl font-black tracking-tight text-amber-400">BEERLYMPICS</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter your 4-digit PIN</p>
      </div>

      {/* PIN dots */}
      <div
        className={`mb-6 flex gap-4 transition-all ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
        style={{ animation: shake ? "shake 0.5s ease-in-out" : undefined }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-16 w-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-150 ${
              loading
                ? "border-amber-400/50 bg-amber-400/10 animate-pulse"
                : pin.length > i
                ? "border-amber-400 bg-amber-400/15 scale-105"
                : "border-zinc-700"
            }`}
          >
            {pin.length > i && !loading && (
              <div className="h-4 w-4 rounded-full bg-amber-400" />
            )}
          </div>
        ))}
      </div>

      {/* Error message */}
      <div className="mb-4 h-6 text-center">
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.flat().map((key) => {
          const isBackspace = key === "⌫";
          const isConfirm = key === "✓";
          const disabled = loading || (isConfirm && pin.length < 4);

          return (
            <button
              key={key}
              onClick={() => handleKey(key)}
              disabled={disabled}
              className={`h-[72px] rounded-2xl text-2xl font-semibold select-none transition-all active:scale-95 touch-manipulation ${
                isConfirm
                  ? "bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-25"
                  : isBackspace
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-25"
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
              } disabled:cursor-not-allowed`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {loading && isConfirm ? (
                <span className="text-base">…</span>
              ) : key}
            </button>
          );
        })}
      </div>

      <a
        href="/"
        className="mt-10 text-xs text-zinc-700 hover:text-zinc-500 touch-manipulation"
      >
        View leaderboard without logging in →
      </a>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-8px); }
          30%, 60%, 90% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
