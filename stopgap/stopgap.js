document.onload = function() {
    alert("Compatibility mode: " + document.compatMode);
    var editwindow = document.getElementById("edit-window")
    var disregard = function(event) {return false};
    var eventlist = ["click", "mousedown", "mouseup", "focus", "focusin", "touchstart"];
    eventlist.forEach(function(eventname) {
        editwindow.addEventListener(eventname, disregard, false);
    });
};
