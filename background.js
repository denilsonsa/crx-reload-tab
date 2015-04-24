'use strict';

// Note: Chrome provides an "alarms" API, but:
// * It requires an extra permission: "alarms"
// * The minimum interval is one minute.
// https://developer.chrome.com/extensions/alarms
//
// Since this extension has sub-minute reload intervals, the "alarms" API can't
// be used. That's why this extension uses a persistent background page with
// setInterval/setTimeout.

//////////////////////////////////////////////////////////////////////
// Internal data structure.

function Reload(tab_id, seconds) {
	this.tab_id = tab_id;
	this.seconds = seconds;
	this.badge_text = seconds_to_badge_text(seconds);
	this.timeout_id = null;
	this.interval_id = null;
}

Reload.prototype.reload_tab = function() {
	chrome.tabs.reload(this.tab_id);
};

Reload.prototype.set_chrome_badge = function() {
	chrome.browserAction.setBadgeText({
		text: this.badge_text,
		tabId: this.tab_id
	});
};

Reload.prototype.clear = function() {
	clearTimeout(this.timeout_id);
	this.timeout_id = null;
	clearInterval(this.interval_id);
	this.interval_id = null;
	this.badge_text = '';
	this.set_chrome_badge();
};

// Dictionary of currently active Reload objects.
// g_active_reloads[tab_id] -> Reload() object
var g_active_reloads = {};
var g_active_reloads_length = 0;

//////////////////////////////////////////////////////////////////////
// "External" API, called from popup.html.
//
// Essentially, manipulates g_active_reloads and calls the required functions.

// Deletes a reload for this tab_id.
// Does nothing if there is no reload for that tab.
function clear_reload(tab_id) {
	var x = g_active_reloads[tab_id];
	if (x) {
		x.clear();
		g_active_reloads_length--;
	}
	delete g_active_reloads[tab_id];
	set_or_clear_chrome_listeners();
}

// Clears all currently active reloads.
function clear_all_reloads() {
	var ids = Object.keys(g_active_reloads)
	for (var tab_id of ids) {
		console.log(tab_id);
		clear_reload(tab_id);
	}
	console.assert(g_active_reloads_length == 0);
}

// Sets a reload for a tab.
// Clears/deletes the previous reload for that tab before setting a new one.
function set_reload(tab_id, seconds) {
	clear_reload(tab_id);
	if (seconds > 0) {
		var x = new Reload(tab_id, seconds);
		g_active_reloads[tab_id] = x;
		g_active_reloads_length++;
		x.set_chrome_badge();
		x.interval_id = setInterval(x.reload_tab, seconds * 1000);
		set_or_clear_chrome_listeners();
	}
}

//////////////////////////////////////////////////////////////////////
// Misc.

function seconds_to_badge_text(seconds) {
	var minutes = Math.floor(seconds / 60);
	var hours = Math.floor(minutes / 60);
	var days = Math.floor(hours / 24);

	seconds = seconds % 60;
	minutes = minutes % 60;
	hours = hours % 24;

	if (days > 9) {
		return days + 'd';
	} else if (days > 0) {
		if (hours > 0) {
			return (days + (hours / 24.0)).toFixed(1) + 'd';
		} else {
			return days + 'd';
		}
	} else if (hours > 9) {
			return hours + 'h';
	} else if (hours > 0) {
		if (minutes > 9) {
			return hours + 'h' + minutes;
		} else if (minutes > 0) {
			return hours + 'h' + '0' + minutes;
		} else {
			return hours + 'h';
		}
	} else if (minutes > 0) {
		if (seconds > 9) {
			return minutes + '\'' + seconds;
		} else if (seconds > 0) {
			return minutes + '\'' + '0' + seconds;
		} else {
			return minutes + '\'';
		}
	} else if (seconds > 0) {
		return seconds + '"';
	} else {
		return '';
	}
}

//////////////////////////////////////////////////////////////////////
// Chrome listeners.

function tabs_onUpdated_handler(tab_id, change_info, tab) {
	console.log('onUpdated', tab_id, change_info);
	var x = g_active_reloads[tab_id];
	if (x) {
		if (change_info.status == 'loading') {
			// Reload the badge text for this tab.
			// It gets cleared whenever the tab gets reloaded or loads another
			// page; so the extension needs to keep re-setting the badge.
			x.set_chrome_badge();
		}
	}
}

function tabs_onRemoved_handler(tab_id, remove_info) {
	console.log('onRemoved', tab_id, remove_info);
	clear_reload(tab_id);
}

// Should be called immediately after g_active_reloads_length is changed.
// Clears the listeners if there is no active reload.
// Sets the listeners if one reload has been added.
function set_or_clear_chrome_listeners() {
	if (g_active_reloads_length == 0) {
		chrome.tabs.onUpdated.removeListener(tabs_onUpdated_handler);
		chrome.tabs.onRemoved.removeListener(tabs_onRemoved_handler);
	}
	else if (g_active_reloads_length == 1) {
		chrome.tabs.onUpdated.addListener(tabs_onUpdated_handler);
		chrome.tabs.onRemoved.addListener(tabs_onRemoved_handler);
	}
}
