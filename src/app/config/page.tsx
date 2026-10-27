"use client";
import { useEffect, useRef, useState } from "react";
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
import {
  MAX_BACKUP_BYTES,
  parseBackup,
  mergeBackup,
  serializeBackup,
} from "@/lib/backup";
import type { Library } from "@/lib/types";
export default function Settings() {
  const { library, update, user, sync, setMessage, ready } = useLibrary();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [backup, setBackup] = useState<Library | null>(null);
  const [backupError, setBackupError] = useState("");
  const [readingBackup, setReadingBackup] = useState(false);
  const importGeneration = useRef(0);
  useEffect(() => {
    importGeneration.current++;
    setBackup(null);
    setBackupError("");
    setReadingBackup(false);
    return () => {
      importGeneration.current++;
    };
  }, [user?.id, ready]);
  async function chooseBackup(file: File | undefined) {
    if (!file || !ready) return;
    const ticket = ++importGeneration.current;
    setReadingBackup(true);
    setBackup(null);
    setBackupError("");
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("O backup deve ter até 10 MB.");
      const parsed = parseBackup(await file.text());
      if (ticket === importGeneration.current) setBackup(parsed);
    } catch (error) {
      if (ticket === importGeneration.current)
        setBackupError((error as Error).message);
    } finally {
      if (ticket === importGeneration.current) setReadingBackup(false);
    }
  }
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
          disabled={!ready}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([serializeBackup(library)], {
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
        <div className="backup-import">
          <label htmlFor="backup-file">Importar backup do Podfiy</label>
          <input
            id="backup-file"
            type="file"
            accept=".json,application/json"
            disabled={!ready || readingBackup}
            onChange={(event) => {
              void chooseBackup(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <p className="muted small-note">
            Adiciona os itens do backup à biblioteca atual, preserva o progresso
            mais recente e aplica as preferências do arquivo. Aceita backups
            antigos. Até 10 MB.
          </p>
          {readingBackup && <p role="status">Verificando backup…</p>}
          {backupError && (
            <p className="error" role="alert">
              {backupError}
            </p>
          )}
          {backup && (
            <div className="backup-preview" role="status">
              <p>
                {backup.subscriptions.length} assinaturas ·{" "}
                {backup.favorites.length} favoritos · {backup.queue.length}{" "}
                episódios na fila · {backup.sessions.length} sessões de escuta.
              </p>
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={!ready}
                  onClick={() => {
                    update((current) => mergeBackup(current, backup));
                    setBackup(null);
                    setMessage("Backup incorporado à biblioteca.");
                  }}
                >
                  Importar para esta biblioteca
                </button>
                <button className="text-button" onClick={() => setBackup(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
