"use client";
import { useState } from "react";
import {
  Mail,
  Cloud,
  Download,
  Check,
  LogOut,
  RefreshCw,
  Flame,
} from "lucide-react";
import { useLibrary } from "@/components/provider";
import { supabase } from "@/lib/supabase";
export default function Settings() {
  const { library, update, user, sync, setMessage } = useLibrary();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + "/" },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO, NO SEU TEMPO</span>
          <h1>
            Seu espaço, suas escolhas<span className="accent">.</span>
          </h1>
          <p>Um pouco de ajuste para uma experiência só sua.</p>
        </div>
      </div>
      <section className="settings-panel panel">
        <div className="setting-heading">
          <Cloud />
          <div>
            <h2>Sua conta</h2>
            <p>Leve sua biblioteca do computador para o celular.</p>
          </div>
        </div>
        {user ? (
          <>
            <p className="account-email">
              <Check size={17} /> Conectado como {user.email}
            </p>
            <div className="button-row">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await sync();
                  setBusy(false);
                }}
              >
                <RefreshCw size={17} /> Sincronizar agora
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  await supabase?.auth.signOut();
                  setMessage(
                    "Você saiu da conta. Os dados da conta continuam salvos separadamente.",
                  );
                }}
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          </>
        ) : supabase ? (
          <>
            <p className="muted">
              Entre com um link enviado ao seu e-mail. Sem senha.
            </p>
            <form className="login-form" onSubmit={login}>
              <label>
                <Mail size={18} />
                <input
                  required
                  type="email"
                  placeholder="Seu e-mail"
                  aria-label="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button disabled={busy} className="primary-button">
                {busy ? "Enviando…" : "Enviar link de acesso"}
              </button>
            </form>
            {sent && (
              <p className="success" role="status">
                Link enviado. Confira sua caixa de entrada e a pasta de spam.
              </p>
            )}
            <p className="muted small-note">
              Os dados locais ficam separados dos dados da conta. Exporte sua
              biblioteca antes de entrar se quiser guardar uma cópia.
            </p>
          </>
        ) : (
          <p className="muted">
            Modo local com IndexedDB ativo. Para sincronizar, preencha
            NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY e execute a
            migração.
          </p>
        )}
      </section>
      <section className="settings-panel panel">
        <div className="setting-heading">
          <Flame />
          <div>
            <h2>Um hábito que cabe no seu dia</h2>
            <p>Defina quantos minutos fazem um dia ativo.</p>
          </div>
        </div>
        <label className="setting-row">
          <span>Meta diária de escuta</span>
          <select
            value={library.settings.dailyGoal}
            onChange={(e) =>
              update((s) => ({
                ...s,
                settings: { ...s.settings, dailyGoal: Number(e.target.value) },
              }))
            }
          >
            {[1, 5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n * 60}>
                {n} minutos
              </option>
            ))}
          </select>
        </label>
        <p className="muted small-note">
          A sequência usa o fuso America/Manaus. Alterar a meta recalcula os
          dias anteriores.
        </p>
      </section>
      <section className="settings-panel panel">
        <div className="setting-heading">
          <Download />
          <div>
            <h2>Sempre por perto</h2>
            <p>Instale o Podfiy no seu Android.</p>
          </div>
        </div>
        <p className="muted">
          Abra este site no Chrome, toque no menu ⋮ e escolha “Adicionar à tela
          inicial” → “Instalar”. Após iniciar a reprodução, os controles ficam
          disponíveis na tela bloqueada.
        </p>
        <p className="muted small-note">
          Os áudios são transmitidos dos servidores originais e precisam de
          conexão.
        </p>
      </section>
      <section className="settings-panel panel">
        <h2>Seus dados são seus</h2>
        <p className="muted">
          Salvos neste navegador e sincronizados quando você entra na conta.
        </p>
        <button
          className="secondary-button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(library, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "podfiy-biblioteca.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={16} /> Exportar biblioteca
        </button>
      </section>
    </div>
  );
}
