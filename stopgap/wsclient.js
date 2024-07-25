// adapted from https://en.wikipedia.org/wiki/WebSocket
window.onload = function() {
    // Connect to local server (wsserver.py)
    const url = "ws://127.0.0.1:8080/";
    const websocket = new WebSocket(url);
    const responses = ["bar", "baz", "foo"];  // offset +1 from wsserver.py
    const display = document.getElementById("log-window");
    let messageCount = 0;
    const log = function(message, end=true) {
        display.value += message;
        if (end) display.value += "\r\n";
    };
    websocket.addEventListener("open", function(event) {
        log("Connection opened to " + url);
    });

    websocket.addEventListener("message", function(event) {
        log("Data received: " + event.data, false);
        messageCount += 1;
        let response = responses[messageCount % responses.length];
        websocket.send(response);
        log(", responded: " + response);
    });

    websocket.addEventListener("close", function(event) {
        log("Connection closed, code: " + event.code);
        log("You may close this window.");
    });

    websocket.addEventListener("error", function(event) {
        log("Connection closed due to error", event);
    });

    console.debug("wsclient.js ready");
};
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
