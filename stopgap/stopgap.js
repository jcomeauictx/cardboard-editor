window.addEventListener("load", function() {
    /* eventually we probably could/should eliminate the textarea altogether
       and just use the background div, vastly simplifying the code. but
       during development, I want to compare how well my code mirrors the
       native handling of keypress events by textarea. */
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
    let shift = _; // bit-OR in X and/or Y as needed
    let meta = _; // Ctrl, Alt, Win
    // we reuse the chording bit values for meta keys
    const LEFT_ALT = A, RIGHT_ALT = Y, LEFT_CTRL = B, RIGHT_CTRL = X;
    const META_KEY = C;
    const mapping = { // chords to characters (GKOS standard for English)
        /* NOTE: I'm using END (cf. 'End') for what looks like a "Play" button
           in the GKOS test page, and HOME for its reverse. Neither does
           anything in the test page, so I'm not sure of their intended
           purposes */
        '_|_|_|_|_|_': ['', '', '', ''],
        'A|_|_|_|_|_': ['a', 'A', '1', '1'],
        'B|_|_|_|_|_': ['b', 'B', '2', '2'],
        'A|B|_|_|_|_': ['o', 'O', '+', '+'],
        '_|_|C|_|_|_': ['c', 'C', '3', '3'],
        'A|_|C|_|_|_': ['th', 'Th', ')', ')'],
        '_|B|C|_|_|_': ['s', 'S', '*', '*'],
        'A|B|C|_|_|_': ['Backspace', 'Backspace', 'Backspace', 'Backspace'],
        '_|_|_|D|_|_': ['d', 'D', '4', '4'],
        'A|_|_|D|_|_': ['Up', 'Up', 'Up', 'Up'],
        '_|B|_|D|_|_': ["'", '"', "'", '"'],
        'A|B|_|D|_|_': ['p', 'P', '%', '%'],
        '_|_|C|D|_|_': ['!', '|', '!', '|'],
        'A|_|C|D|_|_': ['that ', 'That ', ']', ']'],
        '_|B|C|D|_|_': ['t', 'T', '$', '$'],
        'A|B|C|D|_|_': ['Left', 'Left', 'Left', 'Left'],
        '_|_|_|_|E|_': ['e', 'E', '5', '5'],
        'A|_|_|_|E|_': ['-', '_', '-', '_'],
        '_|B|_|_|E|_': ['SHIFT', 'SHIFT', 'SHIFT', 'SHIFT'],
        'A|B|_|_|E|_': ['q', 'Q', '=', '='],
        '_|_|C|_|E|_': [',', ';', ',', ';'],
        'A|_|C|_|E|_': ['the ', 'The ', '>', '>'],
        '_|B|C|_|E|_': ['u', 'U', '€', '€'],
        'A|B|C|_|E|_': ['HOME', 'HOME', 'HOME', 'HOME'],
        '_|_|_|D|E|_': ['g', 'G', '0', '0'],
        'A|_|_|D|E|_': ['h', 'H', '7', '7'],
        '_|B|_|D|E|_': ['i', 'I', '8', '8'],
        'A|B|_|D|E|_': ['PgUp', 'PgUp', 'PgUp', 'PgUp'],
        '_|_|C|D|E|_': ['j', 'J', '9', '9'],
        'A|_|C|D|E|_': ['to ', 'To ', '', '\u030c'],
        '_|B|C|D|E|_': ['/', '\u0301', '/', '\u0301'], // forward slash, accent
        'A|B|C|D|E|_': ['Esc', 'Esc', 'Esc', 'Esc'],
        '_|_|_|_|_|F': ['f', 'F', '6', '6'],
        'A|_|_|_|_|F': ['?', '~', '?', '~'],
        '_|B|_|_|_|F': ['.', ':', '.', ':'],
        'A|B|_|_|_|F': ['r', 'R', '^', '^'],
        '_|_|C|_|_|F': ['Down', 'Down', 'Down', 'Down'],
        'A|_|C|_|_|F': ['of ', 'Of ', '}', '}'],
        '_|B|C|_|_|F': ['v', 'V', '£', '£'],
        'A|B|C|_|_|F': ['Home', 'Home', 'Home', 'Home'],
        '_|_|_|D|_|F': ['w', 'W', '(', '('],
        'A|_|_|D|_|F': ['x', 'X', '[', '['],
        '_|B|_|D|_|F': ['y', 'Y', '<', '<'],
        'A|B|_|D|_|F': ['Ins', 'Ins', 'Ins', '°'],
        '_|_|C|D|_|F': ['z', 'Z', '{', '{'],
        'A|_|C|D|_|F': ['SYMB', 'SYMB', 'SYMB', 'SYMB'],
        '_|B|C|D|_|F': ['with ', 'With ', '§', '§'],
        'A|B|C|D|_|F': ['Ctrl', 'Ctrl', 'Ctrl', 'Ctrl'],
        '_|_|_|_|E|F': ['k', 'K', '#', '#'],
        'A|_|_|_|E|F': ['l', 'L', '@', '@'],
        '_|B|_|_|E|F': ['m', 'M', '½', '½'],
        'A|B|_|_|E|F': ['\\', '\u0300', '\\', '\u0300'], // back slash, accent
        '_|_|C|_|E|F': ['n', 'N', '&', '&'],
        'A|_|C|_|E|F': ['and ', 'And ', 'μ', 'μ'],
        '_|B|C|_|E|F': ['PgDn', 'PgDn', 'PgDn', 'PgDn'],
        'A|B|C|_|E|F': ['Alt', 'Alt', 'Alt', 'Alt'],
        '_|_|_|D|E|F': [' ', ' ', ' ', ' '], // original GKOS [' ', '', '', '']
        'A|_|_|D|E|F': ['Right', 'Right', 'Right', 'Right'],
        '_|B|_|D|E|F': ['END', 'END', 'END', 'END'],
        'A|B|_|D|E|F': ['Enter', 'Enter', 'Enter', 'Enter'],
        '_|_|C|D|E|F': ['End', 'End', 'End', 'End'],
        'A|_|C|D|E|F': ['\t', '\t', '\t', '\t'], // Tab
        '_|B|C|D|E|F': ['Delete', 'Delete', 'Delete', 'Delete'],
        'A|B|C|D|E|F': ['ABC123', 'ABC123', 'ABC123', 'ABC123']
    };
    // for ES6 we could have used [D|E|F] etc., above but not for ES5.
    // so we add the *real* keys now, using eval.
    Object.keys(mapping).forEach(function(key) {
        const value = eval(key); // bit-OR the values together
        mapping[value] = mapping[key][0];
        mapping[value | X] = mapping[key][1]; // shifted
        mapping[value | Y] = mapping[key][2]; // numbers mode
        mapping[value | X | Y] = mapping[key][3]; // SYMBols mode
        delete mapping[key]; // no more need for text key
    });
    console.debug("mapping: " + JSON.stringify(mapping));
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
                console.debug("tunneled key '" + key + "', using verbatim");
                let handler = null;
                if (key.length > 1) handler = eval("do" + key);
                console.debug("handler do" + key + ": " + handler);
                if (typeof handler == "function") {
                    console.debug("processing special key " + key);
                    handler(event);
                } else {
                    if (typeof handler != null) {
                        console.debug("typeof handler: " + typeof handler);
                    }
                    deleteSelected();
                    console.debug("inserting character '" + key + "'");
                    insertString(key);
                }
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
                const character = mapping[untimedChord | shift] || '';
                shift = _; // FIXME: needs to be conditional, see GKOS source
                meta = _; // FIXME: should this be done here?
                let handler = null;
                readyToRead = false;
                untimedChord = 0;
                if (key.length > 1) handler = eval("do" + key);
                if (typeof handler == "function") {
                    console.debug("processing special key " + key);
                    handler(event);
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
    const doBackspace = function(event) {
        console.debug("Backspace received with caretPosition " +
                      JSON.stringify(caretPosition));
        const selected = caretPosition.end - caretPosition.start;
        // if there is selected text already, simply remove it on backspace
        // otherwise "select" the final character and remove it.
        // if there's nothing there, do nothing.
        if (selected == 0 && caretPosition.start > 0) --caretPosition.start;
        if (caretPosition.end > 0) deleteSelected();
    };
    const doSYMB = function(event) {
        if (event.type == "keydown") {
            // only hardware keys dispatch key handlers on keydown
            console.debug("SYMB key is GKOS only, ignoring");
        } else {
            console.debug("Entering SYMBol mode for following character");
            shift |= Y;
        }
    };
    const noop = function(event) {
        console.debug(
            "ignoring event " + event + "(" + JSON.stringify(event) + ")" +
            ", target: " + target + "(" + JSON.stringify(event.target) + ")"
        );
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
    const doEnter = function(event) {
        console.debug("implementing <ENTER> key");
        insertString(endOfLine);
    };
    const cancel = function(event) {
        /* remove key from chord

           only to be used if no chordKeyUp was seen; because pointerout
           and pointerleave events will be called regardless of chordKeyUp's
           `return false`, we don't want to erase the chord before its
           character is rendered in the edit window.
        */
        const button = event.target;
        const key = button.firstChild.textContent;
        const value = GKOSKeys[key].value;
        if (!button.getAttribute("key-up-seen")) {
            console.debug("event " + event.type + " removing component " +
                          value + " from chord " + untimedChord);
            untimedChord &= ~value;
        }
        button.style.removeProperty("background"); // revert to default
    };
    const keyboardInit = function(softKeys) {
        Object.keys(softKeys).forEach(function(key) {
            const button = document.createElement("button");
            button.style.gridColumn = softKeys[key].location[0];
            button.style.gridRow = softKeys[key].location[1];
            button.setAttribute("key-up-seen", "");
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
                // in case those don't work, use mouse events
                // however, they won't work on more than one
                // button at a time
                //button.addEventListener("mousedown", chordKeyDown);
                //button.addEventListener("mouseup", chordKeyUp);
                //button.addEventListener("mouseleave", cancel);
                // in case none of the above do anything, at least log it
                button.addEventListener("click", noop);
            } else {
                // on desktop, no chording possible with softkeys
                button.addEventListener("click", chordKeyClick);
            }
        });
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
        button.setAttribute("key-up-seen", "");
        softKey(key, "down", "gkos");
        return false; // disable default and bubbling
    };
    const chordKeyUp = function(event) {
        const button = event.target;
        const key = button.firstChild.textContent;
        console.debug("chordKeyUp() key '" + key + "' processing");
        button.setAttribute("key-up-seen", "true");
        button.style.removeProperty("background"); // revert to default
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
