all: serve
xtest: xtest.py
	./$<
debug: tkinter.debug
tkinter.debug:
	@echo '.gdbinit will run xtest.py, `bt` for backtrace after segfault' >&2
	gdb python3
strace.debug:
	$(MAKE) GDB='gdb --nx --args' xtest.log
xtest.log: xtest.py
	$(GDB) strace -f -v -o $@ -s 512 python3 $<
serve: server.py
	@echo Point browser to http://127.0.0.1:8000/ >&2
	./$<
