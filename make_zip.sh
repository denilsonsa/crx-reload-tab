#!/bin/sh

rm -f crx-reload-tab.zip
zip -9Xr crx-reload-tab.zip \
	background.js \
	icon128.png \
	icon16.png \
	icon19.png \
	icon38.png \
	icon48.png \
	manifest.json \
	popup.html \
	popup.js
