window.addEventListener("load", function() {
    const replaceChildren = function(element, newChildren) {
        try {
            element.replaceChildren(...newChildren);
        } catch (error) {
            console.debug("could not use element.replaceChildren(): " + error);
            console.debug("using older, slower method to replace child nodes");
            while (element.lastChild) element.removeChild(element.lastChild);
            for (let i = 0; i < newChildren.length; i++) {
                console.debug("appending", newChildren[i], "to", element);
                element.appendChild(newChildren[i]);
            }
        }
    };
    const editWindow = document.getElementById("edit-window");
    const placeholder = editWindow.placeholder;
    const background = document.getElementById("background");
    const fakeCaret = document.getElementById("fake-caret");
    const keyboard = document.getElementById("keyboard");
    fakeCaret.parentNode.removeChild(fakeCaret);  // remove from DOM
    let styles = ["padding", "borderWidth", "borderStyle",
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
        let editText = editWindow.value;
        caretPosition.start = editWindow.selectionStart;
        caretPosition.end = editWindow.selectionEnd;
        console.debug("caretPosition: ", caretPosition);
        replaceChildren(background.firstChild, [
            document.createTextNode(editText.substring(0, caretPosition.end)),
            fakeCaret,
            document.createTextNode(editText.substring(caretPosition.end))
        ])
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
        let count = caretPosition.end - caretPosition.start;
        if (count > 0) {
            console.debug("removing", count, "characters of selected text");
            fakeCaret.parentNode.removeChild(fakeCaret);  // remove temporarily
            let text = background.firstChild.textContent;
            replaceChildren(background.firstChild, [
                text.substring(0, caretPosition.start),
                fakeCaret,
                text.substring(caretPosition.end)
            ]);
            caretPosition.end = caretPosition.start;
        }
    };
    const insertString = function(string) {
        console.debug("inserting '" + string + "' at caret position");
        fakeCaret.parentNode.removeChild(fakeCaret);  // remove temporarily
        let text = background.firstChild.textContent;
        let newStart = caretPosition.start + string.length;
        text = text.substring(0, caretPosition.start) + string +
            text.substring(caretPosition.start)
        caretPosition.start = caretPosition.end = newStart;
        replaceChildren(background.firstChild, [
            text.substring(0, newStart),
            fakeCaret,
            text.substring(newStart)
        ]);
    };
    document.body.addEventListener("keydown", function(event) {
        if (hasFocus != editWindow) {
            console.debug("key pressed:", event.key);
            if (event.altKey || event.ctrlKey || event.metaKey) {
                console.debug(
                    "ignoring keydown with alt, ctrl, or meta modifiers"
                );
            } else if (event.key.length == 1) {
                deleteSelected();
                insertString(event.key);
            }
        }
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
    const sendKey = function(key) {
        const event = new KeyboardEvent("keydown", {key: key});
        console.log("sending key '" + key + "'");
        document.body.dispatchEvent(event);
    };
    const softKey = function(event) {
        const key = event.target.firstChild.textContent;
        console.debug("key", key, "pressed");
        sendKey(key);
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
}, false);
console.log("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
