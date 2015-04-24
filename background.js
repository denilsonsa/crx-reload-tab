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
	this.interval_id = null;
}

Reload.prototype.toString = function() {
	return 'Reload(' + this.tab_id + ', ' + this.seconds + ' /* text=' + this.badge_text + ', id=' + this.interval_id + ' */ )';
};

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
		set_or_clear_chrome_listeners();
	}
	delete g_active_reloads[tab_id];
}

// Clears all currently active reloads.
function clear_all_reloads() {
	var ids = Object.keys(g_active_reloads)
	for (var tab_id of ids) {
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
		x.interval_id = setInterval(function() {
			x.reload_tab();
		}, seconds * 1000);
		set_or_clear_chrome_listeners();
	}
}

// Returns the amount of seconds of a reload of a tab.
// Returns zero if no reload is set.
function get_reload(tab_id) {
	var x = g_active_reloads[tab_id];
	if (x) {
		return x.seconds;
	}
	return 0;
}

// Returns the number of active auto-reloads.
function get_how_many_reloads_are_active() {
	return g_active_reloads_length;
}

//////////////////////////////////////////////////////////////////////
// Misc.

function split_seconds(seconds) {
	var minutes = Math.floor(seconds / 60);
	var hours = Math.floor(minutes / 60);
	var days = Math.floor(hours / 24);

	return {
		'seconds': seconds % 60,
		'minutes': minutes % 60,
		'hours': hours % 24,
		'days': days
	};
}

function seconds_to_badge_text(seconds) {
	var x = split_seconds(seconds);

	if (x.days > 9) {
		return x.days + 'd';
	} else if (x.days > 0) {
		if (x.hours > 0) {
			// If 9 days and 23 hours, it gets rounded to 10.0.
			// I want it to display as '10d' instead of '10.0d'.
			let days = (x.days + (x.hours / 24.0)).toFixed(1);
			if (days.length > 3) {
				days = days.substring(0, days.indexOf('.'));
			}
			return days + 'd';
		} else {
			return x.days + 'd';
		}
	} else if (x.hours > 9) {
			return x.hours + 'h';
	} else if (x.hours > 0) {
		if (x.minutes > 9) {
			return x.hours + 'h' + x.minutes;
		} else if (x.minutes > 0) {
			return x.hours + 'h' + '0' + x.minutes;
		} else {
			return x.hours + 'h';
		}
	} else if (x.minutes > 0) {
		if (x.seconds > 9) {
			return x.minutes + '\'' + x.seconds;
		} else if (x.seconds > 0) {
			return x.minutes + '\'' + '0' + x.seconds;
		} else {
			return x.minutes + '\'';
		}
	} else if (x.seconds > 0) {
		return x.seconds + '"';
	} else {
		return '';
	}
}

//////////////////////////////////////////////////////////////////////
// Chrome listeners.

function tabs_onUpdated_handler(tab_id, change_info, tab) {
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
