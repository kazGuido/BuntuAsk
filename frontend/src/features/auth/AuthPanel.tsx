import { FormEvent, useState } from "react";

import { API_PREFIX } from "../../lib/api";
import { User } from "../../types";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export function AuthPanel({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            username_or_email: String(form.get("username_or_email")),
            password: String(form.get("password")),
          }
        : {
            username: String(form.get("username")),
            email: String(form.get("email")),
            whatsapp_number: String(form.get("whatsapp_number")),
            password: String(form.get("password")),
          };

    try {
      const response = await fetch(`${API_PREFIX}/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58cc02] text-2xl font-black text-white">B</div>
          <div>
            <h1 className="text-2xl font-black text-[#3c3c3c] sm:text-3xl">BuntuAsk</h1>
            <p className="text-sm font-bold uppercase tracking-wider text-gray-400">Translate. Review. Earn.</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={mode === item ? "rounded-xl bg-white px-3 py-2 text-sm font-black uppercase text-[#1cb0f6] shadow" : "rounded-xl px-3 py-2 text-sm font-black uppercase text-gray-400"}
            >
              {item}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" ? (
            <>
              <Input name="username" placeholder="Username" required />
              <Input name="email" placeholder="Email" type="email" required />
              <Input name="whatsapp_number" placeholder="WhatsApp number" required />
            </>
          ) : (
            <Input name="username_or_email" placeholder="Username or email" required />
          )}
          <Input name="password" placeholder="Password" type="password" minLength={8} required />
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
          <Button disabled={loading} className="w-full border-[#1899d6] bg-[#1cb0f6] text-white">
            {loading ? "Working..." : mode === "login" ? "Enter" : "Create annotator account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
