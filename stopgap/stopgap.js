window.addEventListener("load", function() {
    /* eventually we probably could/should eliminate the textarea altogether
       and just use the background div, vastly simplifying the code. but
       during development, I want to compare how well my code mirrors the
       native native handling of keypress events by textarea. */
    const phases = {
        0: "NONE",
        1: "CAPTURING",
        2: "AT_TARGET",
        3: "BUBBLING"
    };
    const mobileBrowser = /Mobile|Android|iPhone/.test(navigator.userAgent);
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
    let untimedChord = 0;  // simplest possible chording technique
    let readyToRead = false;  // becomes true on GKOS keydown
    // key to chord mapping for GKOS
    const _ = 0x00;
    const A = 0x01;
    const B = 0x02;
    const C = 0x04;
    const D = 0x08;
    const E = 0x10;
    const F = 0x20;
    // X (64) and Y (128) are not keys, but chord offsets
    const X = 0x40;
    const Y = 0x80;
    const mapping = { // chords to character indices
        [A]: 1, // a
        [B]: 2, // b
        [C]: 3, // c
        [D]: 4, // d
        [E]: 5, // e
        [F]: 6, // f
        [_|_|_|D|E|_]: 7, // g
        [A|_|_|D|E|_]: 8, // h
        [_|B|_|D|E|_]: 9, // i
        [_|_|C|D|E|_]: 10, // j
        [_|_|_|_|E|F]: 11, // k
        [A|_|_|_|E|F]: 12, // l
        [_|B|_|_|E|F]: 13, // m
        [_|_|C|_|E|F]: 14, // n
        [A|B|_|_|_|_]: 15, // o
        [A|B|_|D|_|_]: 16, // p
        [A|B|_|_|E|_]: 17, // q
        [A|B|_|_|_|F]: 18, // r
        [_|B|C|_|_|_]: 19, // s
        [_|B|C|D|_|_]: 20, // t
        [_|B|C|_|E|_]: 21, // u
        [_|B|C|_|_|F]: 22, // v
        [_|_|_|D|_|F]: 23, // w
        [A|_|_|D|_|F]: 24, // x
        [_|B|_|D|_|F]: 25, // y
        [_|_|C|D|_|F]: 26, // z
        [A|_|C|_|_|_]: 27, // th
        [A|_|C|D|_|_]: 28, // "that "
        [A|_|C|_|E|_]: 29, // "the "
        [A|_|C|_|_|F]: 30, // "of "
        [_|B|_|_|_|F]: 31, // .
        [_|_|C|_|E|_]: 32, // ,
        [_|_|C|D|_|_]: 33, // !
        [A|_|_|_|_|F]: 34, // ?
        [A|_|_|_|E|_]: 35, // -
        [_|B|_|D|_|_]: 36, // '
        [A|B|_|_|E|F]: 37, // \
        [_|B|C|D|E|_]: 38, // /
        [A|_|C|_|E|F]: 39, // "and "
        [_|B|C|D|_|F]: 40, // "with "
        [A|_|C|D|E|_]: 41, // "to "
    };
    const baseChars = {
        // in the following, \0 is placeholder for "",
        // \v for multi-character entries such as "that ", "the ", ...
        lower:
            "\0abcdefghijklmnopqrstuvwxyz\v\v\v\v." +
            ",!?-'\\/\v\v\v\0\0\0\0\0\0\0\0 \0\0\0\0\t\0\0\0\0\0\0\0\0",
        upper:
            "\0ABCDEFGHIJKLMNOPQRSTUVWXYZ\v\v\v\v:" +
            ';|~_"\u0300\u0301' +
            "\v\v\v\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
        symbolsLower:
            "\x001234560789#@½&+%=^*$€£([<{)]>}." +
            ",!?-'\\/μ§\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
        symbolsUpper:
            "\x001234560789#@½&+%=^*$€£([<{)]>}:" +
            ';|~_"\u0300\u0301μ§\u030c' +
            "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0°\0\0\0\0\0"
    };
    const GKOS = {
        latin: Object.fromEntries(Array.from(
                baseChars.lower + baseChars.upper +
                baseChars.symbolsLower + baseChars.symbolsUpper
            ).map(function(value, key) {
                return [key, value == "\0" ? "" : value];
            })
        )
    };
    const patch = {
        english: {
            27: "th", 28: "that ", 29: "the ", 30: "of ",
            39: "and ", 40: "with ", 41: "to ",
            91: "Th", 92: "That ", 93: "The ", 94: "Of ",
            103: "And ", 104: "With ", 105: "To "
        },
    };
    GKOS.english = Object.assign({}, GKOS.latin, patch.english);
    console.debug("characters available: " + JSON.stringify(GKOS.english));
    class KeyDown extends KeyboardEvent {
        constructor(key, code, serial, keytype) {
            super("keydown", {key: key, code: code});
            this.serial = serial;
            this.keytype = keytype;
        }
    }
    class KeyUp extends KeyboardEvent {
        constructor(key, code, serial, keytype) {
            super("keyup", {key: key, code: code});
            this.serial = serial;
            this.keytype = keytype;
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
        console.debug("caretPosition: " + JSON.stringify(caretPosition));
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
                      ", keytype: " + event.keytype +
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
            const key = event.key;
            if (event.keytype == "gkos") {
                const value = GKOSKeys[key].value;
                untimedChord |= value;
                console.debug("tunneled key '" + key + "' with value " +
                              value + ", chord: " + untimedChord);
                readyToRead = true;
            } else {
                // hardware key, or platform-supplied softkey
                console.debug("tunneled key '" + key + "' with value " +
                              value + ", using verbatim");
            }
        } else if (event.code === "") {
            console.debug("test key: '" + event.key + "'");
        } else {
            console.debug("local key: '" + event.key + "'");
            if (hasFocus == editWindow && !event.keytype) {
                console.debug("keydown " + event.key +
                              ", code: " + event.code +
                              " assumed to be processed by editWindow");
                echo = false;
            }
            console.debug("sending keydown '" + event.key +
                          "' through webSocket tunnel");
            webSocket.send(JSON.stringify({
                key: event.key,
                direction: "down",
                echo: echo,
                keytype: event.keytype
            }));
            return false;  // stop propagation and default action
        }
    });
    editWindow.addEventListener("keydown", function(event) {
        console.debug("key '" + event.key + "' reached edit-window");
    });
    document.body.addEventListener("keyup", function(event) {
        let echo = true;
        if (event.serial) {
            const key = event.key;
            if (readyToRead) {
                const index = mapping[untimedChord] || 0;
                const character = GKOS.english[index] || '';
                readyToRead = false;
                untimedChord = 0;
                if (specialKeys[character]) {
                    console.debug("processing special key " + character);
                    specialKeys[character]();
                } else {
                    deleteSelected();
                    console.debug("inserting character '" + character + "'");
                    insertString(character);
                }
            }
        } else {
            console.debug("local key: '" + event.key + "'");
            if (hasFocus == editWindow && !event.keytype) {
                console.debug("keyup " + event.key +
                              ", code: " + event.code +
                              " assumed to be processed by editWindow");
                echo = false;
            }
            console.debug("sending keyup '" + event.key +
                          "' through webSocket tunnel");
            webSocket.send(JSON.stringify({
                key: event.key,
                direction: "up",
                echo: echo,
                keytype: event.keytype
            }));
            return false;  // stop propagation and default action
        }
    });
    document.body.addEventListener("keypress", function(event) {
        if (hasFocus != editWindow) {
            console.debug("keypress event for", event.key, "received");
        } else {
            console.debug("ignoring keypress while edit window has focus");
        }
    });
    const sendKey = function(key, code, serial, direction, keytype) {
        const event = new (direction == "up" ? KeyUp : KeyDown)(
            key, code, serial, keytype
        );
        console.debug("dispatching key" + direction +
                      " '" + key + "', code: " + code);
        document.body.dispatchEvent(event);
    };
    const softKey = function(character, direction, keytype) {
        console.debug("softKey " + character + " " +
                      (direction == "up" ? "released" : "pressed"));
        sendKey(character, character, null, direction, keytype);
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
        a: {
            location: ["1/3", "1/3"],
            representation: "a",
            value: 1
        },
        b: {
            location: ["1/3", "3/5"],
            representation: "b",
            value: 2
        },
        c: {
            location: ["1/3", "5/7"],
            representation: "c",
            value: 4
        },
        d: {
            location: ["5/7", "1/3"],
            representation: "d",
            value: 8
        },
        e: {
            location: ["5/7", "3/5"],
            representation: "e",
            value: 16
        },
        f: {
            location: ["5/7", "5/7"],
            representation: "f",
            value: 32
        }
    };
    const endOfLine = navigator.platform.startsWith("Win") ? "\r\n" : "\n";
    const endline = function(event) {
        console.debug("implementing <ENTER> key");
        insertString(endOfLine);
    };
    const cancel = function(event) {
        /* remove key from chord */
        const button = event.target;
        const key = button.firstChild.textContent;
        const value = GKOSKeys[key].value;
        console.debug("removing component " + value + " from chord " +
                      untimedChord);
        untimedChord &= ~value;
        button.style.background = "buttonface"; // default
    };
    const keyboardInit = function(softKeys) {
        Object.keys(softKeys).forEach(function(key) {
            const button = document.createElement("button");
            button.style.gridColumn = softKeys[key].location[0];
            button.style.gridRow = softKeys[key].location[1];
            button.appendChild(
                document.createTextNode(softKeys[key].representation || key)
            );
            keyboard.appendChild(button);
            if (mobileBrowser) {
                button.addEventListener("pointerdown", chordKeyDown);
                button.addEventListener("pointerup", chordKeyUp);
                button.addEventListener("pointerleave", cancel);
                button.addEventListener("pointercancel", cancel);
                button.addEventListener("pointerout", cancel);
            } else {
                button.addEventListener("click", chordKeyClick);
            }
        });
    };
    const specialKeys = {
        Backspace: backspace,
        Enter: endline,
        Escape: noop,
    };
    // begin untimed keychord processing
    /* the description on page 20 of gkos_spec_v314.pdf says to read chord
     * value "immediately before the key went up", which is of course
     * impossible, as the event has already occurred. so what we will do
     * instead is to build the chord with each keydown event */
    const chordKeyDown = function(event) {
        const button = event.target;
        const key = button.firstChild.textContent;
        console.debug("chordKeyDown() key '" + key + "' processing");
        button.style.background = "blue";
        softKey(key, "down", "gkos");
        return false; // disable default and bubbling
    };
    const chordKeyUp = function(event) {
        const button = event.target;
        const key = button.firstChild.textContent;
        console.debug("chordKeyUp() key '" + key + "' processing");
        button.style.background = "buttonface"; // default
        softKey(key, "up", "gkos");
        return false; // disable default and bubbling
    };
    const chordKeyClick = function(event) {
        /* just for testing, no real use for softkeys on desktop */
        chordKeyDown(event);
        chordKeyUp(event);
        return true; // allow default action to remove border?
    };
    // set focus on editWindow so keys have a target
    editWindow.focus();
    keyboardInit(GKOSKeys);
    // all interaction with server henceforth will be over a WebSocket
    // try-catch doesn't work here, see stackoverflow.com/a/31003057/493161
    webSocket = new WebSocket("ws://" + location.host);
    webSocket.onmessage = function(event) {
        let message = null;
        console.debug("Data received: " + event.data);
        try {
            message = JSON.parse(event.data);
            sendKey(message.key, message.code, message.serial,
                    message.direction, message.keytype);
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
