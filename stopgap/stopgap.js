window.addEventListener("load", function() {
    const replaceChildren = function(element, newChildren) {
        try {
            element.replaceChildren(...newChildren);
        } catch (error) {
            console.debug("could not use element.replaceChildren(): " + error);
            console.debug("using older, slower method to replace child nodes");
            while (element.lastChild) element.removeChild(element.lastChild);
            for (let i = 0; i < newChildren.length; i++) {
                element.appendChild(newChildren[i]);
            }
        }
    };
    const editWindow = document.getElementById("edit-window");
    const placeholder = editWindow.placeholder;
    const background = document.getElementById("background");
    const fakeCaret = document.getElementById("fake-caret");
    fakeCaret.parentNode.removeChild(fakeCaret);  // remove from DOM
    let styles = ["padding", "borderWidth", "borderStyle", "margin"];
    styles.forEach(function(style) {
        background.style[style] = getComputedStyle(editWindow)[style];
    });
    const caretPosition = {
        start: editWindow.selectionStart,
        end: editWindow.selectionEnd
    };
    editWindow.addEventListener("focusout", function() {
        let editText = editWindow.value;
        caretPosition.start = editWindow.selectionStart;
        caretPosition.end = editWindow.selectionEnd;
        console.debug("caretPosition: ", caretPosition);
        replaceChildren(background, [
            document.createTextNode(editText.substring(0, caretPosition.end)),
            fakeCaret,
            document.createTextNode(editText.substring(caretPosition.end))
        ])
        editWindow.value = editWindow.placeholder = "";
    });
    editWindow.addEventListener("focusin", function() {
        try {
            fakeCaret.parentNode.removeChild(fakeCaret);
        } catch (error) {
            console.debug("fakeCaret could not be removed: " + error);
        }
        editWindow.value = background.innerText;
        replaceChildren(background, []);
        editWindow.selectionStart = caretPosition.start;
        editWindow.selectionEnd = caretPosition.end;
        editWindow.placeholder = placeholder;
    });
}, false);
console.log("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
