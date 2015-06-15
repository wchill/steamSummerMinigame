// ==UserScript==
// @name /u/wchill Monster Minigame Auto-script w/ auto-click
// @namespace https://github.com/wchill/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @version 4.1.0
// @match *://steamcommunity.com/minigame/towerattack*
// @match *://steamcommunity.com//minigame/towerattack*
// @grant none
// @updateURL https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.user.js
// @downloadURL https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.user.js
// ==/UserScript==

// IMPORTANT: Update the @version property above to a higher number such as 1.1 and 1.2 when you update the script! Otherwise, Tamper / Greasemonkey users will not update automatically.

(function(w) {
"use strict";

//Version displayed to client, update along with the @version above
var SCRIPT_VERSION = '4.1.0';

// OPTIONS
var clickRate = 20;
var logLevel = 1; // 5 is the most verbose, 0 disables all log

var enableAutoClicker = getPreferenceBoolean("enableAutoClicker", true);

var removeInterface = getPreferenceBoolean("removeInterface", true); // get rid of a bunch of pointless DOM var removeParticles = getPreferenceBoolean("removeParticles", true);
var removeParticles = getPreferenceBoolean("removeParticles", true);
var removeFlinching = getPreferenceBoolean("removeFlinching", true);
var removeCritText = getPreferenceBoolean("removeCritText", false);
var removeGoldText = getPreferenceBoolean("removeGoldText", false);
var removeAllText = getPreferenceBoolean("removeAllText", false);
var enableAutoRefresh = getPreferenceBoolean("enableAutoRefresh", typeof GM_info !== "undefined");
var enableFingering = getPreferenceBoolean("enableFingering", true);
var disableRenderer = getPreferenceBoolean("disableRenderer", false);
var enableAutoUpdate = getPreferenceBoolean("enableAutoUpdate", true);

var enableElementLock = getPreferenceBoolean("enableElementLock", true);

var autoRefreshMinutes = 30; // refresh page after x minutes
var autoRefreshMinutesRandomDelay = 10;
var autoRefreshSecondsCheckLoadedDelay = 30;

// DO NOT MODIFY
var isAlreadyRunning = false;
var refreshTimer = null;
var currentClickRate = clickRate;
var lockedElement = -1;
var lastLevel = 0;
var trt_oldCrit = function() {};
var trt_oldPush = function() {};
var trt_oldRender = function() {};

var control = {
	speedThreshold: 5000,
	rainingRounds: 250,
	timePerUpdate: 60000,
	useSlowMode: false,
	minsLeft: 30,
	allowWormholeLevel: 25000
};

var remoteControlURL = "http://steamcommunity.com/groups/MSG2015/discussions/0/598198356173574660";
var remoteControlURL2 = "http://steamcommunity.com/groups/MSG2015/discussions/0/598198356175571067";
var showedUpdateInfo = getPreferenceBoolean("showedUpdateInfo", false);

var UPGRADES = {
	LIGHT_ARMOR: 0,
	AUTO_FIRE_CANNON: 1,
	ARMOR_PIERCING_ROUND: 2,
	DAMAGE_TO_FIRE_MONSTERS: 3,
	DAMAGE_TO_WATER_MONSTERS: 4,
	DAMAGE_TO_AIR_MONSTERS: 5,
	DAMAGE_TO_EARTH_MONSTERS: 6,
	LUCKY_SHOT: 7,
	HEAVY_ARMOR: 8,
	ADVANCED_TARGETING: 9,
	EXPLOSIVE_ROUNDS: 10,
	MEDICS: 11,
	MORALE_BOOSTER: 12,
	GOOD_LUCK_CHARMS: 13,
	METAL_DETECTOR: 14,
	DECREASE_COOLDOWNS: 15,
	TACTICAL_NUKE: 16,
	CLUSTER_BOMB: 17,
	NAPALM: 18,
	BOSS_LOOT: 19,
	ENERGY_SHIELDS: 20,
	FARMING_EQUIPMENT: 21,
	RAILGUN: 22,
	PERSONAL_TRAINING: 23,
	AFK_EQUIPMENT: 24,
	NEW_MOUSE_BUTTON: 25
};

var ABILITIES = {
	FIRE_WEAPON: 1,
	CHANGE_LANE: 2,
	RESPAWN: 3,
	CHANGE_TARGET: 4,
	MORALE_BOOSTER: 5,
	GOOD_LUCK_CHARMS: 6,
	MEDICS: 7,
	METAL_DETECTOR: 8,
	DECREASE_COOLDOWNS: 9,
	TACTICAL_NUKE: 10,
	CLUSTER_BOMB: 11,
	NAPALM: 12,
	RESURRECTION: 13,
	CRIPPLE_SPAWNER: 14,
	CRIPPLE_MONSTER: 15,
	MAX_ELEMENTAL_DAMAGE: 16,
	RAINING_GOLD: 17,
	CRIT: 18,
	PUMPED_UP: 19,
	THROW_MONEY_AT_SCREEN: 20,
	GOD_MODE: 21,
	TREASURE: 22,
	STEAL_HEALTH: 23,
	REFLECT_DAMAGE: 24,
	FEELING_LUCKY: 25,
	WORMHOLE: 26,
	LIKE_NEW: 27
};
var BOSS_DISABLED_ABILITIES = ['MORALE_BOOSTER', 'GOOD_LUCK_CHARMS', 'TACTICAL_NUKE', 'CLUSTER_BOMB', 'NAPALM', 'CRIT', 'CRIPPLE_SPAWNER', 'CRIPPLE_MONSTER', 'MAX_ELEMENTAL_DAMAGE', 'REFLECT_DAMAGE', 'THROW_MONEY_AT_SCREEN'];

var ENEMY_TYPE = {
	"SPAWNER": 0,
	"CREEP": 1,
	"BOSS": 2,
	"MINIBOSS": 3,
	"TREASURE": 4
};

disableParticles();

function s() {
	return w.g_Minigame.m_CurrentScene;
}

function firstRun() {
	advLog("Starting /u/wchill's script (version " + SCRIPT_VERSION + ")", 1);

	trt_oldCrit = s().DoCritEffect;
	trt_oldPush = s().m_rgClickNumbers.push;
	trt_oldRender = w.g_Minigame.Render;

	updateControlData();

	w.controlUpdateTimer = w.setInterval(function() {
		updateControlData();
	}, control.timePerUpdate);

	if (enableElementLock) {
		lockElements();
	}

	// disable particle effects - this drastically reduces the game's memory leak
	if (removeParticles) {
		disableParticles();
	}

	// disable enemy flinching animation when they get hit
	if (removeFlinching) {
		if (CEnemy !== undefined) {
			CEnemy.prototype.TakeDamage = function() {};
			CEnemySpawner.prototype.TakeDamage = function() {};
			CEnemyBoss.prototype.TakeDamage = function() {};
		}
	}

	if (removeCritText) {
		toggleCritText();
	}

	if (removeAllText) {
		toggleAllText();
	}

	var node = document.getElementById("abilities");

	if (node) {
		node.style.textAlign = 'left';
	}

	if (removeInterface) {
		var node = document.getElementById("global_header");
		if (node && node.parentNode) {
			node.parentNode.removeChild(node);
		}
		node = document.getElementById("footer");
		if (node && node.parentNode) {
			node.parentNode.removeChild(node);
		}
		node = document.getElementById("footer_spacer");
		if (node && node.parentNode) {
			node.parentNode.removeChild(node);
		}
		node = document.querySelector(".pagecontent");
		if (node) {
			node.style["padding-bottom"] = 0;
		}

		document.body.style.backgroundPosition = "0 0";
	}

	if (enableAutoRefresh) {
		autoRefreshPage(autoRefreshMinutes);
	}

	if (enableFingering) {
		startFingering();
	}

	if (disableRenderer) {
		toggleRenderer();
	}

	if (w.CSceneGame !== undefined) {
		w.CSceneGame.prototype.DoScreenShake = function() {};
	}

	fixActiveCapacityUI();

	// Easter egg button
	var egg = document.createElement("span");
	egg.className = "toggle_music_btn";
	egg.innerText = "Easter Egg";
	egg.onclick = function() {
		SmackTV();
	};
	document.querySelector(".game_options").insertBefore(egg, document.querySelector(".leave_game_btn"));

	// Add "players in game" label
	var titleActivity = document.querySelector('.title_activity');
	var playersInGame = document.createElement('span');
	playersInGame.innerHTML = '<span id=\"players_in_game\">0/1500</span>&nbsp;Players in room<br>';

	titleActivity.insertBefore(playersInGame, titleActivity.firstChild);

	// Fix alignment
	var activity = document.getElementById("activitylog");
	activity.style.marginTop = "33px";

	var options_box = document.querySelector(".leave_game_helper");
	if(!options_box) {
		options_box = document.querySelector(".options_box");
	}
	options_box.innerHTML = '<b>OPTIONS</b> (v' + SCRIPT_VERSION + ')<br>Settings marked with a <span style="color:#FF5252;font-size:22px;line-height:4px;vertical-align:bottom;">*</span> requires a refresh to take effect.<hr>';

	// reset the CSS for the info box for aesthetics
	options_box.className = "options_box";
	options_box.style.backgroundColor = "#000000";
	options_box.style.width = "600px";
	options_box.style.top = "73px";
	options_box.style.padding = "12px";
	options_box.style.position = "absolute";
	options_box.style.boxShadow = "2px 2px 0 rgba( 0, 0, 0, 0.6 )";
	options_box.style.color = "#ededed";

	var options1 = document.createElement("div");
	options1.style["-moz-column-count"] = 3;
	options1.style["-webkit-column-count"] = 3;
	options1.style["column-count"] = 3;
	options1.style.width = "100%";
	options1.style.float = "left";

	options1.appendChild(makeCheckBox("enableAutoClicker", "Enable autoclicker", enableAutoClicker, toggleAutoClicker, false));
	options1.appendChild(makeCheckBox("removeInterface", "Remove interface", removeInterface, handleEvent, true));
	options1.appendChild(makeCheckBox("removeParticles", "Remove particle effects", removeParticles, handleEvent, true));
	options1.appendChild(makeCheckBox("removeFlinching", "Remove flinching effects", removeFlinching, handleEvent, true));
	options1.appendChild(makeCheckBox("removeCritText", "Remove crit text", removeCritText, toggleCritText, false));
	options1.appendChild(makeCheckBox("removeGoldText", "Remove gold text", removeGoldText, handleEvent, false));
	options1.appendChild(makeCheckBox("removeAllText", "Remove all text", removeAllText, toggleAllText, false));
	options1.appendChild(makeCheckBox("disableRenderer", "Throttle game renderer", disableRenderer, toggleRenderer, false));
	options1.appendChild(makeCheckBox("enableAutoUpdate", "Enable script auto update", enableAutoUpdate, toggleAutoUpdate, false));
	options_box.appendChild(options1);

	if (typeof GM_info !== "undefined") {
		options1.appendChild(makeCheckBox("enableAutoRefresh", "Enable auto-refresh (mitigate memory leak)", enableAutoRefresh, toggleAutoRefresh, false));
	}

	options1.appendChild(makeCheckBox("enableFingering", "Enable targeting pointer", enableFingering, handleEvent, true));
	options1.appendChild(makeNumber("setLogLevel", "Change the log level", "25px", logLevel, 0, 5, updateLogLevel));

	options_box.appendChild(options1);

	//Elemental upgrades lock
	var ab_box = document.getElementById("abilities");
	var lock_elements_box = document.createElement("div");
	lock_elements_box.className = "lock_elements_box";
	lock_elements_box.style.width = "165px";
	lock_elements_box.style.top = "-76px";
	lock_elements_box.style.left = "303px";
	lock_elements_box.style.boxSizing = "border-box";
	lock_elements_box.style.lineHeight = "1rem";
	lock_elements_box.style.padding = "7px 10px";
	lock_elements_box.style.position = "absolute";
	lock_elements_box.style.color = "#ededed";
	lock_elements_box.title = "To maximise team damage players should max only one element. But distributions of elements through people should be equal. So we calculated your element using your unique ID. Upgrade your element to make maximum performance or disable this checkbox.";
	var lock_elements_checkbox = makeCheckBox("enableElementLock", "Lock element upgrades for more team dps", enableElementLock, toggleElementLock, false);
	lock_elements_box.appendChild(lock_elements_checkbox);
	ab_box.appendChild(lock_elements_box);

	enhanceTooltips();
}

function fixActiveCapacityUI() {
    $J('.tv_ui').css('background-image', 'url(http://i.imgur.com/ieDoLnx.png)');
    $J('#activeinlanecontainer').css('height', '154px');
    $J('#activitycontainer').css('height', '270px');
    $J('#activityscroll').css('height', '270px');
}

function disableParticles() {
	if (w.CSceneGame) {
		w.CSceneGame.prototype.DoScreenShake = function() {};

		if (removeParticles) {
			w.CSceneGame.prototype.SpawnEmitter = function(emitter) {
				emitter.emit = false;
				return emitter;
			};
		}
	}
}

function isNearEndGame() {
	var cTime = new Date();
	var cHours = cTime.getUTCHours();
	var cMins = cTime.getUTCMinutes();
	var timeLeft = 60 - cMins;
	if (cHours == 15 && timeLeft <= control.minsLeft) {
		return true;
	} else {
		return false;
	}
}

function MainLoop() {
	if (!isAlreadyRunning) {
		isAlreadyRunning = true;

		var level = getGameLevel();
		if (level < 10 && control.useSlowMode) {
			return;
		}

		attemptRespawn();
		goToLaneWithBestTarget();
		useCooldownIfRelevant();
		useGoodLuckCharmIfRelevant();
		useMedicsIfRelevant();
		useMoraleBoosterIfRelevant();
		useMetalDetectorIfRelevant();
		useClusterBombIfRelevant();
		useNapalmIfRelevant();
		useTacticalNukeIfRelevant();
		useCrippleMonsterIfRelevant();
		useCrippleSpawnerIfRelevant();
		if (level < control.speedThreshold || level % control.rainingRounds == 0) {
			useGoldRainIfRelevant();
		}
		useCrippleMonsterIfRelevant(level);
		useReviveIfRelevant(level);
		useMaxElementalDmgIfRelevant();
		useWormholeIfRelevant();
		updatePlayersInGame();

		if (level !== lastLevel) {
			lastLevel = level;

			refreshPlayerData();
		}

		s().m_nClicks = currentClickRate;
		s().m_nLastTick = false;
		g_msTickRate = 1000;

		var damagePerClick = s().CalculateDamage(
			s().m_rgPlayerTechTree.damage_per_click,
			s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].element
		);

		advLog("Ticked. Current clicks per second: " + currentClickRate + ". Current damage per second: " + (damagePerClick * currentClickRate), 4);

		/*
		if(disableRenderer) {
		  s().Tick();

		  requestAnimationFrame(function() {
		    w.g_Minigame.Renderer.render(s().m_Container);
		  });
		}*/

		isAlreadyRunning = false;

		var enemy = s().GetEnemy(
			s().m_rgPlayerData.current_lane,
			s().m_rgPlayerData.target);

		if (currentClickRate > 0) {

			if (enemy) {
				displayText(
					enemy.m_Sprite.position.x - (enemy.m_nLane * 440),
					enemy.m_Sprite.position.y - 52,
					"-" + FormatNumberForDisplay((damagePerClick * currentClickRate), 5),
					"#aaf"
				);

				if (s().m_rgStoredCrits.length > 0) {
					var rgDamage = s().m_rgStoredCrits.reduce(function(a, b) {
						return a + b;
					});
					s().m_rgStoredCrits.length = 0;

					s().DoCritEffect(rgDamage, enemy.m_Sprite.position.x - (enemy.m_nLane * 440), enemy.m_Sprite.position.y + 17, 'Crit!');
				}

				var goldPerClickPercentage = s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].active_player_ability_gold_per_click;
				if (goldPerClickPercentage > 0 && enemy.m_data.hp > 0) {
					var goldPerSecond = enemy.m_data.gold * goldPerClickPercentage * currentClickRate;
					s().ClientOverride('player_data', 'gold', s().m_rgPlayerData.gold + goldPerSecond);
					s().ApplyClientOverrides('player_data', true);
					advLog(
						"Raining gold ability is active in current lane. Percentage per click: " + goldPerClickPercentage + "%. Approximately gold per second: " + goldPerSecond,
						4
					);
					if (!removeGoldText) {
						displayText(
							enemy.m_Sprite.position.x - (enemy.m_nLane * 440),
							enemy.m_Sprite.position.y - 17,
							"+" + FormatNumberForDisplay(goldPerSecond, 5),
							"#e1b21e"
						);
					}
				}
			}
		}
	}
}

function refreshPlayerData() {
	advLog("Refreshing player data", 2);

	w.g_Server.GetPlayerData(
		function(rgResult) {
			var instance = s();

			if (rgResult.response.player_data) {
				instance.m_rgPlayerData = rgResult.response.player_data;
				instance.ApplyClientOverrides('player_data');
				instance.ApplyClientOverrides('ability');
			}

			if (rgResult.response.tech_tree) {
				instance.m_rgPlayerTechTree = rgResult.response.tech_tree;
				if (rgResult.response.tech_tree.upgrades) {
					instance.m_rgPlayerUpgrades = w.V_ToArray(rgResult.response.tech_tree.upgrades);
				} else {
					instance.m_rgPlayerUpgrades = [];
				}
			}

			instance.OnReceiveUpdate();
		},
		function() {},
		true
	);
}

function makeNumber(name, desc, width, value, min, max, listener) {
	var label = document.createElement("label");
	var description = document.createTextNode(desc);
	var number = document.createElement("input");

	number.type = "number";
	number.name = name;
	number.style.width = width;
	number.style.marginRight = "5px";
	number.value = value;
	number.min = min;
	number.max = max;
	number.onchange = listener;
	w[number.name] = number;

	label.appendChild(number);
	label.appendChild(description);
	label.appendChild(document.createElement("br"));
	return label;
}

function makeCheckBox(name, desc, state, listener, reqRefresh) {
	var asterisk = document.createElement('span');
	asterisk.appendChild(document.createTextNode("*"));
	asterisk.style.color = "#FF5252";
	asterisk.style.fontSize = "22px";
	asterisk.style.lineHeight = "14px";
	asterisk.style.verticalAlign = "bottom";

	var label = document.createElement("label");
	var description = document.createTextNode(desc);
	var checkbox = document.createElement("input");

	checkbox.type = "checkbox";
	checkbox.name = name;
	checkbox.checked = state;
	checkbox.onclick = listener;
	w[checkbox.name] = checkbox.checked;

	label.appendChild(checkbox);
	label.appendChild(description);
	if (reqRefresh) {
		label.appendChild(asterisk);
	}
	label.appendChild(document.createElement("br"));
	return label;

}

function handleEvent(event) {
	handleCheckBox(event);
}

function autoRefreshPage(autoRefreshMinutes) {
	var timerValue = (autoRefreshMinutes + autoRefreshMinutesRandomDelay * Math.random()) * 60 * 1000;
	refreshTimer = setTimeout(function() {
		autoRefreshHandler();
	}, timerValue);
}

function autoRefreshHandler() {
	var enemyData = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target).m_data;
	if (typeof enemyData !== "undefined") {
		var enemyType = enemyData.type;
		if (enemyType != ENEMY_TYPE.BOSS) {
			advLog('Refreshing, not boss', 5);
			w.location.reload(true);
		} else {
			advLog('Not refreshing, A boss!', 5);
			setTimeout(autoRefreshHandler, 3000);
		}
	} else {
		//Wait until it is defined
		setTimeout(autoRefreshHandler, 1000);
	}
}

function handleCheckBox(event) {
	var checkbox = event.target;
	setPreference(checkbox.name, checkbox.checked);

	w[checkbox.name] = checkbox.checked;
	return checkbox.checked;
}

function toggleAutoClicker(event) {
	var value = enableAutoClicker;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value) {
		currentClickRate = clickRate;
	} else {
		currentClickRate = 0;
	}
}

function toggleAutoUpdate(event) {
	var value = enableAutoUpdate;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value && !showedUpdateInfo) {
		alert("PLEASE NOTE: This release has auto update functionality enabled by default. This does " + "come with a security implications and while you should be okay, it's still important " + "that you know about it. If you wish to disable it, simply uncheck the checkbox in options. " + "If you have questions, please contact /u/wchill.");
		setPreference("showedUpdateInfo", true);
	}
}

function toggleAutoRefresh(event) {
	var value = enableAutoRefresh;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value) {
		autoRefreshPage(autoRefreshMinutes);
	} else {
		clearTimeout(refreshTimer);
	}
}

/*
function toggleRenderer(event) {
	var value = disableRenderer;

	if (event !== undefined) {
		value = disableRenderer = handleCheckBox(event);
	}

	var ticker = w.PIXI.ticker.shared;

	if (!value) {
		ticker.autoStart = true;
		ticker.start();

		w.g_Minigame.Render = trt_oldRender;
		w.g_Minigame.Render();
	} else {
		ticker.autoStart = false;
		ticker.stop();

		w.g_Minigame.Render = function() {};
	}
}
*/

function toggleRenderer(event) {
	var value = disableRenderer;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}

	if (value) {
		w.g_Minigame.Renderer.render = function() {}
	} else {
		w.g_Minigame.Renderer.render = trt_oldRender;
	}
}

function toggleElementLock(event) {
	var value = enableElementLock;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value) {
		lockElements();
	} else {
		unlockElements();
	}
}

function toggleCritText(event) {
	var value = removeCritText;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value) {
		// Replaces the entire crit display function.
		s().DoCritEffect = function(nDamage, x, y, additionalText) {};
	} else {
		s().DoCritEffect = trt_oldCrit;
	}
}

function toggleAllText(event) {
	var value = removeAllText;
	if (event !== undefined) {
		value = handleCheckBox(event);
	}
	if (value) {
		// Replaces the entire text function.
		s().m_rgClickNumbers.push = function(elem) {
			elem.container.removeChild(elem);
		};
	} else {
		s().m_rgClickNumbers.push = trt_oldPush;
	}
}

function updateLogLevel(event) {
	if (event !== undefined) {
		logLevel = event.target.value;
	}
}

function setPreference(key, value) {
	try {
		if (localStorage !== 'undefined') {
			localStorage.setItem('steamdb-minigame/' + key, value);
		}
	} catch (e) {
		console.log(e); // silently ignore error
	}
}

function getPreference(key, defaultValue) {
	try {
		if (localStorage !== 'undefined') {
			var result = localStorage.getItem('steamdb-minigame/' + key);
			return (result !== null ? result : defaultValue);
		}
	} catch (e) {
		console.log(e); // silently ignore error
		return defaultValue;
	}
}

function getPreferenceBoolean(key, defaultValue) {
	return (getPreference(key, defaultValue.toString()) == "true");
}

function unlockElements() {
	var fire = document.querySelector("a.link.element_upgrade_btn[data-type=\"3\"]");
	var water = document.querySelector("a.link.element_upgrade_btn[data-type=\"4\"]");
	var air = document.querySelector("a.link.element_upgrade_btn[data-type=\"5\"]");
	var earth = document.querySelector("a.link.element_upgrade_btn[data-type=\"6\"]");

	var elems = [fire, water, air, earth];

	for (var i = 0; i < elems.length; i++) {
		elems[i].style.visibility = "visible";
	}
}

function lockElements() {
	var elementMultipliers = [
		s().m_rgPlayerTechTree.damage_multiplier_fire,
		s().m_rgPlayerTechTree.damage_multiplier_water,
		s().m_rgPlayerTechTree.damage_multiplier_air,
		s().m_rgPlayerTechTree.damage_multiplier_earth
	];

	var hashCode = function(str) {
		var t = 0,
			i, char;
		if (0 === str.length) {
			return t;
		}

		for (i = 0; i < str.length; i++) {
			char = str.charCodeAt(i);
			t = (t << 5) - t + char;
			t &= t;
		}

		return t;
	};

	var elem = Math.abs(hashCode(w.g_steamID) % 4);

	// If more than two elements are leveled to 3 or higher, do not enable lock
	var leveled = 0;
	var lastLeveled = -1;

	for (var i = 0; i < elementMultipliers.length; i++) {
		advLog("Element " + i + " is at level " + (elementMultipliers[i] - 1) / 1.5, 3);
		if ((elementMultipliers[i] - 1) / 1.5 >= 3) {
			leveled++;
			// Only used if there is only one so overwriting it doesn't matter
			lastLeveled = i;
		}
	}

	if (leveled >= 2) {
		advLog("More than 2 elementals leveled to 3 or above, not locking.", 1);
		return;
	} else if (leveled == 1) {
		advLog("Found existing lock on " + lastLeveled + ", locking to it.", 1);
		lockToElement(lastLeveled);
	} else {
		advLog("Locking to element " + elem + " as chosen by SteamID", 1);
		lockToElement(elem);
	}
}

function lockToElement(element) {
	var fire = document.querySelector("a.link.element_upgrade_btn[data-type=\"3\"]");
	var water = document.querySelector("a.link.element_upgrade_btn[data-type=\"4\"]");
	var air = document.querySelector("a.link.element_upgrade_btn[data-type=\"5\"]");
	var earth = document.querySelector("a.link.element_upgrade_btn[data-type=\"6\"]");

	var elems = [fire, water, air, earth];

	for (var i = 0; i < elems.length; i++) {
		if (i === element) {
			continue;
		}
		elems[i].style.visibility = "hidden";
	}
	lockedElement = element; // Save locked element.
}

function displayText(x, y, strText, color) {
	var text = new w.PIXI.Text(strText, {
		font: "35px 'Press Start 2P'",
		fill: color,
		stroke: '#000',
		strokeThickness: 2
	});

	text.x = x;
	text.y = y;

	s().m_containerUI.addChild(text);
	text.container = s().m_containerUI;

	var e = new CEasingSinOut(text.y, -200, 1000);
	e.parent = text;
	text.m_easeY = e;

	e = new CEasingSinOut(2, -2, 1000);
	e.parent = text;
	text.m_easeAlpha = e;

	s().m_rgClickNumbers.push(text);
}

function updatePlayersInGame() {
	var totalPlayers = s().m_rgLaneData[0].players +
		s().m_rgLaneData[1].players +
		s().m_rgLaneData[2].players;
	document.getElementById("players_in_game").innerHTML = totalPlayers + "/1500";
}

function goToLaneWithBestTarget() {
	// We can overlook spawners if all spawners are 40% hp or higher and a creep is under 10% hp
	var spawnerOKThreshold = 0.4;
	var creepSnagThreshold = 0.1;

	var targetFound = false;
	var lowHP = 0;
	var lowLane = 0;
	var lowTarget = 0;
	var lowPercentageHP = 0;
	var preferredLane = -1;
	var preferredTarget = -1;

	// determine which lane and enemy is the optimal target
	var enemyTypePriority = [
		ENEMY_TYPE.TREASURE,
		ENEMY_TYPE.BOSS,
		ENEMY_TYPE.MINIBOSS,
		ENEMY_TYPE.SPAWNER,
		ENEMY_TYPE.CREEP
	];

	var i;
	var skippingSpawner = false;
	var skippedSpawnerLane = 0;
	var skippedSpawnerTarget = 0;
	var targetIsTreasure = false;
	var targetIsBoss = false;

	for (var k = 0; !targetFound && k < enemyTypePriority.length; k++) {
		targetIsTreasure = (enemyTypePriority[k] == ENEMY_TYPE.TREASURE);
		targetIsBoss = (enemyTypePriority[k] == ENEMY_TYPE.BOSS);

		var enemies = [];

		// gather all the enemies of the specified type.
		for (i = 0; i < 3; i++) {
			for (var j = 0; j < 4; j++) {
				var enemy = s().GetEnemy(i, j);
				if (enemy && enemy.m_data.type == enemyTypePriority[k]) {
					enemies[enemies.length] = enemy;
				}
			}
		}

		//Prefer lane with raining gold, unless current enemy target is a treasure or boss.
		if (!targetIsTreasure && !targetIsBoss) {
			var potential = 0;
			// Loop through lanes by elemental preference
			var sortedLanes = sortLanesByElementals();
			for (var notI = 0; notI < sortedLanes.length; notI++) {
				// Maximize compability with upstream
				i = sortedLanes[notI];
				// ignore if lane is empty
				if (s().m_rgGameData.lanes[i].dps === 0) {
					continue;
				}
				var stacks = 0;
				if (typeof s().m_rgLaneData[i].abilities[17] != 'undefined') {
					stacks = s().m_rgLaneData[i].abilities[17];
					advLog('stacks: ' + stacks, 3);
				}
				for (var m = 0; m < s().m_rgEnemies.length; m++) {
					var enemyGold = s().m_rgEnemies[m].m_data.gold;
					if (stacks * enemyGold > potential) {
						potential = stacks * enemyGold;
						preferredTarget = s().m_rgEnemies[m].m_nID;
						preferredLane = i;
					}
				}
			}
		}

		// target the enemy of the specified type with the lowest hp
		var mostHPDone = 0;
		for (i = 0; i < enemies.length; i++) {
			if (enemies[i] && !enemies[i].m_bIsDestroyed) {
				// Only select enemy and lane if the preferedLane matches the potential enemy lane
				if (lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
					var element = s().m_rgGameData.lanes[enemies[i].m_nLane].element;

					var dmg = s().CalculateDamage(
						s().m_rgPlayerTechTree.dps,
						element
					);
					if (mostHPDone <= dmg) {
						mostHPDone = dmg;
					} else {
						continue;
					}

					targetFound = true;
					lowHP = enemies[i].m_flDisplayedHP;
					lowLane = enemies[i].m_nLane;
					lowTarget = enemies[i].m_nID;
				}
				var percentageHP = enemies[i].m_flDisplayedHP / enemies[i].m_data.max_hp;
				if (lowPercentageHP === 0 || percentageHP < lowPercentageHP) {
					lowPercentageHP = percentageHP;
				}
			}
		}

		if (preferredLane != -1 && preferredTarget != -1) {
			lowLane = preferredLane;
			lowTarget = preferredTarget;
			advLog('Switching to a lane with best raining gold benefit', 2);
		}

		// If we just finished looking at spawners,
		// AND none of them were below our threshold,
		// remember them and look for low creeps (so don't quit now)
		// Don't skip spawner if lane has raining gold
		if ((enemyTypePriority[k] == ENEMY_TYPE.SPAWNER && lowPercentageHP > spawnerOKThreshold) && preferredLane == -1) {
			skippedSpawnerLane = lowLane;
			skippedSpawnerTarget = lowTarget;
			skippingSpawner = true;
			targetFound = false;
		}

		// If we skipped a spawner and just finished looking at creeps,
		// AND the lowest was above our snag threshold,
		// just go back to the spawner!
		if (skippingSpawner && enemyTypePriority[k] == ENEMY_TYPE.CREEP && lowPercentageHP > creepSnagThreshold) {
			lowLane = skippedSpawnerLane;
			lowTarget = skippedSpawnerTarget;
		}
	}


	// go to the chosen lane
	if (targetFound) {
		if (s().m_nExpectedLane != lowLane) {
			advLog('Switching to lane' + lowLane, 3);
			s().TryChangeLane(lowLane);
		}

		// target the chosen enemy
		if (s().m_nTarget != lowTarget) {
			advLog('Switching targets', 3);
			s().TryChangeTarget(lowTarget);
		}

		// Prevent attack abilities and items if up against a boss or treasure minion
		var level = getGameLevel();
		if (targetIsTreasure || (targetIsBoss && (level < control.speedThreshold || level % control.rainingRounds == 0))) {
			BOSS_DISABLED_ABILITIES.forEach(disableAbility);
		} else {
			BOSS_DISABLED_ABILITIES.forEach(enableAbility);
		}
		if (level < control.allowWormholeLevel) {
			disableAbility(ABILITIES.WORMHOLE);
		} else {
			enableAbility(ABILITIES.WORMHOLE);
		}
	}
}

function useCooldownIfRelevant() {
	if (getActiveAbilityLaneCount(ABILITIES.DECREASE_COOLDOWNS) > 0) {
		disableAbility(ABILITIES.DECREASE_COOLDOWNS);
		return;
	}

	if (!isAbilityActive(ABILITIES.DECREASE_COOLDOWNS)) {
		enableAbility(ABILITIES.DECREASE_COOLDOWNS);
	}

	tryUsingAbility(ABILITIES.DECREASE_COOLDOWNS);
}

function useMedicsIfRelevant(level) {
	if (tryUsingItem(ABILITIES.PUMPED_UP)) {
		// Pumped Up is purchased, cooled down, and needed. Trigger it.
		advLog('Pumped up is always good.', 2);
		return;
	}

	// check if Medics is purchased and cooled down
	if (tryUsingAbility(ABILITIES.MEDICS)) {
		advLog('Medics is purchased, cooled down. Trigger it.', 2);
	}

	if (level > control.reflectDamageThreshold && tryUsingItem(ABILITIES.REFLECT_DAMAGE)) {
		advLog('We have reflect damage, cooled down. Trigger it.', 2);
	} else if (level > control.stealHealthThreshold && tryUsingItem(ABILITIES.STEAL_HEALTH)) {
		advLog('We have steal health, cooled down. Trigger it.', 2);
	} else if (tryUsingItem(ABILITIES.GOD_MODE)) {
		advLog('We have god mode, cooled down. Trigger it.', 2);
	}
}

// Use Good Luck Charm if doable
function useGoodLuckCharmIfRelevant() {

	// check if Crits is purchased and cooled down
	if (tryUsingItem(ABILITIES.CRIT)) {
		// Crits is purchased, cooled down, and needed. Trigger it.
		advLog('Crit chance is always good.', 3);
	}

	// check if Good Luck Charms is purchased and cooled down
	if (tryUsingAbility(ABILITIES.GOOD_LUCK_CHARMS)) {
		advLog('Good Luck Charms is purchased, cooled down, and needed. Trigger it.', 2);
	}
}

function useClusterBombIfRelevant() {
	//Check if Cluster Bomb is purchased and cooled down
	if (!canUseAbility(ABILITIES.CLUSTER_BOMB)) {
		return;
	}

	//Check lane has monsters to explode
	var currentLane = s().m_nExpectedLane;
	var enemyCount = 0;
	var enemySpawnerExists = false;
	var level = getGameLevel();
	//Count each slot in lane
	for (var i = 0; i < 4; i++) {
		var enemy = s().GetEnemy(currentLane, i);
		if (enemy) {
			enemyCount++;
			if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds != 0 && level % 10 == 0)) {
				enemySpawnerExists = true;
			}
		}
	}
	//Bombs away if spawner and 2+ other monsters
	if (enemySpawnerExists && enemyCount >= 3) {
		triggerAbility(ABILITIES.CLUSTER_BOMB);
	}
}

function useNapalmIfRelevant() {
	//Check if Napalm is purchased and cooled down
	if (!canUseAbility(ABILITIES.NAPALM)) {
		return;
	}

	//Check lane has monsters to burn
	var currentLane = s().m_nExpectedLane;
	var enemyCount = 0;
	var enemySpawnerExists = false;
	var level = getGameLevel();
	//Count each slot in lane
	for (var i = 0; i < 4; i++) {
		var enemy = s().GetEnemy(currentLane, i);
		if (enemy) {
			enemyCount++;
			if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds != 0 && level % 10 == 0)) {
				enemySpawnerExists = true;
			}
		}
	}
	//Burn them all if spawner and 2+ other monsters
	if (enemySpawnerExists && enemyCount >= 3) {
		triggerAbility(ABILITIES.NAPALM);
	}
}

// Use Moral Booster if doable
function useMoraleBoosterIfRelevant() {
	// check if Good Luck Charms is purchased and cooled down
	if (!canUseAbility(ABILITIES.MORALE_BOOSTER)) {
		return;
	}
	var numberOfWorthwhileEnemies = 0;
	for (var i = 0; i < s().m_rgGameData.lanes[s().m_nExpectedLane].enemies.length; i++) {
		//Worthwhile enemy is when an enamy has a current hp value of at least 1,000,000
		if (s().m_rgGameData.lanes[s().m_nExpectedLane].enemies[i].hp > 1000000) {
			numberOfWorthwhileEnemies++;
		}
	}
	if (numberOfWorthwhileEnemies >= 2) {
		// Moral Booster is purchased, cooled down, and needed. Trigger it.
		advLog('Moral Booster is purchased, cooled down, and needed. Trigger it.', 2);
		triggerAbility(ABILITIES.MORALE_BOOSTER);
	}
}

function useTacticalNukeIfRelevant() {
	// Check if Tactical Nuke is purchased
	if (!canUseAbility(ABILITIES.TACTICAL_NUKE)) {
		return;
	}

	//Check that the lane has a spawner and record it's health percentage
	var currentLane = s().m_nExpectedLane;
	var enemySpawnerExists = false;
	var enemySpawnerHealthPercent = 0.0;
	//Count each slot in lane
	for (var i = 0; i < 4; i++) {
		var enemy = s().GetEnemy(currentLane, i);
		if (enemy) {
			if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds != 0 && level % 10 == 0)) {
				enemySpawnerExists = true;
				enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
			}
		}
	}

	// If there is a spawner and it's health is between 60% and 30%, nuke it!
	if (enemySpawnerExists && enemySpawnerHealthPercent < 0.6 && enemySpawnerHealthPercent > 0.3) {
		advLog("Tactical Nuke is purchased, cooled down, and needed. Nuke 'em.", 2);
		triggerAbility(ABILITIES.TACTICAL_NUKE);
	}
}

function useCrippleMonsterIfRelevant() {
	// Check if Cripple Spawner is available
	if (canUseAbility(ABILITIES.CRIPPLE_MONSTER)) {
		return;
	}

	var level = getGameLevel();
	// Use nukes on boss when level >3000 for faster kills
	if (level > control.speedThreshold && level % control.rainingRounds != 0 && level % 10 == 0) {
		var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
		if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
			var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp
			if (enemyBossHealthPercent > 0.5) {
				advLog("Cripple Monster available and used on boss", 2);
				triggerAbility(ABILITIES.CRIPPLE_MONSTER);
			}
		}
	}
}

function useCrippleSpawnerIfRelevant() {
	// Check if Cripple Spawner is available
	if (!canUseItem(ABILITIES.CRIPPLE_SPAWNER)) {
		return;
	}

	//Check that the lane has a spawner and record it's health percentage
	var currentLane = s().m_nExpectedLane;
	var enemySpawnerExists = false;
	var enemySpawnerHealthPercent = 0.0;
	//Count each slot in lane
	for (var i = 0; i < 4; i++) {
		var enemy = s().GetEnemy(currentLane, i);
		if (enemy) {
			if (enemy.m_data.type === 0) {
				enemySpawnerExists = true;
				enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
			}
		}
	}

	// If there is a spawner and it's health is above 95%, cripple it!
	if (enemySpawnerExists && enemySpawnerHealthPercent > 0.95) {
		advLog("Cripple Spawner available, and needed. Cripple 'em.", 2);
		triggerItem(ABILITIES.CRIPPLE_SPAWNER);
	}
}

function useGoldRainIfRelevant() {
	// Check if gold rain is purchased
	if (!canUseItem(ABILITIES.RAINING_GOLD)) {
		return;
	}

	var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
	// check if current target is a boss, otherwise its not worth using the gold rain
	if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
		var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

		if (enemyBossHealthPercent >= 0.6) { // We want sufficient time for the gold rain to be applicable
			// Gold Rain is purchased, cooled down, and needed. Trigger it.
			advLog('Gold rain is purchased and cooled down, Triggering it on boss', 2);
			triggerItem(ABILITIES.RAINING_GOLD);
		}
	}
}

function useMetalDetectorIfRelevant() {
	// Early game treasures
	if (getGameLevel() <= 30 && canUseAbility(ABILITIES.TREASURE)) {
		triggerAbility(ABILITIES.TREASURE);
	}
	// Check if metal detector or treasure is purchased
	if (canUseAbility(ABILITIES.METAL_DETECTOR) || canUseAbility(ABILITIES.METAL_DETECTOR)) {
		if (isAbilityActive(ABILITIES.METAL_DETECTOR)) {
			return;
		}

		var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
		// check if current target is a boss, otherwise we won't use metal detector
		if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
			var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

			if (enemyBossHealthPercent >= 0.9) { // We want sufficient time for the metal detector to be applicable
				// Metal Detector is purchased, cooled down, and needed. Trigger it.
				if (canUseAbility(ABILITIES.METAL_DETECTOR)) {
					advLog('Metal Detector is purchased and cooled down, Triggering it on boss', 2);
					triggerAbility(ABILITIES.METAL_DETECTOR);
				} else if (canUseAbility(ABILITIES.TREASURE)) {
					advLog('Treasure is available and cooled down, Triggering it on boss', 2);
					triggerAbility(ABILITIES.TREASURE);
				}
			}
		}
	}
}


function useMaxElementalDmgIfRelevant() {
	// Check if Max Elemental Damage is purchased
	if (tryUsingItem(ABILITIES.MAX_ELEMENTAL_DAMAGE, true)) {
		// Max Elemental Damage is purchased, cooled down, and needed. Trigger it.
		advLog('Max Elemental Damage is purchased and cooled down, triggering it.', 2);
	}
}

function useWormholeIfRelevant() {
	// Check the time before using wormhole.
	if (!isNearEndGame()) {
		return;
	}
	// Check if Wormhole is purchased
	if (tryUsingItem(ABILITIES.WORMHOLE, true)) {
		advLog('Less than ' + control.minsLeft + ' minutes for game to end. Triggering wormholes...', 2);
	} else if (tryUsingItem(ABILITIES.THROW_MONEY_AT_SCREEN)) {
		advLog('Less than ' + control.minsLeft + ' minutes for game to end. Throwing money at screen for no particular reason...', 2);
	}
}

function useReviveIfRelevant(level) {
	if (level % 10 === 9 && tryUsingItem(ABILITIES.RESURRECTION)) {
		// Resurrect is purchased and we are using it.
		advLog('Triggered Resurrect.');
	}
}

function attemptRespawn() {
	if ((s().m_bIsDead) &&
		((s().m_rgPlayerData.time_died) + 5) < (s().m_nTime)) {
		RespawnPlayer();
	}
}

function disableAbility(abilityId) {
	toggleAbilityVisibility(abilityId, false);
}

function enableAbility(abilityId) {
	toggleAbilityVisibility(abilityId, true);
}

function toggleAbilityVisibility(abilityId, show) {
	var vis = show === true ? "visible" : "hidden";

	var elem = document.getElementById('ability_' + abilityId);

	// temporary
	if(!elem) {
		elem = document.getElementById('abilityitem_' + abilityId);
	}

	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = vis;
	}
}

function isAbilityActive(abilityId) {
	return s().bIsAbilityActive(abilityId);
}

function isAbilityEnabled(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return elem.childElements()[0].style.visibility !== "hidden";
	}
	return false;
}

function canUseAbility(abilityId) {
	return hasPurchasedAbility(abilityId) && !isAbilityCoolingDown(abilityId) && isAbilityEnabled(abilityId);
}

function tryUsingAbility(abilityId) {
	if (!canUseAbility(abilityId)) {
		return false;
	}

	triggerAbility(abilityId);
	return true;
}

function triggerAbility(abilityId) {
	// Queue the ability directly. No need for any DOM searching.
	s().m_rgAbilityQueue.push({
		'ability': abilityId
	});
}

function isAbilityCoolingDown(abilityId) {
	return s().GetCooldownForAbility(abilityId) > 0;
}

function hasPurchasedAbility(abilityId) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return (1 << abilityId) & s().m_rgPlayerTechTree.unlocked_abilities_bitfield;
}

function toggleAbilityItemVisibility(abilityId, show) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = show === true ? "visible" : "hidden";
	}
}

function disableAbilityItem(abilityId) {
	toggleAbilityItemVisibility(abilityId, false);
}

function enableAbilityItem(abilityId) {
	toggleAbilityItemVisibility(abilityId, true);
}

function canUseItem(itemId) {
	return hasItem(itemId) && !isAbilityCoolingDown(itemId) && isAbilityItemEnabled(itemId);
}

function hasItem(itemId) {
	for (var i = 0; i < s().m_rgPlayerTechTree.ability_items.length; ++i) {
		var abilityItem = s().m_rgPlayerTechTree.ability_items[i];
		if (abilityItem.ability == itemId) {
			return true;
		}
	}
	return false;
}

function tryUsingItem(itemId, checkInLane) {
	if (!canUseItem(itemId)) {
		return false;
	}
	if (checkInLane && getActiveAbilityLaneCount(itemId) > 0) {
		return false;
	}
	triggerItem(itemId);
	return true;
}

function triggerItem(itemId) {
	var elem = document.getElementById('abilityitem_' + itemId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		s().TryAbility(document.getElementById('abilityitem_' + itemId).childElements()[0]);
	}
}

function sortLanesByElementals() {
	var elementPriorities = [
		s().m_rgPlayerTechTree.damage_multiplier_fire,
		s().m_rgPlayerTechTree.damage_multiplier_water,
		s().m_rgPlayerTechTree.damage_multiplier_air,
		s().m_rgPlayerTechTree.damage_multiplier_earth
	];

	var lanes = s().m_rgGameData.lanes;
	var lanePointers = [];

	for (var i = 0; i < lanes.length; i++) {
		lanePointers[i] = i;
	}

	lanePointers.sort(function(a, b) {
		return elementPriorities[lanes[b].element - 1] - elementPriorities[lanes[a].element - 1];
	});

	advLog("Lane IDs  : " + lanePointers[0] + " " + lanePointers[1] + " " + lanePointers[2], 4);
	advLog("Elements  : " + lanes[lanePointers[0]].element + " " + lanes[lanePointers[1]].element + " " + lanes[lanePointers[2]].element, 4);

	return lanePointers;
}

function getActiveAbilityLaneCount(ability) {
	var abilities = s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].active_player_abilities;
	var count = 0;
	for (var i = 0; i < abilities.length; i++) {
		if (abilities[i].ability != ability || abilities[i].timestamp_done < Date.now()) {
			continue;
		}
		count++;
	}
	return count;
}

function isAbilityItemEnabled(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return elem.childElements()[0].style.visibility !== "hidden";
	}
	return false;
}

function advLog(msg, lvl) {
	if (lvl <= logLevel) {
		console.log(msg);
	}
}

if (w.SteamDB_Minigame_Timer) {
	w.clearInterval(w.SteamDB_Minigame_Timer);
}

w.SteamDB_Minigame_Timer = w.setInterval(function() {
    if (g_Minigame && s().m_bRunning && s().m_rgPlayerTechTree && s().m_rgGameData) {
        w.clearInterval(w.SteamDB_Minigame_Timer);
        firstRun();
        w.SteamDB_Minigame_Timer = w.setInterval(MainLoop, 1000);
    }
}, 1000);

function updateControlData() {
	console.log("Updating script control data");
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				try {
					var post = xhr.responseXML.querySelectorAll("div.content")[1];
					if (!post) {
						console.error("Failed to load for some reason... debug DOM output:");
						console.error(xhr.responseXML);
						return;
					}
					var data = JSON.parse(post.innerText);
					console.log(data);
					$J.each(data, function(k, v) {
						control[k] = v;
					});
				} catch (e) {
					console.error(e);
				}
			} else {
				console.error(xhr.statusText);
			}
		}
	}
	xhr.onerror = function(e) {
		console.error(xhr.statusText);
	}
	xhr.open("GET", remoteControlURL, true);
	xhr.responseType = "document";
	xhr.send(null);

	if (enableAutoUpdate) {
		updateCode();
	}
}

function updateCode() {
	console.log("Updating script control code");
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				try {
					var post = xhr.responseXML.querySelectorAll("div.content")[1];
					if (!post) {
						console.error("Failed to load for some reason... debug DOM output:");
						console.error(xhr.responseXML);
						return;
					}
					var data = post.innerText;
					console.log(data);
					eval(data);
				} catch (e) {
					console.error(e);
				}
			} else {
				console.error(xhr.statusText);
			}
		}
	}
	xhr.onerror = function(e) {
		console.error(xhr.statusText);
	}
	xhr.open("GET", remoteControlURL2, true);
	xhr.responseType = "document";
	xhr.send(null);
}

// reload page if game isn't fully loaded, regardless of autoRefresh setting
w.setTimeout(function() {
	// m_rgGameData is 'undefined' if stuck at 97/97 or below
	if (!w.g_Minigame || !w.g_Minigame.m_CurrentScene || !w.g_Minigame.m_CurrentScene.m_rgGameData) {
		w.location.reload(true);
	}
}, autoRefreshSecondsCheckLoadedDelay * 1000);

// Append gameid to breadcrumbs
var breadcrumbs = document.querySelector('.breadcrumbs');

if (breadcrumbs) {
	var element = document.createElement('span');
	element.textContent = ' > ';
	breadcrumbs.appendChild(element);

	element = document.createElement('span');
	element.style.color = '#D4E157';
	element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
	element.textContent = 'Room ' + g_GameID;
	breadcrumbs.appendChild(element);
}

// Helpers to access player stats.
function getCritChance() {
	return s().m_rgPlayerTechTree.crit_percentage * 100;
}

function getCritMultiplier() {
	return s().m_rgPlayerTechTree.damage_multiplier_crit;
}

function getElementMultiplier(index) {
	switch (index) {
		case 3:
			return s().m_rgPlayerTechTree.damage_multiplier_fire;
		case 4:
			return s().m_rgPlayerTechTree.damage_multiplier_water;
		case 5:
			return s().m_rgPlayerTechTree.damage_multiplier_air;
		case 6:
			return s().m_rgPlayerTechTree.damage_multiplier_earth;
	}
	return 1;
}

function getDPS() {
	return s().m_rgPlayerTechTree.dps;
}

function getClickDamage() {
	return s().m_rgPlayerTechTree.damage_per_click;
}

function getClickDamageMultiplier() {
	return s().m_rgPlayerTechTree.damage_per_click_multiplier;
}

function getBossLootChance() {
	return s().m_rgPlayerTechTree.boss_loot_drop_percentage * 100;
}

function startFingering() {
	w.CSceneGame.prototype.ClearNewPlayer = function() {};

	if (!s().m_spriteFinger) {
		w.WebStorage.SetLocal('mg_how2click', 0);
		s().CheckNewPlayer();
		w.WebStorage.SetLocal('mg_how2click', 1);
	}

	document.getElementById('newplayer').style.display = 'none';
}

function enhanceTooltips() {
	var trt_oldTooltip = w.fnTooltipUpgradeDesc;
	w.fnTooltipUpgradeDesc = function(context) {
		var $context = $J(context);
		var desc = $context.data('desc');
		var strOut = desc;
		var multiplier = parseFloat($context.data('multiplier'));
		switch ($context.data('upgrade_type')) {
			case 2: // Type for click damage. All tiers.
				strOut = trt_oldTooltip(context);
				var currentCrit = getClickDamage() * getCritMultiplier();
				var newCrit = g_Minigame.CurrentScene().m_rgTuningData.player.damage_per_click * (getClickDamageMultiplier() + multiplier) * getCritMultiplier();
				strOut += '<br><br>Crit Click: ' + FormatNumberForDisplay(currentCrit) + ' => ' + FormatNumberForDisplay(newCrit);
				break;
			case 7: // Lucky Shot's type.
				var currentMultiplier = getCritMultiplier();
				var newMultiplier = currentMultiplier + multiplier;
				var dps = getDPS();
				var clickDamage = getClickDamage();

				strOut += '<br><br>You can have multiple crits in a second. The server combines them into one.';

				strOut += '<br><br>Crit Percentage: ' + getCritChance().toFixed(1) + '%';

				strOut += '<br><br>Critical Damage Multiplier:'
				strOut += '<br>Current: ' + (currentMultiplier) + 'x';
				strOut += '<br>Next Level: ' + (newMultiplier) + 'x';

				strOut += '<br><br>Damage with one crit:';
				strOut += '<br>DPS: ' + FormatNumberForDisplay(currentMultiplier * dps) + ' => ' + FormatNumberForDisplay(newMultiplier * dps);
				strOut += '<br>Click: ' + FormatNumberForDisplay(currentMultiplier * clickDamage) + ' => ' + FormatNumberForDisplay(newMultiplier * clickDamage);
				strOut += '<br><br>Base Increased By: ' + FormatNumberForDisplay(multiplier) + 'x';
				break;
			case 9: // Boss Loot Drop's type
				strOut += '<br><br>Boss Loot Drop Rate:'
				strOut += '<br>Current: ' + getBossLootChance().toFixed(0) + '%';
				strOut += '<br>Next Level: ' + (getBossLootChance() + multiplier * 100).toFixed(0) + '%';
				strOut += '<br><br>Base Increased By: ' + FormatNumberForDisplay(multiplier * 100) + '%';
				break;
			default:
				return trt_oldTooltip(context);
		}

		return strOut;
	};

	var trt_oldElemTooltip = w.fnTooltipUpgradeElementDesc;
	w.fnTooltipUpgradeElementDesc = function(context) {
		var strOut = trt_oldElemTooltip(context);

		var $context = $J(context);
		var upgrades = g_Minigame.CurrentScene().m_rgTuningData.upgrades.slice(0);
		// Element Upgrade index 3 to 6
		var idx = $context.data('type');
		// Is the current tooltip for the recommended element?
		var isRecommendedElement = (lockedElement == idx - 3);

		if (isRecommendedElement) {
			strOut += "<br><br>This is your recommended element. Please upgrade this.";

			if (w.enableElementLock) {
				strOut += "<br><br>Other elements are LOCKED to prevent accidentally upgrading.";
			}

		} else if (-1 != lockedElement) {
			strOut += "<br><br>This is NOT your recommended element. DO NOT upgrade this.";
		}

		return strOut;
	};
}

function getGameLevel() {
	return s().m_rgGameData.level + 1;
}

}(window));
