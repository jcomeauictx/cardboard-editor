window.addEventListener("load", function() {
    const editWindow = document.getElementById("edit-window");
    const caretPosition = {
        start: editWindow.selectionStart;
        end: editWindow.selectionEnd;
    };
    editWindow.addEventListener("focusout", function() {
        caretPosition.start = editWindow.selectionStart;
        caretPosition.end = editWindow.selectionEnd;
    });
}, false);
console.log("stopgap.js loaded");
