window.addEventListener("load", function() {
    replaceChildren = function(element, newChildren) {
        try {
            element.replaceChildren(...newChildren);
        } catch (error) {
            while (element.lastChild) element.removeChild(element.lastChild);
            for (let i = 0; i < newChildren.length; i++) {
                element.appendChild(newChildren[i]);
            }
        }
    };
    const editWindow = document.getElementById("edit-window");
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
    });
}, false);
console.log("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
