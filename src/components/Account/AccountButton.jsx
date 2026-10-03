import React from "react";

export const ACCOUNT_STATUS_LABELS = Object.freeze({
    local: "Neste dispositivo", saved: "Conta atualizada", pending: "Alterações aguardando envio",
    syncing: "Sincronizando", offline: "Disponível offline", error: "Sincronização pendente",
});

export default function AccountButton({ client, onClick }) {
    const label = client.account ? `Conta de ${client.account.displayName || client.account.username}` : "Entrar ou criar conta";
    return <button type="button" className="account-header-button" onClick={onClick} aria-label={label} title={client.account ? ACCOUNT_STATUS_LABELS[client.status] : label}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="9" cy="9" r="2" /><path d="M5 17v-1a4 4 0 0 1 8 0v1M15 8h3M15 12h3M15 16h3" /></svg>
        <span>Conta</span>
        {client.account && <i className={`account-connection is-${client.status}`} aria-hidden="true" />}
    </button>;
}
