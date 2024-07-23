// adapted from https://en.wikipedia.org/wiki/WebSocket
// Connect to server
ws = new WebSocket("wss://127.0.0.1:8080/"); // Local server

ws.onopen = () => {
    console.log("Connection opened");
    ws.send("gnixl");
};

ws.onmessage = (event) => {
    console.log("Data received", event.data);
    ws.close();
};

ws.onclose = (event) => {
    console.log("Connection closed", event.code, event.reason, event.wasClean);
};

ws.onerror = () => {
    console.log("Connection closed due to error");
};

console.log("wsclient.js ready");
