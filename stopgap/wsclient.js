// adapted from https://en.wikipedia.org/wiki/WebSocket
window.onload = function() {
    // Connect to local server (wsserver.py)
    const websocket = new WebSocket("ws://127.0.0.1:8080/");
    const xhr = new XMLHttpRequest();
    xhr.addEventListener("readystatechange", function() {
        if(this.readyState == XMLHttpRequest.DONE && this.status == 200) {
            console.log("xhr response: " + this.responseText);
        } else {
            console.debug("readyState: " + this.readyState +
                          ", status: " + this.status);
        }
    });
    let opened = false, openwait = null;
    websocket.addEventListener("open", function(event) {
        console.debug("Connection opened");
        opened = true;
        websocket.send("gnixl");
        // now let's see what happens when we try to use http
        xhr.open("POST", "http://127.0.0.1:8080/");
        xhr.send("test=gnixl");
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
};
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
