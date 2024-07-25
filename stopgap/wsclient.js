// adapted from https://en.wikipedia.org/wiki/WebSocket
window.onload = function() {
    // Connect to local server (wsserver.py)
    const websocket = new WebSocket("ws://127.0.0.1:8080/");
    const responses = ["bar", "baz", "foo"];  // offset +1 from wsserver.py
    let messageCount = 0;
    websocket.addEventListener("open", function(event) {
        console.debug("Connection opened");
    });

    websocket.addEventListener("message", function(event) {
        console.info("Data received: " + event.data);
        messageCount += 1;
        websocket.send(responses[messageCount % responses.length]);
    });

    websocket.addEventListener("close", function(event) {
        console.debug("Connection closed, code: " + event.code);
    });

    websocket.addEventListener("error", function(event) {
        console.debug("Connection closed due to error", event);
    });

    console.debug("wsclient.js ready");
};
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
