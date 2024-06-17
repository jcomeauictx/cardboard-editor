all: xtest.py
	./$<
debug:
	@echo '.gdbinit will run xtest.py, `bt` for backtrace after segfault' >&2
	gdb python3
xtest.log: xtest.py
	strace -f -v -o $@ -s 512 python3 $<
