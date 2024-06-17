set breakpoint pending on
break FcFontRenderPrepare
commands
# set breakpoint here because memory not available until library is loaded
break *0xf76e849e
continue
end
display /i $eip
run xtest.py
