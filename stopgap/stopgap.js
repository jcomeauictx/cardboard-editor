document.onload = function() {
    var editwindow = document.getElementById("edit-window")
    var disregard = function(event) {return false};
    ["click", "focus", "touchstart"].forEach(function(eventname) {
        editwindow.addEventListener(eventname, disregard, false);
    });
}
