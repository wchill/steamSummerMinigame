# Steam Summer 2015 Monster Minigame AutoScript #

## Purpose ##

This javascript automatically plays the 2015 Steam Summer minigame for you in a semi-optimal way.

It goes beyond the autoclicker scripts already out there. It will keep you in the lane where you'll make the most money, activate abilities as they are available and best apply, and possibly purchase upgrades and
powerups for you.

## Installation ##

### Tampermonkey ###

1. Open Tapermonkey's dashboard.
2. Click on the `Utilites` tab on the right.
3. Paste `https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js` into the text area, and click `Import`.
4. When the editor has loaded, press `Install` (*NOT* `Process with Chrome`).

### Greasemonkey ###

1. Navigate to `https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js`.
2. Right click on the page, and click `Save Page As`.
3. In the name text area at the top, remove the tailing `.js` and add `.user.js` to the end (this may be redundant in the future).
4. While Firefox is still open, open a File Manager of any sort, and navigate to the directory you saved the script.
5. Drag & drop the script file onto the Firefox window.
6. Press `Install`.

### Manual ###

##### Chrome #####
1. Open https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js
2. Select All, Copy.
3. Navigate to `http://steamcommunity.com/minigame/` and join or start a game.
4. Press `Ctrl + Shift + J`.
5. Paste into the javascript input, and hit `Enter`.

##### Firefox #####
1. Open https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js
2. Select All, Copy.
3. Navigate to `http://steamcommunity.com/minigame/` and join or start a game.
4. Press `Ctrl + Shift + K`.
5. Paste into the javascript input, and hit `Enter`.

##### Internet Explorer / Microsoft Edge #####
1. Open https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js
2. Select All, Copy.
3. Navigate to `http://steamcommunity.com/minigame/` and join or start a game.
4. Press `F12` and navigate to the `Console` tab.
5. Paste into the javascript input, and hit `Enter`.

To stop the manual script, type `window.clearTimeout(thingTimer);` into the console and hit `Enter`.

The game should now play itself, you should leave it running in the background. If you're not sure if it is auto-playing, try changing lanes. If it jumps back almost immediately, it's working.

## I want to contribute! ##

This project is open-source on github. There are different ways you can help

## TODO ##

- use abilities if available and a suitable target exists:
	 - Tactical Nuke on a Spawner if below 60% and above 30% of its health
	 - Metal Detector if a spawner death is imminent (predicted in > 2 and < 7 seconds)
	 - Decrease Cooldowns if another player used a long-cooldown ability < 10 seconds ago
	
- purchase abilities and upgrades intelligently
- automatically update the manual script by periodically checking https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js

## Experimental ##

These functions work as intended, but do not have a UI option to do the toggling.

- toggleText() to hide/show all text. Overrides all text options.
- toggleCritText() to hide/show crit text.
- stopFlinching() will stop flinching animations. These are not saved and will not be restored.
