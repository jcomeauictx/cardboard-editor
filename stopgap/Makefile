SHELL := /bin/bash
PYTHON := python3
CHROME ?= $(shell which chromium chrome true | head -n 1)
BROWSER ?= $(CHROME)
GITHUB := https://github.com/jcomeauictx
LWH := $(GITHUB)/linux-wifi-hotspot
STRACE := # comment this line out to get trace
STRACE ?= strace -o strace.log -v -f -s256
# set up a Chromium profile named 'stopgap' to have a stable environment
PROFILE ?= $(shell $(PYTHON) profile.py '' stopgap)
ifeq ($(BROWSER),$(CHROME))
	BROWSE := $(BROWSER) --profile-directory="$(PROFILE)"
else ifeq ($(BROWSER),firefox)
	BROWSE := $(BROWSER) --private-window
else
	BROWSE := $(BROWSER)
endif
# run linux-wifi-hotspot to make this address work; otherwise use 127.0.0.1
# (127.0.0.1 will not work with remote of course; only for localhost testing)
LOCAL ?= 192.168.12.1
# since LOCAL is exported, must not use := in any assignments with it
NET = $(LOCAL:.1=.0)
# $(dir ($dir some/path/name)) doesn't work because `dir` leaves trailing /
SRC := $(shell dirname $(dir $(PWD)))
VALIDATOR ?= $(SRC)/validator/build/dist/vnu.jar
NETRC := $(HOME)/.netrc
ESSID := $(shell awk '$$2 " " $$3 ~ /^$(LOCAL) login$$/ {print $$4}' $(NETRC))
KEY := $(shell awk '$$2 " " $$5 ~ /^$(LOCAL) password$$/ {print $$6}' $(NETRC))
INTERFACE ?= wlp1s0  # may be wlan0 or something else entirely
AP_ROUTE := ip route | awk '$$1 " " $$NF ~ /^$(NET)\/24 $(LOCAL)$$/ {print $$3}'
# leave following line with a single `=` for later evaluation
AP = $(shell $(AP_ROUTE))
CREATE_AP := $(wildcard ../../linux-wifi-hotspot/src/scripts/create_ap)
# use frequency band 2.4 if you are connected to Internet over 5GHz
CREATE_AP_LOG := $(notdir $(CREATE_AP)).log
CREATE_AP_ARGS := --freq-band 2.4 --daemon \
 --logfile $(CREATE_AP_LOG) \
 $(INTERFACE) $(INTERFACE) $(ESSID) $(KEY)
HTTPSERVER := stopgap.py
HTTPSERVER_PORT := 8000
HTTPSERVER_HOST = $(LOCAL):$(HTTPSERVER_PORT)
HTTPSERVER_URL := http://$(HTTPSERVER_HOST)/stopgap.html
WSSERVER := wsserver.py
WSSERVER_PORT := 8080
WSSERVER_HOST = $(LOCAL):$(WSSERVER_PORT)
WSSERVER_URL := http://$(HTTPSERVER_HOST)/wsclient.html$(WSQUERY)
# for next few variables, use simple `=` to evaluate at runtime
SERVER = HTTPSERVER
PORT = $($(SERVER)_PORT)
HOST = $($(SERVER)_HOST)
URL = $($(SERVER)_URL)
PYLINT ?= $(shell which pylint pylint3 true | head -n 1)
SCRIPTS := $(wildcard *.py)
HTML := $(wildcard *.html)
CSS := $(wildcard *.css)
JSCRIPTS := $(filter-out eslint.config.js, $(wildcard *.js))
JSLINT := $(shell which eslint jshint jslint true | head -n 1)
JAVA := $(shell which java true | head -n 1)
VALIDATE := $(JAVA) -jar $(VALIDATOR) --Werror
ifneq ($(SHOWENV),)
	export
else
	export LOCAL
endif
all: lint doctest stop credentials create_ap httpserver
fast: stop credentials create_ap httpserver
iphone:
	$(MAKE) LOCAL=127.0.0.1 stop httpserver
xtest: xtest.py
	$(PYTHON) $<
debug: tkinter.debug
tkinter.debug:
	@echo .gdbinit will run xtest.py >&2
	@echo '`bt` for backtrace after segfault' >&2
	gdb $(PYTHON)
stop: create_ap.stop wsserver.stop httpserver.stop
create_ap.stop:
	if [ "$(AP)" ]; then sudo $(CREATE_AP) --stop $(AP); fi
	# in case that didn't work, kill hostapd instances
	# (if more than 1, phone remote won't be able to connect
	# (don't stop on failure, it may just have taken a little too
	#  long for the --stop command to work)
	-if [ "$$(pidof hostapd)" ]; then sudo kill $$(pidof hostapd); fi
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
	! lsof -itcp:$(HTTPSERVER_PORT) -t -stcp:listen
	! fuser $(HTTPSERVER_PORT)/tcp
	@echo launching $< as $@... >&2
	exec -a $@ $(STRACE) $(PYTHON) $< 2>&1 | tee $@.log || true &
	# give server a chance to start before launching browser
	while ! lsof -itcp:$(HTTPSERVER_PORT) -stcp:listen; do sleep 1; done
	-$(BROWSE) "$(URL)" >&2
	# prevent server stopping in case browser goes to background
	read -p '<ENTER> when done: '
	$(MAKE) stop
wsserver: $(WSSERVER)
	# check for port in use before starting, see notes under `httpserver:`
	! lsof -itcp:$(WSSERVER_PORT)
	! fuser $(WSSERVER_PORT)/tcp
	exec -a $@ $(PYTHON) $< || true &
	@echo wsserver launched
env:
ifneq ($(SHOWENV),)
	$@
else
	$(MAKE) SHOWENV=1 $@
endif
wstest:
	$(MAKE) LOCAL=127.0.0.1 wsserver
	$(MAKE) LOCAL=127.0.0.1 SERVER=WSSERVER WSQUERY="?wsserver=$(WSSERVER_HOST)" httpserver
	$(MAKE) LOCAL=127.0.0.1 wsserver.stop
wstest.new:
	$(MAKE) SERVER=WSSERVER httpserver
%.pylint: %.py
	$(PYLINT) $<
%.doctest: %.py
	$(PYTHON) -m doctest $<
%.jslint: %.js
	$(JSLINT) $<
%.html.weblint: %.html
	$(VALIDATE) $<
%.css.weblint: %.css
	$(VALIDATE) --css $<
pylint: $(SCRIPTS:.py=.pylint)
doctest: $(SCRIPTS:.py=.doctest)
eslint: $(JSCRIPTS:.js=.jslint)
weblint: $(HTML:.html=.html.weblint) $(CSS:.css=.css.weblint)
lint: pylint eslint weblint
$(CREATE_AP):
	@echo 'You will need to `git clone $(LWH)` to $(SRC)'
credentials:
	@if [ -z "$(ESSID)" -o -z "$(KEY)" ]; then \
	 echo You will need to create an entry in $(NETRC): >&2; \
	 echo '"machine $(LOCAL) login ESSID password KEY"' >&2; \
	 echo 'choosing ESSID and KEY (password) that you can remember' >&2; \
	 false; \
	fi
create_ap:
	@echo 'Creating personal AP "$(ESSID)" for use by stopgap editor' >&2
	@if [ -z "$(AP)" ]; then \
	 sudo $(CREATE_AP) $(CREATE_AP_ARGS); \
	fi
	while [ -z "$$($(AP_ROUTE))" ]; do sleep 1; done
	ip route | awk '$$1 ~ /^$(NET)\/24$$/ {print}'
edit:
	vi stopgap.{js,css,html,py} Makefile
