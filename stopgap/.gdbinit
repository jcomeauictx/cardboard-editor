# segfaults at 0xf76e7cfa (backtrace #0)
set breakpoint pending on
break FcFontRenderPrepare
# 0xf76e5ad0, backtrace #5
# set breakpoint here because memory addresses not available until library is loaded
commands
set breakpoint pending off
# backtrace #4
break *0xf76e92c0
# backtrace #3
break *0xf76e8ff3
# backtrace #2
break *0xf76e8f61
# backtrace #1
break *0xf76e849e
#continue
end
display /i $eip
run xtest.py
