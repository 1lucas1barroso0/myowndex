import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACCOUNT_STATUS_LABELS } from "./AccountButton.jsx";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";

const download = (value, fileName, type = "application/json") => {
    const url = URL.createObjectURL(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function AccountModal({ open, onClose, client }) {
    const [page, setPage] = useState("login");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [formError, setFormError] = useState("");
    const [codes, setCodes] = useState([]);
    const [codesOwner, setCodesOwner] = useState("");
    const [codesAccountId, setCodesAccountId] = useState("");
    const [importDevice, setImportDevice] = useState(false);
    const [passwordForm, setPasswordForm] = useState(false);
    const [eraseChoice, setEraseChoice] = useState("");
    const [removeDeviceCopy, setRemoveDeviceCopy] = useState(false);
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const errorRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const busyRef = useRef(false);
    const titleId = useId();
    const errorId = useId();

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => {
        if (open && formError) errorRef.current?.focus();
    }, [open, formError]);
    const refreshDeviceCopies = client.refreshDeviceCopies;
    useEffect(() => {
        if (open) void refreshDeviceCopies().catch(() => {});
    }, [open, refreshDeviceCopies]);
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const dialog = dialogRef.current;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const siblings = new Map();
        const protectBackground = () => {
            for (const element of document.body.children) {
                if (!(element instanceof HTMLElement) || element.contains(dialog)
                    || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) continue;
                if (!siblings.has(element)) siblings.set(element, element.inert);
                element.inert = true;
            }
        };
        protectBackground();
        // Signing in briefly replaces the guest app with the account app.
        // Newly mounted background controls must stay outside this modal.
        const backgroundObserver = new MutationObserver(protectBackground);
        backgroundObserver.observe(document.body, { childList: true });
        const keydown = event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (!busyRef.current) onCloseRef.current(); return; }
            if (event.key !== "Tab") return;
            const elements = [...dialogRef.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]') || []].filter(element => {
                const closed = element.closest("details:not([open])");
                return element.getClientRects().length && getComputedStyle(element).visibility !== "hidden"
                    && (!closed || closed.querySelector(":scope > summary")?.contains(element));
            });
            const first = elements[0]; const last = elements.at(-1);
            if (!first) { event.preventDefault(); dialogRef.current?.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener("keydown", keydown, true);
        const frame = requestAnimationFrame(() => closeRef.current?.focus());
        return () => {
            cancelAnimationFrame(frame); document.removeEventListener("keydown", keydown, true);
            backgroundObserver.disconnect();
            document.body.style.overflow = overflow;
            for (const [element, original] of siblings) element.inert = original;
            const returnTarget = previous?.isConnected && previous.tabIndex >= 0 ? previous
                : [...document.querySelectorAll(".account-header-button")].find(button => button.getClientRects().length && !button.closest("[inert]"));
            returnTarget?.focus?.({ preventScroll: true });
            dialog?.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
        };
    }, [open]);

    const run = async action => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true); setFormError(""); setMessage("");
        try { await action(); }
        catch (failure) { setFormError(failure.message || "Não foi possível concluir. Tente novamente."); }
        finally { busyRef.current = false; setBusy(false); }
    };
    const keepCodes = result => {
        if (result.recoveryCodes?.length) {
            setCodes(result.recoveryCodes);
            setCodesOwner(result.account?.username || client.account?.username || "");
            setCodesAccountId(result.account?.id || client.account?.id || "");
        } else { setCodes([]); setCodesOwner(""); setCodesAccountId(""); }
    };
    const authenticate = event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const input = { username: String(fields.get("username") || "").trim(), ...(page === "recover"
            ? { recoveryCode: String(fields.get("recoveryCode") || "").trim(), newPassword: String(fields.get("newPassword") || "") }
            : { password: String(fields.get("password") || ""), ...(page === "signup" ? { displayName: String(fields.get("displayName") || "").trim() } : {}) }) };
        void run(async () => {
            const result = await client[page](input);
            keepCodes(result);
            form.querySelectorAll('input[type="password"]').forEach(field => { field.value = ""; });
            if (importDevice && client.guestAvailable) await client.importGuest();
            setMessage(page === "recover" ? "Senha redefinida. Seus novos códigos estão abaixo." : "Seu MyOwnDex está conectado.");
        });
    };
    const eraseOptions = {
        previous: {
            label: "Cópias anteriores",
            description: "Apaga a versão anterior da nuvem e as cópias recuperadas neste dispositivo. Os dados atuais da conta continuam salvos.",
            action: client.clearPreviousCopies,
            message: "Cópias anteriores apagadas. Seus dados atuais continuam salvos.",
        },
        guest: {
            label: "Dados usados sem conta",
            description: "Apaga as Boxes, favoritos, aventura e rolagens usados sem conta neste dispositivo. Os dados da conta continuam salvos.",
            action: client.clearGuestCopy,
            message: "Dados usados sem conta apagados deste dispositivo.",
        },
        inactive: {
            label: "Cópias de contas desconectadas",
            description: "Apaga as cópias locais das contas que já saíram deste dispositivo. Os dados dessas contas na nuvem continuam salvos.",
            action: client.clearInactiveCopies,
            message: "Cópias de contas desconectadas apagadas deste dispositivo.",
        },
    };

    if (!open || typeof document === "undefined") return null;
    return createPortal(<div className="account-overlay" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
        <section className="account-dialog" ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
            <header className="account-dialog-heading">
                <div className="account-dialog-title"><h2 id={titleId}>Cartão de Treinador</h2></div>
                <PokemonCompanion place="account" className="companion-compact" eager />
                <button type="button" ref={closeRef} className="account-close" aria-label="Fechar conta" disabled={busy} onClick={onClose}>×</button>
            </header>
            <div className="account-dialog-content">
                {(formError || client.error) && <p ref={errorRef} tabIndex={-1} className="account-error" role="alert" id={errorId}>{formError || client.error}</p>}
                {message && <p className="account-message" role="status">{message}</p>}
                {client.account ? <>
                    <div className="account-trainer-card">
                        <svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="32" cy="21" r="9" /><path d="M15 51v-5a17 17 0 0 1 34 0v5M12 55h40M23 12l-4-3M41 12l4-3" /></svg>
                        <div><h3>{client.account.displayName || client.account.username}</h3><p>@{client.account.username}</p><span className={`account-sync-label is-${client.status}`} role="status">{ACCOUNT_STATUS_LABELS[client.status]}</span></div>
                    </div>
                    <p className="account-intro">Seu PC, favoritos, aventuras, rolagens e Pokémon gerados acompanham esta conta em outros dispositivos.</p>
                    {client.updatedAt && <p className="account-last-saved">Última sincronização: <time dateTime={client.updatedAt}>{new Date(client.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></p>}
                    <div className="account-actions">
                        <button type="button" disabled={busy || client.status === "syncing"} onClick={() => void run(async () => { const saved = await client.syncNow(); if (saved) setMessage("Conta atualizada."); })}>Sincronizar agora</button>
                        <button type="button" disabled={busy} onClick={() => void run(async () => download(await client.exportAccount(), `myowndex-${client.account.username}.json`))}>Baixar cópia</button>
                    </div>
                    {client.recoveryCount > 0 && <aside className="account-recovery-notice"><h3>Cópia recuperada</h3><p>Dois dispositivos editaram a mesma aventura ou prévia. Uma versão está ativa; a outra foi preservada para download.</p><button type="button" disabled={busy} onClick={() => void run(async () => download(await client.exportAccount(), `myowndex-dados-recuperados-${client.account.username}.json`))}>Baixar dados recuperados</button></aside>}
                    {client.guestAvailable && <details className="account-disclosure"><summary>Adicionar dados deste dispositivo</summary><p>Adicione suas Boxes, favoritos e rolagens usados sem conta. Aventuras e prévias são copiadas quando a conta ainda não tem uma. A cópia sem conta continua aqui.</p><button type="button" disabled={busy} onClick={() => void run(async () => { await client.importGuest(); setMessage("Dados adicionados. A cópia usada sem conta foi preservada."); })}>Adicionar à conta</button></details>}
                    <details className="account-disclosure" open={passwordForm} onToggle={event => setPasswordForm(event.currentTarget.open)}><summary>Alterar senha</summary>
                        <form aria-describedby={formError || client.error ? errorId : undefined} onSubmit={event => {
                            event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
                            void run(async () => { const result = await client.changePassword({ password: fields.get("password"), newPassword: fields.get("newPassword") }); keepCodes(result); form.reset(); setMessage("Senha alterada. Os códigos anteriores foram substituídos."); });
                        }}>
                            <label>Senha atual<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} /></label>
                            <label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby={`${titleId}-password-help`} disabled={busy} /></label>
                            <p id={`${titleId}-password-help`} className="account-field-help">Use de 10 a 128 caracteres.</p>
                            <button type="submit" disabled={busy}>Salvar nova senha</button>
                        </form>
                    </details>
                    <div className="account-signout"><p>Ao sair, os dados sem conta voltam à tela.</p><label className="account-checkbox"><input type="checkbox" checked={removeDeviceCopy} onChange={event => setRemoveDeviceCopy(event.target.checked)} disabled={busy} />Apagar também a cópia desta conta neste dispositivo.</label>{removeDeviceCopy && <p>Alterações que ainda não chegaram à nuvem também serão apagadas. Baixe uma cópia antes de sair.</p>}<button type="button" disabled={busy} onClick={() => void run(async () => { await client.logout({ removeCopy: removeDeviceCopy }); setCodes([]); setRemoveDeviceCopy(false); setMessage("Você saiu da conta."); })}>Sair da conta</button></div>
                    <details className="account-disclosure is-danger"><summary>Remover conta</summary><p>Apaga cadastro e dados da nuvem. Aventuras compartilhadas e cópias em outros dispositivos continuam separadas. Baixe uma cópia antes de remover.</p><form aria-describedby={formError || client.error ? errorId : undefined} onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void run(async () => { await client.deleteAccount(String(fields.get("password") || ""), { removeCopy: fields.has("removeCopy") }); setCodes([]); setMessage("Conta removida da nuvem."); }); }}><label>Confirme sua senha<input name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} /></label><label className="account-checkbox"><input type="checkbox" name="removeCopy" disabled={busy} />Apagar também a cópia desta conta neste dispositivo.</label><label className="account-checkbox"><input type="checkbox" required disabled={busy} />Quero remover esta conta da nuvem.</label><button type="submit" disabled={busy}>Remover minha conta</button></form></details>
                </> : <>
                    <p className="account-intro">Leve seu PC e sua aventura para outro dispositivo. Seus dados sem conta continuam aqui.</p>
                    <div className="account-pages" role="group" aria-label="Acesso à conta">{[["login", "Entrar"], ["signup", "Criar conta"], ["recover", "Recuperar acesso"]].map(([id, label]) => <button type="button" key={id} aria-pressed={page === id} onClick={() => { setPage(id); setImportDevice(id === "signup"); setFormError(""); setMessage(""); }} disabled={busy}>{label}</button>)}</div>
                    <form className="account-form" key={page} onSubmit={authenticate} aria-describedby={formError || client.error ? errorId : undefined}>
                        <label>Nome de usuário<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern={"[A-Za-z0-9_\\-]{3,32}"} aria-describedby={page === "signup" ? `${titleId}-username-help` : undefined} disabled={busy} /></label>
                        {page === "signup" && <><p id={`${titleId}-username-help`} className="account-field-help">De 3 a 32 letras, números, traços ou sublinhados.</p><label>Nome do Treinador<input name="displayName" autoComplete="nickname" maxLength={48} disabled={busy} /></label></>}
                        {page === "recover" ? <><label>Código de recuperação<input name="recoveryCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={32} aria-describedby={`${titleId}-recovery-help`} disabled={busy} /></label><p id={`${titleId}-recovery-help`} className="account-field-help">Use um dos códigos que você guardou ao criar a conta.</p><label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby={`${titleId}-new-password-help`} disabled={busy} /></label><p id={`${titleId}-new-password-help`} className="account-field-help">Use de 10 a 128 caracteres. Você receberá novos códigos de recuperação.</p></> : <label>Senha<input name="password" type="password" autoComplete={page === "signup" ? "new-password" : "current-password"} required minLength={page === "signup" ? 10 : undefined} maxLength={128} aria-describedby={page === "signup" ? `${titleId}-signup-password-help` : undefined} disabled={busy} /></label>}
                        {page === "signup" && <p id={`${titleId}-signup-password-help`} className="account-field-help">Senha de 10 a 128 caracteres. Guarde os códigos que receber para recuperar o acesso.</p>}
                        {client.guestAvailable && page !== "recover" && <label className="account-checkbox"><input type="checkbox" checked={importDevice} onChange={event => setImportDevice(event.target.checked)} disabled={busy} />Adicionar meus dados deste dispositivo.</label>}
                        <button type="submit" className="account-primary" disabled={busy}>{busy ? "Aguarde…" : page === "login" ? "Entrar na conta" : page === "signup" ? "Criar minha conta" : "Redefinir senha"}</button>
                    </form>
                </>}
                {(client.account || client.deviceCopyCount > 0) && <details className="account-disclosure is-danger account-copy-management"><summary>Cópias e dados</summary>
                    {!eraseChoice ? <div className="account-copy-options">
                        {client.account && <button type="button" disabled={busy} onClick={() => setEraseChoice("previous")}>Apagar cópias anteriores</button>}
                        {client.account && client.guestAvailable && <button type="button" disabled={busy} onClick={() => setEraseChoice("guest")}>Apagar dados usados sem conta</button>}
                        {client.deviceCopyCount > 0 && <button type="button" disabled={busy} onClick={() => setEraseChoice("inactive")}>Apagar cópias de contas desconectadas</button>}
                    </div> : <form key={eraseChoice} onSubmit={event => {
                        event.preventDefault(); const choice = eraseOptions[eraseChoice];
                        void run(async () => { await choice.action(); setEraseChoice(""); setMessage(choice.message); });
                    }}>
                        <p>{eraseOptions[eraseChoice].description}</p>
                        <label className="account-checkbox"><input type="checkbox" required disabled={busy} />Quero apagar {eraseOptions[eraseChoice].label.toLowerCase()}.</label>
                        <div className="account-actions"><button type="submit" disabled={busy}>Apagar</button><button type="button" disabled={busy} onClick={() => setEraseChoice("")}>Cancelar</button></div>
                    </form>}
                </details>}
                {codes.length > 0 && client.account?.id === codesAccountId && <aside className="account-recovery-codes"><h3>Guarde seus códigos de recuperação</h3><p>Cada código pode recuperar seu acesso uma vez. Os códigos ficam visíveis só nesta sessão.</p><ol>{codes.map(code => <li key={code}><code>{code}</code></li>)}</ol><button type="button" onClick={() => download(`MyOwnDex — códigos de recuperação\nConta: ${codesOwner}\n\n${codes.join("\n")}\n\nGuarde em um lugar privado. Cada código pode ser usado uma vez.\n`, `myowndex-recuperacao-${codesOwner}.txt`, "text/plain")}>Baixar códigos</button><button type="button" onClick={() => setCodes([])}>Já guardei os códigos</button></aside>}
            </div>
        </section>
    </div>, document.body);
}
