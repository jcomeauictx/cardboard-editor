SHELL := /bin/bash
BROWSER ?= chromium
ifeq ($(BROWSER),chomium)
	BROWSE := $(BROWSER) --temp-profile
else ifeq ($(BROWSER),firefox)
	BROWSE := $(BROWSER) --private-window
else
	BROWSE := $(BROWSER)
endif
LOCAL := 127.0.0.1
HTTPSERVER := server.py
HTTPSERVER_PORT := 8000
HTTPSERVER_URL := http://$(LOCAL):$(HTTPSERVER_PORT)/stopgap.html
WSSERVER := wsserver.py
WSSERVER_PORT := 8080
WSSERVER_URL := http://$(LOCAL):$(HTTPSERVER_PORT)/wsclient.html
# for next two variables, use simple `=` to evaluate at runtime
SERVER = HTTPSERVER
PORT = $($(SERVER)_PORT)
URL = $($(SERVER)_URL)
PYTHON ?= python3
ifneq ($(SHOWENV),)
	export
endif
all: serve
xtest: xtest.py
	$(PYTHON) $<
debug: tkinter.debug
tkinter.debug:
	@echo .gdbinit will run xtest.py >&2
	@echo '`bt` for backtrace after segfault' >&2
	gdb $(PYTHON)
stop: $(WSSERVER_PORT).stop $(HTTPSERVER_PORT).stop
%.stop:
	pid=$$(lsof -t -itcp@$(LOCAL):$* -s tcp:listen); \
        if [ "$$pid" ]; then \
	 echo Stopping server on $(LOCAL):$* >&2; \
         kill $$pid; \
	 sleep 1; \
        else \
         echo Nothing to stop: no server on port $* >&2; \
        fi
strace.debug:
	$(MAKE) GDB='gdb --nx --args' xtest.log
xtest.log: xtest.py
	$(GDB) strace -f -v -o $@ -s 512 $(PYTHON) $<
serve: $(HTTPSERVER)
	$(PYTHON) $< &
	-$(BROWSE) "$(URL)" >&2
	# prevent server stopping in case browser goes to background
	read -p '<ENTER> when done: '
	$(MAKE) $(HTTPSERVER_PORT).stop
wsserve: $(WSSERVER)
	$(PYTHON) $< &
env:
ifneq ($(SHOWENV),)
	$@
else
	$(MAKE) SHOWENV=1 $@
endif
wstest:
	$(MAKE) wsserve
	$(MAKE) SERVER=WSSERVER serve
