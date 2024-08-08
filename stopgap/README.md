# Stopgap solution

Since I can't wrap my head around the Cardboard SDK, I'm switching focus to an editing environment that uses easily visible icons instead of text, to make it easier to use the Cardboard goggles with Android or iOS phones.

Android has Termux and X Server; iPhone has iSH and Mocha X11 (lite and pro, the former which times out after a few minutes).

Will start with both the keyboard and viewer on the same device, then on different devices, and finally try splitting the screen to make the Cardboard goggles usable.

## Developer notes
* any nontrivial tkinter code segfaults in FcFontRenderPrepare in /usr/lib/libfontconfig.so.1
* [strace no help](https://github.com/sharkdp/bat/issues/2575)
* [ministrace](https://blog.nelhage.com/2010/08/write-yourself-an-strace-in-70-lines-of-code/)
* 2024-06-21, giving up on iSH/Mocha, can't figure out the segfault in tkinter.
Going to switch to Python backend and browser (Safari) foreground. I can do
the same on Android with Chrome.
* [use this as a guide](https://www.geeksforgeeks.org/build-a-virtual-keyboard-using-html-css-javascript/)
* [inserting text into textarea](https://phuoc.ng/collection/html-dom/insert-text-into-a-text-area-at-the-current-position/)
* Use a private network for syncing the two phones, or other devices. For linux, there is the [linux-wifi-hotspot](https://github.com/jcomeauictx/linux-wifi-hotspot)
* Serializing keyhits on each device won't work, need to do it in the server.
* Websocket is closing unexpectedly; need to implement ping/pong?
