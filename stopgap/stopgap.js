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
    // textarea font size seems to be consistently smaller than background
    // let's fix that
    editWindow.style.fontSize = getComputedStyle(background).fontSize;
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
    // it should be possible to have the textarea handle generated keyhits
    // itself, but it refuses to do so. see
    //https://stackoverflow.com/a/57936361/493161
    const editWindowDeleteSelected = function() {
        console.debug("removing any selected text from edit-window");
        const text = editWindow.value;
        editWindow.value = text.substring(0, editWindow.selectionStart) +
            text.substring(editWindow.selectionEnd);
        editWindow.selectionEnd = editWindow.selectionStart;
    };
    const backgroundDeleteSelected = function() {
        const count = caretPosition.end - caretPosition.start;
        if (count > 0) {
            console.debug("removing " + count + " characters of selected text");
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
    const deleteSelected = function() {
        if (hasFocus == editWindow) return editWindowDeleteSelected();
        else return backgroundDeleteSelected();
    };
    const editWindowInsertString = function(string) {
        console.debug("inserting '" + string + "' at caret position");
        const text = editWindow.value;
        editWindow.value = text.substring(0, editWindow.selectionStart) +
            string + text.substring(editWindow.selectionEnd);
        editWindow.selectionEnd = editWindow.selectionStart;
    };
    const backgroundInsertString = function(string) {
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
    const insertString = function(string) {
        if (hasFocus == editWindow) return editWindowInsertString(string);
        else return backgroundInsertString(string);
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
            if (event.key in specialKeys) {
                console.debug("processing special key " + event.key);
                specialKeys[event.key]();
            } else {
                deleteSelected();
                insertString(event.key);
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
    const backspace = function(event) {
        const selected = caretPosition.end - caretPosition.start;
        // if there is selected text already, simply remove it on backspace
        // otherwise "select" the final character and remove it.
        // if there's nothing there, do nothing.
        if (selected == 0 && caretPosition.start > 0) --caretPosition.start;
        if (caretPosition.end > 0) deleteSelected();
    };
    const noop = function(event) {
        console.debug("ignoring " + event.key);
    };
    const GKOSKeys = {
        initial: {
            a: {
                location: ["1/3", "1/3"],
                representation: "a"
            },
            b: {
                location: ["1/3", "3/5"],
                representation: "b"
            },
            c: {
                location: ["1/3", "5/7"],
                representation: "c"
            },
            d: {
                location: ["5/7", "1/3"],
                representation: "d"
            },
            e: {
                location: ["5/7", "3/5"],
                representation: "e"
            },
            f: {
                location: ["5/7", "5/7"],
                representation: "f"
            }
        },
    };
    const endOfLine = navigator.platform.startsWith("Win") ? "\r\n" : "\n";
    const endline = function(event) {
        console.debug("implementing <ENTER> key");
        insertString(endOfLine);
    };
    const keyboardInit = function(softKeys) {
        for (key in softKeys) {
            const button = document.createElement("button");
            button.style.gridColumn = softKeys[key].location[0];
            button.style.gridRow = softKeys[key].location[1];
            button.appendChild(
                document.createTextNode(softKeys[key].representation || key)
            );
            keyboard.appendChild(button);
            button.addEventListener("click", softKeys[key].action || softKey);
        }
    };
    const specialKeys = {
        Backspace: backspace,
        Enter: endline,
        Escape: noop,
        Esc: noop,
    };
    // set focus on editWindow so keys have a target
    editWindow.focus();
    keyboardInit(GKOSKeys.initial);
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
}, false);
console.info("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
