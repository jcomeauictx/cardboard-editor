all: xtest.py
	./$<
debug:
	@echo '.gdbinit will run xtest.py, `bt` for backtrace after segfault' >&2
	gdb python3
