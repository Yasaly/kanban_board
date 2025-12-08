import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "/api";

const WS_URL = /*адресс для веб-сокетов*/
    (import.meta as any).env?.VITE_WS_URL ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${
        window.location.host
    }/ws`;

type Column = {
    id: number;
    title: string;
    orderIndex: number;
};

type Card = {
    id: number;
    columnId: number;
    title: string;
    description: string | null;
    orderIndex: number;
    ownerId: number | null;
    createdAt: string;
    updatedAt: string;
};

type BoardResponse = {
    columns: Column[];
    cards: Card[];
};

type NewCardForm = {
    title: string;
    description: string;
    loading: boolean;
};

type NewCardFormState = Record<number, NewCardForm>;

type Role = "user" | "admin";

type AuthUser = {
    id: number;
    email: string;
    role: Role;
};

type AuthState = {
    token: string;
    user: AuthUser;
};

type OpenFormState = Record<number, boolean>;  /*открыта ли форма добавления задачи для каждой колонки*/

type EditCardForm = {
    title: string;
    description: string;
    loading: boolean;
};

type LoginFormProps = {
    onLogin: (email: string, password: string) => Promise<void>;
    onRegister: (email: string, password: string) => Promise<void>;
};

function LoginForm({ onLogin, onRegister }: LoginFormProps) {
    const [email, setEmail] = useState("admin@example.com");
    const [password, setPassword] = useState("admin123");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"login" | "register">("login");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault(); /*не дает браузеру перезагрузить страницу*/
        setError(null);
        setLoading(true); /*отчистка прошлой ошибки*/
        try {
            if (mode === "login") { /*вход либо регистрация*/
                await onLogin(email, password);
            } else {
                await onRegister(email, password);
            }
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Ошибка. Попробуйте ещё раз.";
            setError(msg);
        } finally {
            setLoading(false); /*снимаем флаг загрузки*/
        }
    }

    /*регистрация*/
    return (
        <div className="app-root">
            <h1 className="app-title">
                {mode === "login" ? "Вход в Kanban-доску" : "Регистрация в Kanban-доске"}
            </h1>
            <div className="app-subtitle">
                {mode === "login"
                    ? "Введите email и пароль."
                    : "Создайте новый аккаунт. Пароль не короче 6 символов."}
            </div>

            {error && (
                <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 14 }}>
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                style={{
                    maxWidth: 360,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
                />
                <button
                    type="submit"
                    style={{
                        borderRadius: 6,
                        border: "none",
                        padding: "8px 10px",
                        background: "#2563eb",
                        color: "white",
                        fontSize: 14,
                        cursor: "pointer",
                    }}
                    disabled={loading}
                >
                    {loading
                        ? mode === "login"
                            ? "Вход..."
                            : "Регистрация..."
                        : mode === "login"
                            ? "Войти"
                            : "Зарегистрироваться"}
                </button>
            </form>

            <div style={{ marginTop: 12, fontSize: 14 }}>
                {mode === "login" ? (
                    <>
                        Нет аккаунта?{" "}
                        <button
                            type="button"
                            onClick={() => {
                                setMode("register");
                                setError(null);
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                color: "#2563eb",
                                cursor: "pointer",
                                textDecoration: "underline",
                            }}
                        >
                            Зарегистрироваться
                        </button>
                    </>
                ) : (
                    <>
                        Уже есть аккаунт?{" "}
                        <button
                            type="button"
                            onClick={() => {
                                setMode("login");
                                setError(null);
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                color: "#2563eb",
                                cursor: "pointer",
                                textDecoration: "underline",
                            }}
                        >
                            Войти
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function App() {
    const [auth, setAuth] = useState<AuthState | null>(null); /*храним авторизацию*/
    const [board, setBoard] = useState<BoardResponse | null>(null); /*подгружаем доску*/
    const [error, setError] = useState<string | null>(null); /*ошибка сверху*/

    const [formState, setFormState] = useState<NewCardFormState>({}); /*состояние форм, создание для каждого columnId*/
    const [openFormColumns, setOpenFormColumns] = useState<OpenFormState>({}); /*открыта ли форма создания в конкретной колонке*/

    const [draggedCardId, setDraggedCardId] = useState<number | null>(null); /*какую карточку сейчас перемещаем*/
    const [dragOverColumnId, setDragOverColumnId] = useState<number | null>(null); /*на какой колонке сейчас курсор с этой картой*/

    const [editingCardId, setEditingCardId] = useState<number | null>(null); /*редактирование карточки*/
    const [editForm, setEditForm] = useState<EditCardForm>({ /*текущее значение полей форм и флаг загрузки*/
        title: "",
        description: "",
        loading: false,
    });

    useEffect(() => { /*чтобы при перезагрзуке страницы пользователь оставался в системе, пока токен жив (7дней)*/
        const stored = localStorage.getItem("auth");
        if (stored) { /*читаем Auth из localstorage*/
            try {
                const parsed: AuthState = JSON.parse(stored); /*парсинг*/
                setAuth(parsed); /*устанавливаем Auth*/
            } catch {
                localStorage.removeItem("auth"); /*удаляем ключ*/
            }
        }
    }, []);

    async function apiFetch(path: string, init: RequestInit = {}) {
        if (!auth) {
            throw new Error("Not authenticated");
        }

        const headers: HeadersInit = { /*добавляем заголовок с токеном*/
            ...(init.headers || {}),
            Authorization: `Bearer ${auth.token}`,
        };

        const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

        if (res.status === 401) { /*если не смогли достучаться до бека*/
            handleLogout(false);
            throw new Error("Сессия истекла, войдите снова.");
        }

        return res;
    }

    async function handleLogin(email: string, password: string) {
        const res = await fetch(`${API_BASE}/auth/login`, { /*отправляем пост-запрос*/
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) { /*если ошибка*/
            let message = "Ошибка входа";
            try {
                const data = await res.json();
                if (data?.error) message = data.error;
            } catch {}
            throw new Error(message);
        }

        /*если успех*/

        const data = await res.json();

        const newAuth: AuthState = {
            token: data.token,
            user: data.user,
        };

        setAuth(newAuth);
        localStorage.setItem("auth", JSON.stringify(newAuth));
    }

    async function handleRegister(email: string, password: string) {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            let message = "Ошибка регистрации";
            try {
                const data = await res.json();
                if (data?.error) message = data.error;
            } catch {}
            throw new Error(message);
        }

        const data = await res.json();

        const newAuth: AuthState = {
            token: data.token,
            user: data.user,
        };

        setAuth(newAuth);
        localStorage.setItem("auth", JSON.stringify(newAuth));
    }

    function handleLogout(clearMessage = true) { /*полный выход*/
        setAuth(null);  /*убираем пользователя*/
        setBoard(null); /*убираем доску*/
        localStorage.removeItem("auth"); /*записи из локалсторадж*/
        if (clearMessage) setError(null);
    }

    useEffect(() => { /*загрузка доски при появлении auth*/
        if (!auth) return;
        loadBoard(); /*загружаем доску при входе*/
    }, [auth]);

    async function loadBoard() { /*гет-запрос к апи/боард*/
        try {
            setError(null);
            const res = await apiFetch("/board");
            if (!res.ok) {
                const text = await res.text();
                console.error("Load board failed:", res.status, text);
                throw new Error("Failed");
            }
            /*если все хорошо, то парсим джсон и сохраняем доску*/
            const data = (await res.json()) as BoardResponse;
            setBoard(data);
        } catch (e) {
            console.error(e);
            setError("Не удалось загрузить доску");
        }
    }

    useEffect(() => { /*подключение веб-сокета*/
        if (!auth) return;

        /*если авторизирован*/
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WS connected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data?.type === "board_changed") {
                    loadBoard();
                }
            } catch {}
        };

        ws.onclose = () => {
            console.log("WS disconnected");
        };

        ws.onerror = (e) => {
            console.log("WS error", e);
        };

        return () => {
            ws.close();
        };
    }, [auth]);

    const cardsByColumn = useMemo(() => { /*группировка карточек по колонкам; юзмемо, чтобы не пересчитывать доску каждый рендер, если доска не менялась*/
        const map: Record<number, Card[]> = {};
        if (!board) return map;

        for (const col of board.columns) {
            map[col.id] = [];
        }

        for (const card of board.cards) {
            if (!map[card.columnId]) {
                map[card.columnId] = [];
            }
            map[card.columnId].push(card);
        }

        return map;
    }, [board]);

    /*обновляет часть состояния формы конкретной колонки. Если формы еще не было - создает дефолтную*/
    function updateForm(columnId: number, patch: Partial<NewCardForm>) {
        setFormState((prev) => ({
            ...prev,
            [columnId]: {
                ...(prev[columnId] ?? { title: "", description: "", loading: false }),
                ...patch,
            },
        }));
    }

    /*открыть или закрыть форму создания в колонке*/
    function toggleForm(columnId: number, open?: boolean) {
        setOpenFormColumns((prev) => ({
            ...prev,
            [columnId]: open ?? !prev[columnId],
        }));
    }

    /*берем состояние формы для колонки. Если заголовок пустой - ничего не делаем*/
    async function handleAddCard(columnId: number) {
        if (!auth) return;

        const state: NewCardForm =
            formState[columnId] ?? { title: "", description: "", loading: false };

        if (!state.title.trim()) return;

        /*отправляем ПОСТ-запрос с созданием карты*/
        updateForm(columnId, { loading: true });

        try {
            const res = await apiFetch("/cards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    columnId,
                    title: state.title.trim(),
                    description:
                        state.description.trim() === "" ? null : state.description.trim(),
                }),
            });

            if (!res.ok) {
                console.error(await res.text());
                throw new Error("Failed to create card");
            }

            await loadBoard();
            updateForm(columnId, { title: "", description: "", loading: false });
            toggleForm(columnId, false);
        } catch (e) {
            console.error(e);
            setError("Не удалось создать карточку");
            updateForm(columnId, { loading: false });
        }
    }

    /*удаление карточки. Отправляется ДЕЛЕТ-запрос на апи/кардс/:ид*/
    async function handleDeleteCard(cardId: number) {
        if (!auth || !board) return;

        const ok = window.confirm("Удалить эту задачу?");
        if (!ok) return;

        try {
            const res = await apiFetch(`/cards/${cardId}`, {
                method: "DELETE",
            });

            /*Сработала проверка ролей на беке*/
            if (res.status === 403) {
                setError("Вы можете удалять только свои задачи (или вы не админ).");
                return;
            }

            if (!res.ok) {
                console.error(await res.text());
                throw new Error("Failed to delete card");
            }

            /*в случае успеха*/
            await loadBoard();
        } catch (e) {
            console.error(e);
            setError("Не удалось удалить карточку");
        }
    }

    /*переводи карточку в режим редактирования и подставляем текущие значение*/
    function startEditCard(card: Card) {
        setEditingCardId(card.id);
        setEditForm({
            title: card.title,
            description: card.description ?? "",
            loading: false,
        });
    }

    /*отмена редактирования*/
    function cancelEdit() {
        setEditingCardId(null);
        setEditForm({ title: "", description: "", loading: false });
    }

    /*отправляем петч апи/кардс/:ид*/
    async function handleUpdateCard(cardId: number) {
        if (!auth) return;
        if (!editForm.title.trim()) return;

        setEditForm((prev) => ({ ...prev, loading: true }));

        try {
            const res = await apiFetch(`/cards/${cardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editForm.title.trim(),
                    description:
                        editForm.description.trim() === ""
                            ? null
                            : editForm.description.trim(),
                }),
            });

            if (res.status === 403) {
                setError("Вы можете редактировать только свои задачи (или вы не админ).");
                setEditForm((prev) => ({ ...prev, loading: false }));
                return;
            }

            if (!res.ok) {
                console.error(await res.text());
                throw new Error("Failed to update card");
            }

            /*в случае успеха*/
            await loadBoard();
            cancelEdit();
        } catch (e) {
            console.error(e);
            setError("Не удалось обновить карточку");
            setEditForm((prev) => ({ ...prev, loading: false }));
        }
    }

    /*не даем перетаскивать, если что-то редактируется*/
    function handleDragStart(cardId: number) {
        if (editingCardId !== null) return;
        setDraggedCardId(cardId);
    }

    /*сбрасываем состояние после перетаскивания*/
    function handleDragEnd() {
        setDraggedCardId(null);
        setDragOverColumnId(null);
    }

    function handleDragOverColumn(
        columnId: number,
        evt: React.DragEvent<HTMLDivElement>
    ) {
        evt.preventDefault();   /*разрешение на дроп; сохраняем, над какой колонкой сейчас курсор*/
        setDragOverColumnId(columnId);
    }

    /*если не нашли карточку, или колонка та же, то сбрасываем и выходим*/
    async function handleDropOnColumn(columnId: number) {
        if (!board || draggedCardId === null || !auth) return;

        const card = board.cards.find((c) => c.id === draggedCardId);
        if (!card) return;

        if (card.columnId === columnId) {
            handleDragEnd();
            return;
        }

        /*обновление фронта в случае успеха. Сразу двигаем карточку визуально, не ожиидая ответа сервера*/
        const updatedCard: Card = { ...card, columnId };
        const newCards = board.cards.map((c) =>
            c.id === updatedCard.id ? updatedCard : c
        );
        setBoard({ ...board, cards: newCards });

        setDraggedCardId(null);
        setDragOverColumnId(null);

        try {
            /*Отправляем на бек петч только с колумнИд*/
            const res = await apiFetch(`/cards/${card.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ columnId }),
            });

            if (!res.ok) {
                console.error(await res.text());
                throw new Error("Failed to move card");
            }

            /*Если не удалось, то двигаем обратно с помощью повтороной загрузки*/
            await loadBoard();
        } catch (e) {
            console.error(e);
            setError("Не удалось переместить карточку");
            await loadBoard();
        }
    }

    /*Если пользователь не авторизован, то только рендер страницы входа*/
    if (!auth) {
        return <LoginForm onLogin={handleLogin} onRegister={handleRegister} />;
    }

    /*Если есть ошибка, и доска еще не загружена, то показывает ошибку и шапку.*/
    /*Если ошибки нет, и доска не загружена - показываем текст о загрузке строки*/
    if (error && !board) {
        return (
            /*Заргузка доски*/
            <div className="app-root">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <h1 className="app-title">Kanban доска</h1>
                    <div>
                        {auth.user.email} ({auth.user.role})
                        <button
                            onClick={() => handleLogout()}
                            style={{ marginLeft: 8, cursor: "pointer" }}
                        >
                            Выйти
                        </button>
                    </div>
                </div>
                {error}
            </div>
        );
    }

    if (!board) {
        return (
            <div className="app-root">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <h1 className="app-title">Kanban доска</h1>
                    <div>
                        {auth.user.email} ({auth.user.role})
                        <button
                            onClick={() => handleLogout()}
                            style={{ marginLeft: 8, cursor: "pointer" }}
                        >
                            Выйти
                        </button>
                    </div>
                </div>
                Загрузка доски...
            </div>
        );
    }

    return (
        <div className="app-root">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                }}
            >
                <h1 className="app-title">Kanban доска</h1>
                <div style={{ fontSize: 14 }}>
          <span>
            {auth.user.email} (
              {auth.user.role === "admin" ? "Админ" : "Пользователь"})
          </span>
                    <button
                        onClick={() => handleLogout()}
                        style={{
                            marginLeft: 8,
                            cursor: "pointer",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            padding: "4px 8px",
                        }}
                    >
                        Выйти
                    </button>
                </div>
            </div>

            <div className="app-subtitle">
                Перетаскивайте задачи между колонками. Новые задачи добавляются по
                кнопке <b>+</b>. Удаление — по крестику, редактирование — по иконке ✏.
            </div>

            {error && (
                <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 14 }}>
                    {error}
                </div>
            )}

            <div className="board">
                {board.columns.map((column) => {
                    const cards = cardsByColumn[column.id] || [];
                    const form: NewCardForm =
                        formState[column.id] ?? {
                            title: "",
                            description: "",
                            loading: false,
                        };

                    const isDragOver = dragOverColumnId === column.id;
                    const isFormOpen = !!openFormColumns[column.id];

                    return (
                        <div
                            key={column.id}
                            className={`column ${isDragOver ? "drag-over" : ""}`}
                            onDragOver={(e) => handleDragOverColumn(column.id, e)}
                            onDrop={() => handleDropOnColumn(column.id)}
                        >
                            <div className="column-header">
                                <span className="column-title">{column.title}</span>
                                <span className="column-count">{cards.length}</span>
                                <button
                                    className="column-add-btn"
                                    type="button"
                                    onClick={() => toggleForm(column.id)}
                                    disabled={form.loading}
                                    title="Добавить задачу"
                                >
                                    +
                                </button>
                            </div>

                            <div className="cards">
                                {cards.length === 0 && (
                                    <div className="card" style={{ opacity: 0.6 }}>
                                        Нет задач
                                    </div>
                                )}
                                {cards.map((card) => {
                                    const isDragging = draggedCardId === card.id;
                                    const isEditing = editingCardId === card.id;

                                    if (isEditing) {
                                        return (
                                            <div key={card.id} className="card editing">
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(e) =>
                                                        setEditForm((prev) => ({
                                                            ...prev,
                                                            title: e.target.value,
                                                        }))
                                                    }
                                                    style={{ width: "100%", marginBottom: 4 }}
                                                />
                                                <textarea
                                                    rows={2}
                                                    value={editForm.description}
                                                    onChange={(e) =>
                                                        setEditForm((prev) => ({
                                                            ...prev,
                                                            description: e.target.value,
                                                        }))
                                                    }
                                                    style={{ width: "100%", marginBottom: 4 }}
                                                />
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "flex-end",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        className="add-card-cancel"
                                                    >
                                                        Отмена
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateCard(card.id)}
                                                        className="add-card-submit"
                                                        disabled={
                                                            editForm.loading || !editForm.title.trim()
                                                        }
                                                    >
                                                        {editForm.loading
                                                            ? "Сохранение..."
                                                            : "Сохранить"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={card.id}
                                            className={`card ${isDragging ? "dragging" : ""}`}
                                            draggable={editingCardId === null}
                                            onDragStart={() => handleDragStart(card.id)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    marginBottom: card.description ? 4 : 0,
                                                    gap: 4,
                                                }}
                                            >
                                                <div className="card-title">{card.title}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditCard(card)}
                                                    style={{
                                                        marginLeft: "auto",
                                                        border: "none",
                                                        background: "transparent",
                                                        cursor: "pointer",
                                                        fontSize: 14,
                                                    }}
                                                    title="Редактировать задачу"
                                                >
                                                    ✏
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteCard(card.id)}
                                                    style={{
                                                        border: "none",
                                                        background: "transparent",
                                                        cursor: "pointer",
                                                        fontSize: 16,
                                                        lineHeight: 1,
                                                    }}
                                                    title="Удалить задачу"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            {card.description && (
                                                <div className="card-description">
                                                    {card.description}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {isFormOpen && (
                                <form
                                    className="add-card-form"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleAddCard(column.id);
                                    }}
                                >
                                    <input
                                        type="text"
                                        placeholder="Название задачи"
                                        value={form.title}
                                        onChange={(e) =>
                                            updateForm(column.id, { title: e.target.value })
                                        }
                                    />
                                    <textarea
                                        placeholder="Описание (необязательно)"
                                        rows={2}
                                        value={form.description}
                                        onChange={(e) =>
                                            updateForm(column.id, { description: e.target.value })
                                        }
                                    />
                                    <div className="add-card-actions">
                                        <button
                                            type="button"
                                            className="add-card-cancel"
                                            onClick={() => {
                                                toggleForm(column.id, false);
                                                updateForm(column.id, {
                                                    title: "",
                                                    description: "",
                                                    loading: false,
                                                });
                                            }}
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="submit"
                                            className="add-card-submit"
                                            disabled={form.loading || !form.title.trim()}
                                        >
                                            {form.loading ? "Добавление..." : "Добавить"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default App;
