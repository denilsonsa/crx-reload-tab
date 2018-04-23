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
	this.seconds = seconds;  // Interval in seconds
	this.next_reload_timestamp = Date.now() + 1000 * seconds;  // Milliseconds
	this.badge_interval_text = seconds_to_badge_text(seconds);
	this.interval_id = null;
}

Reload.prototype.toString = function() {
	return 'Reload(' + this.tab_id + ', ' + this.seconds + ' /* text=' + this.badge_interval_text + ', id=' + this.interval_id + ' */ )';
};

Reload.prototype.reload_tab = function() {
	this.next_reload_timestamp = Date.now() + 1000 * this.seconds;
	chrome.tabs.reload(this.tab_id);
};

Reload.prototype.set_chrome_badge = function() {
	var badge_text;
	var badge_color = '#204a87';
	if (!this.tab_id) {
		// Tab has been closed/removed.
		return;
	}
	if (!this.interval_id) {
		// Tab is no longer auto-reloading.
		badge_text = '';
	} else if (g_should_display_badge_countdown && this.next_reload_timestamp > 0) {
		badge_color = '#4e9a06';
		var delta = Math.round((this.next_reload_timestamp - Date.now()) / 1000);
		if (delta > 0) {
			badge_text = seconds_to_badge_text(delta);
		} else {
			badge_text = 'now';
		}
	} else {
		badge_text = this.badge_interval_text;
	}
	chrome.browserAction.setBadgeText({
		text: badge_text,
		tabId: this.tab_id
	});
	chrome.browserAction.setBadgeBackgroundColor({
		color: badge_color,
		tabId: this.tab_id
	});
};

Reload.prototype.clear = function() {
	clearInterval(this.interval_id);
	this.interval_id = null;
	this.next_reload_timestamp = 0;
	this.badge_interval_text = '';
	this.set_chrome_badge();
};


//////////////////////////////////////////////////////////////////////
// Global variables.

// Dictionary of currently active Reload objects.
// g_active_reloads[tab_id] -> Reload() object
var g_active_reloads = {};
var g_active_reloads_length = 0;

// To avoid setting event listeners twice.
var g_are_event_listeners_set = false;

// Used to update the badge every second.
var g_should_display_badge_countdown = true;  // This value is overwritten in init().
var g_badge_countdown_interval_id = null;

function update_chrome_badge_every_second() {
	var ids = Object.keys(g_active_reloads)
	for (var tab_id of ids) {
		var x = g_active_reloads[tab_id];
		if (x) {
			x.set_chrome_badge();
		}
	}
}


//////////////////////////////////////////////////////////////////////
// "External" API, called from popup.html.
//
// Essentially, manipulates g_active_reloads and calls the required functions.

// Deletes a reload for this tab_id.
// Does nothing if there is no reload for that tab.
function clear_reload(tab_id, has_the_tab_been_removed) {
	var x = g_active_reloads[tab_id];
	if (x) {
		if (has_the_tab_been_removed) {
			x.tab_id = null;
		}
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
		x.interval_id = setInterval(function() {
			x.reload_tab();
		}, seconds * 1000);
		x.set_chrome_badge();
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

// Stop the countdown display on the badge text.
function stop_badge_countdown() {
	if (g_badge_countdown_interval_id) {
		clearInterval(g_badge_countdown_interval_id);
		g_badge_countdown_interval_id = null;
	}
}

// Start the countdown display on the badge text (if it is enabled).
function start_badge_countdown() {
	stop_badge_countdown();
	if (g_should_display_badge_countdown) {
		g_badge_countdown_interval_id = setInterval(update_chrome_badge_every_second, 1000);
	}
}

//////////////////////////////////////////////////////////////////////
// Misc.

function split_seconds(seconds) {
	var minutes = Math.floor(seconds / 60);
	var hours = Math.floor(minutes / 60);
	var days = Math.floor(hours / 24);

	return {
		'seconds': Math.floor(seconds) % 60,
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
	clear_reload(tab_id, true);
}

// Should be called immediately after g_active_reloads_length is changed.
// Clears the listeners if there is no active reload.
// Sets the listeners if one reload has been added.
function set_or_clear_chrome_listeners() {
	if (g_active_reloads_length == 0) {
		chrome.tabs.onUpdated.removeListener(tabs_onUpdated_handler);
		chrome.tabs.onRemoved.removeListener(tabs_onRemoved_handler);
		stop_badge_countdown();
		g_are_event_listeners_set = false;
	}
	else if (g_active_reloads_length == 1 && !g_are_event_listeners_set) {
		chrome.tabs.onUpdated.addListener(tabs_onUpdated_handler);
		chrome.tabs.onRemoved.addListener(tabs_onRemoved_handler);
		start_badge_countdown();
		g_are_event_listeners_set = true;
	}
}

//////////////////////////////////////////////////////////////////////
// Context menu item.

function init_context_menu_items() {
	chrome.contextMenus.create({
		'id': 'toggle_countdown',
		'title': 'Show timer countdown',
		'type': 'checkbox',
		'checked': g_should_display_badge_countdown,
		'contexts': ['browser_action'],
	});
	chrome.contextMenus.onClicked.addListener(function(info, tab) {
		if (info.menuItemId === 'toggle_countdown') {
			g_should_display_badge_countdown = ! g_should_display_badge_countdown;
			chrome.contextMenus.update('toggle_countdown', {
				'checked': g_should_display_badge_countdown,
			});
			if (g_active_reloads_length > 0) {
				if (g_should_display_badge_countdown) {
					start_badge_countdown();
				} else {
					stop_badge_countdown();
				}
				update_chrome_badge_every_second();
			}
			chrome.storage.local.set({'should_display_badge_countdown': g_should_display_badge_countdown});
		}
	});
}

function init() {
	chrome.storage.local.get(['should_display_badge_countdown'], function(result) {
		var value = result.should_display_badge_countdown;
		if (value === undefined) {
			value = true;
		}
		g_should_display_badge_countdown = value;
		init_context_menu_items();
	});
}

init();
