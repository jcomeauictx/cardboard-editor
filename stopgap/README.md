# Stopgap solution

Since I can't wrap my head around the Cardboard SDK, I'm switching focus to an editing environment that uses easily visible icons instead of text, to make it easier to use the Cardboard goggles with Android or iOS phones.

Android has Termux and X Server; iPhone has iSH and Mocha X11 (lite and pro, the former which times out after a few minutes).

Will start with both the keyboard and viewer on the same device, then on different devices, and finally try splitting the screen to make the Cardboard goggles usable.

## Developer notes
* any nontrivial tkinter code segfaults in FcFontRenderPrepare
* [strace no help](https://github.com/sharkdp/bat/issues/2575)
