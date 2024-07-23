// adapted from https://en.wikipedia.org/wiki/WebSocket
// Connect to server
websocket = new WebSocket("ws://127.0.0.1:8080/"); // Local server

websocket.addEventListener("open", function(event) {
    console.debug("Connection opened");
    websocket.send("gnixl");
});

websocket.addEventListener("message", function(event) {
    console.info("Data received: " + event.data);
    websocket.close();
});

websocket.addEventListener("close", function(event) {
    console.debug("Connection closed: " + event);
});

websocket.addEventListener("error", function(event) {
    console.debug("Connection closed due to error: " + event);
});

console.debug("wsclient.js ready");
