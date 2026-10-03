export class AccountRequestError extends Error {
    constructor(message, { status = 0, code = "", data = null } = {}) {
        super(message);
        this.name = "AccountRequestError";
        this.status = status;
        this.code = code;
        this.data = data;
    }
}

/** An expired or replaced cookie already finished sign-out for this identity. */
export const accountLogoutComplete = failure => failure?.status === 401
    || failure?.status === 409 && failure?.code === "ACCOUNT_SCOPE_CHANGED";

export async function accountRequest(path, { method = "GET", body, signal, accountId, fetcher = fetch } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
        const response = await fetcher(`/api/account/${path}`, {
            method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
            headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(accountId ? { "x-myowndex-account": accountId } : {}) },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
        if (!response.ok) throw new AccountRequestError(data?.error || "Não foi possível acessar sua conta. Tente novamente.", {
            status: response.status, code: data?.code || "", data,
        });
        if (!data) throw new AccountRequestError("A conta enviou uma resposta incompleta. Tente novamente.");
        return data;
    } catch (error) {
        if (error?.name === "AbortError") throw new AccountRequestError("A conexão demorou. Seus dados locais continuam disponíveis.");
        if (error instanceof TypeError) throw new AccountRequestError("Sem conexão com a conta. Seus dados continuam neste dispositivo.");
        throw error;
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
    }
}
