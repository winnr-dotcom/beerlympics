import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { updateContestantProfile, uploadAvatar } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate({ to: "/login" });
    return null;
  }

  const [nickname, setNickname] = useState(user.nickname ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = user.nickname ?? user.fullName;
  const initial = (user.nickname ?? user.fullName).charAt(0).toUpperCase();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const { error } = await updateContestantProfile(user.id, { photo_url: url });
      if (error) throw error;
      setPhotoUrl(url);
      setUser({ ...user, photo_url: url });
      toast.success("Photo updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed — please try another image.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = ""; // allow re-picking the same file
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await updateContestantProfile(user.id, {
        nickname: nickname.trim() || undefined,
      });
      if (error) throw error;
      setUser({ ...user, nickname: nickname.trim() || null, photo_url: photoUrl });
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = photoUrl;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" className="text-zinc-400 hover:text-white text-sm">← Leaderboard</Link>
        </div>

        <h1 className="mb-8 text-2xl font-black text-amber-400">Your Profile</h1>

        {/* Avatar */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="h-28 w-28 rounded-full object-cover border-2 border-amber-500"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-4xl font-black text-amber-400">
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {uploading ? "..." : "📷"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <p className="text-sm text-zinc-400">{user.fullName}</p>
        </div>

        {/* Nickname */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-zinc-300">Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={user.fullName}
            maxLength={20}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">Shown instead of your real name on the leaderboard</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-amber-500 py-3 font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        <button
          onClick={() => { logout(); navigate({ to: "/" }); }}
          className="mt-4 w-full rounded-lg border border-zinc-700 py-3 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
