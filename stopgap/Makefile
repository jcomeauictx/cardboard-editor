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
HTTPSERVER_HOST := $(LOCAL):$(HTTPSERVER_PORT)
HTTPSERVER_URL := http://$(HTTPSERVER_HOST)/stopgap.html
WSSERVER := wsserver.py
WSSERVER_PORT := 8080
WSSERVER_HOST := $(LOCAL):$(WSSERVER_PORT)
WSSERVER_URL := http://$(HTTPSERVER_HOST)/wsclient.html$(WSQUERY)
# for next two variables, use simple `=` to evaluate at runtime
SERVER = HTTPSERVER
PORT = $($(SERVER)_PORT)
HOST = $($(SERVER)_HOST)
URL = $($(SERVER)_URL)
PYTHON ?= python3
PYLINT ?= $(shell which pylint pylint3 true 2>/dev/null | head -n 1)
SCRIPTS := $(wildcard *.py)
ifneq ($(SHOWENV),)
	export
endif
all: httpserver
xtest: xtest.py
	$(PYTHON) $<
debug: tkinter.debug
tkinter.debug:
	@echo .gdbinit will run xtest.py >&2
	@echo '`bt` for backtrace after segfault' >&2
	gdb $(PYTHON)
stop: wsserver.stop httpserver.stop
%.stop:
	# `kill 0` avoids usage message if `pidof wsserver` returns nothing
	# (it just kills the `kill` process itself)
	kill $$(pidof $*) 0 || true
strace.debug:
	$(MAKE) GDB='gdb --nx --args' xtest.log
xtest.log: xtest.py
	$(GDB) strace -f -v -o $@ -s 512 $(PYTHON) $<
httpserver: $(HTTPSERVER)
	# check for port in use before starting
	# https://stackoverflow.com/a/77400250/493161
	# NOTE that these return true (0) if port in use and false (1) if not
	# so we need to invert the status with `!` to force an error
	! lsof -itcp:8000
	! fuser 8000/tcp
	exec -a $@ $(PYTHON) $< || true &
	#sleep 1  # give server a chance to start before launching browser
	# (above `sleep` commented out because SO_REUSEADDR option fixed it)
	-$(BROWSE) "$(URL)" >&2
	# prevent server stopping in case browser goes to background
	read -p '<ENTER> when done: '
	$(MAKE) $@.stop
wsserver: $(WSSERVER)
	# check for port in use before starting, see notes under `httpserver:`
	! lsof -itcp:8080
	! fuser 8080/tcp
	exec -a $@ $(PYTHON) $< || true &
	@echo wsserver launched
env:
ifneq ($(SHOWENV),)
	$@
else
	$(MAKE) SHOWENV=1 $@
endif
wstest:
	$(MAKE) wsserver
	$(MAKE) SERVER=WSSERVER WSQUERY="?wsserver=$(WSSERVER_HOST)" httpserver
	$(MAKE) wsserver.stop
wstest.new:
	$(MAKE) SERVER=WSSERVER httpserver
%.pylint: %.py
	$(PYLINT) $<
pylint: $(SCRIPTS:.py=.pylint)
