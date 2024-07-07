window.addEventListener("load", function() {
    console.log("Compatibility mode: " + document.compatMode);
    var editwindow = document.getElementById("edit-window");
    var disregard = function(event) {return false};
    var eventlist = [
        "click", "mousedown", "mouseup", "focus", "focusin", "touchstart"
    ];
    if (false) eventlist.forEach(function(eventname) {
        editwindow.addEventListener(eventname, disregard, false);
    });
}, false);
console.log("stopgap.js loaded");
