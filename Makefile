# adapted from https://gitlab.com/Matrixcoffee/hello-world-debian-android.git
SHELL := /bin/bash
ANDROID_SDK_ROOT ?= /usr/lib/android-sdk
ANDROID_TOOLS := $(ANDROID_SDK_ROOT)/build-tools/debian
PLATFORM := /usr/lib/android-sdk/platforms/android-23/android.jar
SOURCES = $(wildcard src/com/jcomeau/cardboard_editor/*.java)
CLASSES = $(SOURCES:.java=.class)
MIN_SDK ?= 18
APPS := Keyboard Viewer

all: $(dirname $(SOURCES))/R.java $(APPS:=.apk)

edit:
	vi $(SOURCES) Makefile

%.apk: %.aligned.apk keystore.jks
	apksigner sign \
	 --ks keystore.jks \
	 --ks-key-alias androidkey \
	 --ks-pass pass:android \
	 --key-pass pass:android \
	 --out $@ $<

keystore.jks:
	keytool -genkeypair \
	 -keystore $@ \
	 -alias androidkey \
	 -validity 10000 \
	 -keyalg RSA \
	 -keysize 2048 \
	 -storepass android \
	 -keypass android

%.aligned.apk: %.unsigned.apk
	zipalign -f -p 4 $< $@

%.unsigned.apk: dex/classes.dex %.xml
	aapt package -f -v \
	 -F $@ \
	 -I $(PLATFORM) \
	 -M $(word 2, $^) \
	 -S res dex

dex:
	mkdir $@

dex/classes.dex: $(CLASSES) dex
	$(ANDROID_TOOLS)/dx \
	 --dex \
	 --verbose \
	 --min-sdk-version=$(MIN_SDK) \
	 --output=$@ src

%.class: %.java
	javac \
	 -bootclasspath $(PLATFORM) \
	 -classpath src \
	 -source 1.7 \
	 -target 1.7 \
	 $(SOURCES)

$(dirname $(SOURCES))/R.java: AndroidManifest.xml res/*
	aapt package \
	 -f \
	 -m \
	 -J src \
	 -S res \
	 -M AndroidManifest.xml \
	 -I $(PLATFORM)

clean:
	rm -vf	$(dirname $(SOURCES))/R.java \
	 $(dirname $(SOURCES))/*.class \
	 *.unsigned.apk \
	 *.aligned.apk \
	 dex/*.dex

distclean: clean
	[ ! -d dex ] || rmdir dex
	rm -vf *.apk

squeaky-clean: distclean
	@echo 'Warning! This will remove your signing keys!'
	@echo 'You have 5 seconds to press CTRL-C'
	@sleep 5
	rm -vf *.jks
