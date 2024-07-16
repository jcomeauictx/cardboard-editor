window.addEventListener("load", function() {
    const editWindow = document.getElementById("edit-window");
    const background = document.getElementById("background");
    const fakeCaret = document.getElementById("fake-caret");
    fakeCaret.parentNode.removeChild(fakeCaret);  // remove from DOM
    let styles = ["padding", "borderWidth", "borderStyle",
                  "margin", "verticalAlign"];
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
        background.replaceChildren(
            document.createTextNode(editText.substring(0, caretPosition.end)),
            fakeCaret,
            document.createTextNode(editText.substring(caretPosition.end))
        )
        fakeCaret.style.display = "inline";
    });
}, false);
console.log("stopgap.js loaded");
// vim: tabstop=8 expandtab shiftwidth=4 softtabstop=4
