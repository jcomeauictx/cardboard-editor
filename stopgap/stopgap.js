window.addEventListener("load", function() {
    const phases = {
        0: "NONE",
        1: "CAPTURING",
        2: "AT_TARGET",
        3: "BUBBLING"
    };
    const replaceChildren = function(element, newChildren) {
        try {
            element.replaceChildren(...newChildren);
        } catch (error) {
            console.debug("could not use element.replaceChildren(): " + error);
            console.debug("using older, slower method to replace child nodes");
            while (element.lastChild) element.removeChild(element.lastChild);
            for (let i = 0; i < newChildren.length; i++) {
                console.debug("appending " + newChildren[i] + " to " + element);
                element.appendChild(newChildren[i]);
            }
        }
    };
    const editWindow = document.getElementById("edit-window");
    const placeholder = editWindow.placeholder;
    const background = document.getElementById("background");
    const fakeCaret = document.getElementById("fake-caret");
    const keyboard = document.getElementById("keyboard");
    let webSocket = null;  // set this up later
    class KeyClick extends KeyboardEvent {
        constructor(key, code, serial) {
            super("keydown", {key: key, code: code});
            this.serial = serial;
        }
    }
    fakeCaret.parentNode.removeChild(fakeCaret);  // remove from DOM
    const styles = ["padding", "borderWidth", "borderStyle",
                  "margin", "lineHeight"];
    styles.forEach(function(style) {
        background.style[style] = getComputedStyle(editWindow)[style];
    });
    const caretPosition = {
        start: editWindow.selectionStart,
        end: editWindow.selectionEnd
    };
    let hasFocus = editWindow;
    editWindow.addEventListener("focusout", function() {
        const editText = editWindow.value;
        caretPosition.start = editWindow.selectionStart;
        caretPosition.end = editWindow.selectionEnd;
        console.debug("caretPosition: ", caretPosition);
        replaceChildren(background.firstChild, [
            document.createTextNode(editText.substring(0, caretPosition.end)),
            fakeCaret,
            document.createTextNode(editText.substring(caretPosition.end))
        ]);
        editWindow.value = editWindow.placeholder = "";
        hasFocus = background;
    });
    editWindow.addEventListener("focusin", function() {
        hasFocus = editWindow;
        try {
            fakeCaret.parentNode.removeChild(fakeCaret);
        } catch (error) {
            console.debug("fakeCaret could not be removed: " + error);
        }
        editWindow.value = background.innerText.replace(
            /&lt;/g, "<").replace(/&amp;/g, "&");
        replaceChildren(background.firstChild, []);
        editWindow.selectionStart = caretPosition.start;
        editWindow.selectionEnd = caretPosition.end;
        editWindow.placeholder = placeholder;
    });
    const deleteSelected = function() {
        // assuming end is always greater than start, is this valid?!
        const count = caretPosition.end - caretPosition.start;
        if (count > 0) {
            console.debug("removing", count, "characters of selected text");
            fakeCaret.parentNode.removeChild(fakeCaret);  // remove temporarily
            const text = background.firstChild.textContent;
            replaceChildren(background.firstChild, [
                document.createTextNode(text.substring(0, caretPosition.start)),
                fakeCaret,
                document.createTextNode(text.substring(caretPosition.end))
            ]);
            caretPosition.end = caretPosition.start;
        }
    };
    const insertString = function(string) {
        console.debug("inserting '" + string + "' at caret position");
        fakeCaret.parentNode.removeChild(fakeCaret);  // remove temporarily
        let text = background.firstChild.textContent;
        const newStart = caretPosition.start + string.length;
        text = text.substring(0, caretPosition.start) + string +
            text.substring(caretPosition.start);
        caretPosition.start = caretPosition.end = newStart;
        replaceChildren(background.firstChild, [
            document.createTextNode(text.substring(0, newStart)),
            fakeCaret,
            document.createTextNode(text.substring(newStart))
        ]);
    };
    document.body.addEventListener("keydown", function(event) {
        // only process the events after they've been sent over webSocket
        console.debug("processing keydown event, key: " + event.key +
                      ", code: " + event.code + ", serial: " + event.serial +
                      ", target: " + event.currentTarget.tagName +
                      ", eventPhase: " + phases[event.eventPhase]);
        let echo = true;
        if (event.altKey || event.ctrlKey || event.metaKey) {
            console.debug(
                "ignoring keydown with alt, ctrl, or meta modifiers"
            );
            return false;  // stop propagation and default action
        }
        if (event.serial) {  // requires 1-based serial numbers
            console.debug("tunneled key: '" + event.key + "'");
            if (hasFocus != editWindow) {
                console.debug("editing background");
                if (event.key.length == 1) {
                    deleteSelected();
                    insertString(event.key);
                } else {
                    console.debug("don't know what to do with '" +
                                  event.key + "'");
                }
            } else {
                console.debug("allowing editWindow to handle the event");
                return true;  // let it bubble to editWindow?
            }
        } else if (event.code === "") {
            console.debug("test key: '" + event.key + "'");
            return true;  // let it bubble to editWindow?
        } else {
            console.debug("local key: '" + event.key + "'");
            if (hasFocus == editWindow) {
                console.debug("key " + event.key +
                              ", code: " + event.code +
                              " assumed to be processed by editWindow");
                echo = false;
            }
            console.debug("sending key '" + event.key +
                          "' through webSocket tunnel");
            webSocket.send(JSON.stringify({key: event.key, echo: echo}));
            return false;  // stop propagation and default action
        }
    });
    editWindow.addEventListener("keydown", function(event) {
        console.debug("key '" + event.key + "' reached edit-window");
    });
    document.body.addEventListener("keyup", function(event) {
        if (hasFocus != editWindow) {
            console.debug("key released:", event.key);
        }
    });
    document.body.addEventListener("keypress", function(event) {
        if (hasFocus != editWindow) {
            console.debug("keypress event for", event.key, "received");
        } else {
            console.debug("ignoring keypress while edit window has focus");
        }
    });
    const sendKey = function(key, code, serial) {
        const event = new KeyClick(key, code, serial);
        console.debug("dispatching key '" + key + "', code: " + code);
        document.body.dispatchEvent(event);
    };
    const softKey = function(event) {
        const key = event.target.firstChild.textContent;
        console.debug("softKey", key, "pressed");
        sendKey(key, key, null);
    };
    const escKey = document.createElement("button");
    escKey.style.gridColumn = escKey.style.gridRow = "1";
    escKey.appendChild(document.createTextNode("Esc"));
    keyboard.appendChild(escKey);
    const leftSquareBracket = document.createElement("button");
    leftSquareBracket.style.gridColumn = "3";
    leftSquareBracket.style.gridRow = "6";
    leftSquareBracket.appendChild(document.createTextNode("["));
    keyboard.appendChild(leftSquareBracket);
    leftSquareBracket.addEventListener("click", function(event) {
        softKey(event);
    });
    // all interaction with server henceforth will be over a WebSocket
    // try-catch doesn't work here, see stackoverflow.com/a/31003057/493161
    webSocket = new WebSocket("ws://" + location.host);
    webSocket.onmessage = function(event) {
        let message = null;
        console.debug("Data received: " + event.data);
        try {
            message = JSON.parse(event.data);
            sendKey(message.key, message.code, message.serial);
        } catch (parseError) {
            console.error("unexpected message: " + parseError);
            message = event.data;
        }
    };
    webSocket.onclose = function(event) {
        console.debug("Connection closed, code: " +
            event.code + ", reason: \"" +
            event.reason + "\", was clean: " + event.wasClean);
        console.debug("You may close this window.");
    };
    webSocket.onerror = function(event) {
        console.warn("Connection closed due to error", event);
    };
    webSocket.onopen = function(event) {
        console.info("Connection opened to " + location.host);
        webSocket.send("stopgap editor");
    };
    console.info("WebSocket connection initialized");
    // XXX let's try a few things to see if we can solve the keydown problems
    editWindow.focus();
    sendKey("5", "", null);
}, false);
console.log("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
