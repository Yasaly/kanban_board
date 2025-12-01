import { WebSocketServer, WebSocket } from "ws";

export type BoardEvent = {
    type: "board_changed";
};

let wss: WebSocketServer | null = null;

export function attachWebSocketServer(server: any) {
    wss = new WebSocketServer({
        server,
        path: "/ws",
    });

    wss.on("connection", (socket: WebSocket) => {
        console.log("🔌 WS client connected");

        socket.on("close", () => {
            console.log("🔌 WS client disconnected");
        });
    });

    console.log("✅ WebSocket server attached on /ws");
}

export function broadcastBoardChanged() {
    if (!wss) return;

    const msg = JSON.stringify({ type: "board_changed" } as BoardEvent);

    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
}
