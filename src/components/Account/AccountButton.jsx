import React from "react";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";

export const ACCOUNT_STATUS_LABELS = Object.freeze({
    local: "Neste dispositivo", saved: "Conta atualizada", pending: "Alterações aguardando envio",
    syncing: "Sincronizando", offline: "Disponível offline", error: "Sincronização pendente",
});

export default function AccountButton({ client, onClick }) {
    const label = client.account ? `Conta de ${client.account.displayName || client.account.username}` : "Entrar ou criar conta";
    return <button type="button" className="account-header-button" onClick={onClick} aria-label={label} title={client.account ? ACCOUNT_STATUS_LABELS[client.status] : label}>
        <PokemonCompanion place="account" eager />
        <span>Cartão do Treinador</span>
        {client.account && <i className={`account-connection is-${client.status}`} aria-hidden="true" />}
    </button>;
}
