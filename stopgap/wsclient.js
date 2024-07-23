// adapted from https://en.wikipedia.org/wiki/WebSocket
window.onload = function() {
    // Connect to local server (wsserver.py)
    const websocket = new WebSocket("ws://127.0.0.1:8080/");
    let opened = false;
    websocket.addEventListener("open", function(event) {
        console.debug("Connection opened");
        opened = true;
        websocket.send("gnixl");
    });

    websocket.addEventListener("message", function(event) {
        console.info("Data received: " + event.data);
        //websocket.close();
    });

    websocket.addEventListener("close", function(event) {
        console.debug("Connection closed, code: " + event.code +
        ", reason: " + event.reason + ", clean: " + event.wasClean);
    });

    websocket.addEventListener("error", function(event) {
        console.debug("Connection closed due to error", event);
    });

    console.debug("wsclient.js ready");
    window.setTimeout(function() {
        if (!opened && websocket.readyState == WebSocket.OPEN) {
            // "open" event didn't fire, so take care of it now
            websocket.dispatchEvent(new Event("open"));
        }
    }, 1000);
};
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
