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

  if (user) {
    navigate({ to: "/" });
    return null;
  }

  async function handleSubmit() {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const contestant = await loginWithPin(pin);
      if (contestant) {
        setUser({
          id: contestant.id,
          fullName: contestant.full_name,
          nickname: contestant.nickname,
          photo_url: contestant.photo_url,
        });
        toast.success(`Welcome, ${contestant.nickname ?? contestant.full_name}! 🍺`);
        navigate({ to: "/" });
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 600);
        toast.error("Wrong PIN, try again");
        setPin("");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKey(digit: string) {
    if (loading) return;
    if (digit === "⌫") {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => {
          setLoading(true);
          loginWithPin(next).then((contestant) => {
            if (contestant) {
              setUser({
                id: contestant.id,
                fullName: contestant.full_name,
                nickname: contestant.nickname,
                photo_url: contestant.photo_url,
              });
              toast.success(`Welcome, ${contestant.nickname ?? contestant.full_name}! 🍺`);
              navigate({ to: "/" });
            } else {
              setShake(true);
              setTimeout(() => setShake(false), 600);
              toast.error("Wrong PIN, try again");
              setPin("");
            }
            setLoading(false);
          });
        }, 120);
      }
    }
  }

  const rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["⌫", "0", "✓"]];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="mb-8 text-center">
        <div className="text-5xl">🍺</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-amber-400">BEERLYMPICS</h1>
        <p className="mt-1 text-sm text-zinc-400">Enter your PIN code</p>
      </div>

      {/* PIN display */}
      <div className={`mb-8 flex gap-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-14 w-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
              pin.length > i
                ? "border-amber-400 bg-amber-400/10 text-amber-400"
                : "border-zinc-700 text-transparent"
            }`}
          >
            {pin.length > i ? "●" : "○"}
          </div>
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {rows.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            disabled={loading || (key === "✓" && pin.length < 4)}
            className={`h-16 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
              key === "✓"
                ? "bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-30"
                : key === "⌫"
                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "bg-zinc-800 text-white hover:bg-zinc-700"
            } disabled:cursor-not-allowed`}
          >
            {loading && key === "✓" ? "..." : key}
          </button>
        ))}
      </div>

      <a href="/" className="mt-10 text-xs text-zinc-600 hover:text-zinc-400">
        View leaderboard without logging in →
      </a>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
