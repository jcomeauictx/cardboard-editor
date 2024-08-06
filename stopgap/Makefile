SHELL := /bin/bash
CHROME ?= $(shell which chromium chrome true | head -n 1)
BROWSER ?= $(CHROME)
GITHUB := https://github.com/jcomeauictx
LWH := $(GITHUB)/linux-wifi-hotspot
ifeq ($(BROWSER),$(CHROME))
	BROWSE := $(BROWSER) --temp-profile
else ifeq ($(BROWSER),firefox)
	BROWSE := $(BROWSER) --private-window
else
	BROWSE := $(BROWSER)
endif
# run linux-wifi-hotspot to make this address work; otherwise use 127.0.0.1
LOCAL ?= 192.168.12.1
# $(dir ($dir some/path/name)) doesn't work because `dir` leaves trailing /
SRC := $(shell dirname $(dir $(PWD)))
NETRC := $(HOME)/.netrc
ESSID := $(shell awk '$$2 " " $$3 ~ /^$(LOCAL) login$$/ {print $$4}' $(NETRC))
KEY := $(shell awk '$$2 " " $$5 ~ /^$(LOCAL) password$$/ {print $$6}' $(NETRC))
INTERFACE ?= wlp1s0  # may be wlan0 or something else entirely
CREATE_AP := $(wildcard ../../linux-wifi-hotspot/src/scripts/create_ap)
# use frequency band 2.4 if you are connected to Internet over 5GHz
CREATE_AP_LOG := $(notdir $(CREATE_AP)).log
CREATE_AP_PID := $(CREATE_AP_LOG:.log=.pid.log)
CREATE_AP_ARGS := --freq-band 2.4 --daemon \
 --logfile $(CREATE_AP_LOG) --pidfile $(CREATE_AP_PID) \
 $(INTERFACE) $(INTERFACE) $(ESSID) $(KEY)
AP_UP = $$(ip link | awk '$$2 " " $$8 " " $$9 ~ /^ap1: state UP$$/ {print}')
HTTPSERVER := stopgap.py
HTTPSERVER_PORT := 8000
HTTPSERVER_HOST := $(LOCAL):$(HTTPSERVER_PORT)
HTTPSERVER_URL := http://$(HTTPSERVER_HOST)/stopgap.html
WSSERVER := wsserver.py
WSSERVER_PORT := 8080
WSSERVER_HOST := $(LOCAL):$(WSSERVER_PORT)
WSSERVER_URL := http://$(HTTPSERVER_HOST)/wsclient.html$(WSQUERY)
# for next few variables, use simple `=` to evaluate at runtime
SERVER = HTTPSERVER
PORT = $($(SERVER)_PORT)
HOST = $($(SERVER)_HOST)
URL = $($(SERVER)_URL)
PYTHON ?= python3
PYLINT ?= $(shell which pylint pylint3 true | head -n 1)
SCRIPTS := $(wildcard *.py)
JSCRIPTS := $(filter-out eslint.config.js, $(wildcard *.js))
JSLINT := $(shell which eslint jshint jslint true | head -n 1)
ifneq ($(SHOWENV),)
	export
else
	export LOCAL
endif
all: stop lint credentials create_ap wait_ap httpserver
xtest: xtest.py
	$(PYTHON) $<
debug: tkinter.debug
tkinter.debug:
	@echo .gdbinit will run xtest.py >&2
	@echo '`bt` for backtrace after segfault' >&2
	gdb $(PYTHON)
stop: create_ap.stop wsserver.stop httpserver.stop
create_ap.stop:
	if [ -s "$(CREATE_AP_PID)" ]; then \
	 kill $$(sudo cat $(CREATE_AP_PID)); \
	fi
%.stop:
	if [ "$$(pidof $*)" ]; then \
	 echo killing $* >&2; \
	 kill $$(pidof $*); \
	else \
	 echo $* is already not running >&2; \
	fi
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
%.jslint: %.js
	$(JSLINT) $<
pylint: $(SCRIPTS:.py=.pylint)
eslint: $(JSCRIPTS:.js=.jslint)
lint: pylint eslint
$(CREATE_AP):
	@echo 'You will need to `git clone $(LWH)` to $(SRC)'
credentials:
	if [ -z "$(ESSID)" -o -z "$(KEY)" ]; then \
	 echo You will need to create an entry in $(NETRC): >&2; \
	 echo '"machine $(LOCAL) login ESSID password KEY"' >&2; \
	 echo 'choosing ESSID and KEY (password) that you can remember' >&2; \
	 false; \
	fi
create_ap:
	if [ -z "$(AP_UP)" ]; then \
	 sudo $(CREATE_AP) $(CREATE_AP_ARGS); \
	fi
wait_ap:
	while [ -z "$(AP_UP)" ]; do sleep 1; done
