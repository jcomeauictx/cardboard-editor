window.addEventListener("load", function() {
    const editWindow = document.getElementById("edit-window");
    const background = document.getElementById("background");
    const fakeCaret = document.getElementById("fake-caret");
    let styles = ["padding", "borderWidth", "borderStyle", "margin"];
    const caretPosition = {
        start: editWindow.selectionStart,
        end: editWindow.selectionEnd
    };
    editWindow.addEventListener("focusout", function() {
        caretPosition.start = editWindow.selectionStart;
        caretPosition.end = editWindow.selectionEnd;
    });
}, false);
console.log("stopgap.js loaded");
