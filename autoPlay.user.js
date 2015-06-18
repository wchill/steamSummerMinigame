// ==UserScript==
// @name /u/wchill Monster Minigame Auto-script w/ auto-click
// @namespace https://github.com/wchill/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @version 4.8.2
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
	var SCRIPT_VERSION = '4.8.2';

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
	var useTrollTracker = getPreferenceBoolean("useTrollTracker", false);
	var praiseGoldHelm = getPreferenceBoolean("praiseGoldHelm", true);

	var autoRefreshMinutes = 30; // refresh page after x minutes
	var autoRefreshMinutesRandomDelay = 10;
	var autoRefreshSecondsCheckLoadedDelay = 30;

	// DO NOT MODIFY
	var isAlreadyRunning = false;
	var refreshTimer = null;
	var currentClickRate = enableAutoClicker ? clickRate : 0;
	var lastLevel = 0;
	var goldHelmURLs = {
		"Original Gold Helm": "https://i.imgur.com/1zRXQgm.png",
		"Moving Gold Helm": "http://i.imgur.com/XgT8Us8.gif",
		"Golden Gaben": "http://i.imgur.com/ueDBBrA.png",
		"Gaben + Snoop Dogg": "http://i.imgur.com/9R0436k.gif",
		"Wormhole Gaben": "http://i.imgur.com/6BuBgxY.png"
	};
	var goldHelmUI = getPreference("praiseGoldHelmImage", goldHelmURLs["Golden Gaben"]);
	var fixedUI = "http://i.imgur.com/ieDoLnx.png";
	var trt_oldCrit = function() {};
	var trt_oldPush = function() {};
	var trt_oldRender = function() {};

	var control = {
		speedThreshold: 2000,
		// Stop using offensive abilities shortly before rain/wormhole rounds.
		rainingSafeRounds: 5,
		rainingRounds: 100,
		timePerUpdate: 60000,
		useSlowMode: false,
		minsLeft: 60,
		allowWormholeLevel: 180000,
		githubVersion: SCRIPT_VERSION,
		useAbilityChance: 0.03,
		useLikeNewMinChance: 0.02,
		useLikeNewMaxChance: 0.25,
		useLikeNewMinTime: 0,
		useLikeNewMaxTime: 500,
		useGoldThreshold: 200
	};

	var canUseLikeNew = true;
	var levelsSkipped = [0, 0, 0, 0, 0];
	var oldLevel = 0;
	var replacedCUI = false;

	var showedUpdateInfo = getPreferenceBoolean("showedUpdateInfo", false);

	var lane_info = {};

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

	var BOSS_DISABLED_ABILITIES = [
		ABILITIES.MORALE_BOOSTER,
		ABILITIES.GOOD_LUCK_CHARMS,
		ABILITIES.TACTICAL_NUKE,
		ABILITIES.CLUSTER_BOMB,
		ABILITIES.NAPALM,
		ABILITIES.CRIT,
		ABILITIES.CRIPPLE_SPAWNER,
		ABILITIES.CRIPPLE_MONSTER,
		ABILITIES.MAX_ELEMENTAL_DAMAGE,
		ABILITIES.REFLECT_DAMAGE,
		ABILITIES.THROW_MONEY_AT_SCREEN
	];

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
		lockElements();

		// disable particle effects - this drastically reduces the game's memory leak
		if (removeParticles) {
			disableParticles();
		}

		// disable enemy flinching animation when they get hit
		if (removeFlinching && w.CEnemy) {
			w.CEnemy.prototype.TakeDamage = function() {};
			w.CEnemySpawner.prototype.TakeDamage = function() {};
			w.CEnemyBoss.prototype.TakeDamage = function() {};
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
			node = document.getElementById("global_header");
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
		egg.textContent = "Easter Egg";
		egg.onclick = function() {
			w.SmackTV();
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

		var newDiv = document.createElement("div");
		document.getElementsByClassName('pagecontent')[0].insertBefore(newDiv, document.getElementsByClassName('footer_spacer')[0]);
		newDiv.className = "options_box";

		var options_box = document.querySelector(".options_box");

		if(!options_box) {
			options_box = document.querySelector(".options_box");
		}
		options_box.innerHTML = '<b>OPTIONS</b> (v' + SCRIPT_VERSION + ')<br>Settings marked with a <span style="color:#FF5252;font-size:22px;line-height:4px;vertical-align:bottom;">*</span> requires a refresh to take effect.<hr>';

		// reset the CSS for the info box for aesthetics
		options_box.className = "options_box";
		options_box.style.backgroundColor = "#000000";
		options_box.style.width = "600px";
		options_box.style.marginTop = "12px";
		options_box.style.padding = "12px";
		options_box.style.boxShadow = "2px 2px 0 rgba( 0, 0, 0, 0.6 )";
		options_box.style.color = "#ededed";
		options_box.style.marginLeft = "auto";
		options_box.style.marginRight = "auto";

		var info_box = options_box.cloneNode(true);

		var options1 = document.createElement("div");
		options1.style["-moz-column-count"] = 3;
		options1.style["-webkit-column-count"] = 3;
		options1.style["column-count"] = 3;
		options1.style.width = "100%";

		options1.appendChild(makeCheckBox("enableAutoClicker", "Enable autoclicker", enableAutoClicker, toggleAutoClicker, false));
		options1.appendChild(makeCheckBox("removeInterface", "Remove interface", removeInterface, handleEvent, true));
		options1.appendChild(makeCheckBox("removeParticles", "Remove particle effects", removeParticles, handleEvent, true));
		options1.appendChild(makeCheckBox("removeFlinching", "Remove flinching effects", removeFlinching, handleEvent, true));
		options1.appendChild(makeCheckBox("removeCritText", "Remove crit text", removeCritText, toggleCritText, false));
		options1.appendChild(makeCheckBox("removeGoldText", "Remove gold text", removeGoldText, handleEvent, false));
		options1.appendChild(makeCheckBox("removeAllText", "Remove all text", removeAllText, toggleAllText, false));
		options1.appendChild(makeCheckBox("disableRenderer", "Throttle game renderer", disableRenderer, toggleRenderer, true));

		if (typeof GM_info !== "undefined") {
			options1.appendChild(makeCheckBox("enableAutoRefresh", "Enable auto-refresh", enableAutoRefresh, toggleAutoRefresh, false));
		}

		options1.appendChild(makeCheckBox("enableFingering", "Enable targeting pointer", enableFingering, handleEvent, true));
		options1.appendChild(makeCheckBox("useTrollTracker", "Track improper ability use", useTrollTracker, handleEvent, true));
		options1.appendChild(makeCheckBox("praiseGoldHelm", "Praise Gold Helm!", praiseGoldHelm, togglePraise, false));
		options1.appendChild(makeDropdown("praiseGoldHelmImage", "", goldHelmUI, goldHelmURLs, changePraiseImage));
		options1.appendChild(makeNumber("setLogLevel", "Change the log level", "25px", logLevel, 0, 5, updateLogLevel));

		options_box.appendChild(options1);

		info_box.innerHTML = "<b>GAME INFO</b><br/>";
		info_box.className = "info_box";
		info_box.style.right = "0px";
		lane_info = document.createElement("div");
		lane_info.style["-moz-column-count"] = 3;
		lane_info.style["-webkit-column-count"] = 3;
		lane_info.style["column-count"] = 3;

		lane_info.appendChild(document.createElement("div"));
		lane_info.appendChild(document.createElement("div"));
		lane_info.appendChild(document.createElement("div"));

		info_box.appendChild(lane_info);
		options_box.parentElement.appendChild(info_box);

		var leave_game_box = document.querySelector(".leave_game_helper");
		leave_game_box.parentElement.removeChild(leave_game_box);

		enhanceTooltips();
		enableMultibuy();
		waitForWelcomePanelLoad();

	}

	function updateLaneData() {
		var element_names = {1:":shelterwildfire:", 2:":waterrune:", 3:":Wisp:", 4:":FateTree:"};
		for(var i = 0; i < 3; i++) {
			var element = s().m_rgGameData.lanes[i].element;
			var abilities = s().m_rgLaneData[i].abilities;
			if(!abilities) {
				abilities = {};
			}
			var enemies = [];
			for (var j = 0; j < 4; j++) {
				var enemy = s().GetEnemy(i, j);
				if (enemy) {
					enemies.push(enemy);
				}
			}
			var players = s().m_rgLaneData[i].players;
			var output = "Lane " + (i+1) + " - <img src=\"http://cdn.steamcommunity.com/economy/emoticon/" + element_names[element] + "\"><br>" + players + " players";
			lane_info.children[i].innerHTML = output;
		}
	}

	function fixActiveCapacityUI() {
		if(praiseGoldHelm) {
			w.$J('.tv_ui').css('background-image', 'url(' + goldHelmUI + ')');
		} else {
			w.$J('.tv_ui').css('background-image', 'url(' + fixedUI + ')');
		}
		w.$J('#activeinlanecontainer').css('height', '154px');
		w.$J('#activitycontainer').css('height', '270px');
		w.$J('#activityscroll').css('height', '270px');
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

			updateLaneData();

			attemptRespawn();
			useWormholeIfRelevant();
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
			if ((level < control.speedThreshold || level % control.rainingRounds === 0) && level > control.useGoldThreshold) {
				useGoldRainIfRelevant();
			}
			useCrippleMonsterIfRelevant(level);
			useReviveIfRelevant(level);
			useMaxElementalDmgIfRelevant();
			useLikeNewIfRelevant();
			updatePlayersInGame();

			if (level !== lastLevel) {
				lastLevel = level;
				updateLevelInfoTitle(level);
				refreshPlayerData();
			}

			currentClickRate = getWantedClicksPerSecond();
			s().m_nClicks = currentClickRate;
			s().m_nLastTick = false;
			w.g_msTickRate = 1000;

			var damagePerClick = s().CalculateDamage(
				s().m_rgPlayerTechTree.damage_per_click,
				s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].element
			);

			advLog("Ticked. Current clicks per second: " + currentClickRate + ". Current damage per second: " + (damagePerClick * currentClickRate), 4);

			if(disableRenderer) {
				s().Tick();

				requestAnimationFrame(function() {
					w.g_Minigame.Renderer.render(s().m_Container);
				});
			}

			isAlreadyRunning = false;

			var enemy = s().GetEnemy(
				s().m_rgPlayerData.current_lane,
				s().m_rgPlayerData.target);

			if (currentClickRate > 0) {

				if (enemy) {
					displayText(
						enemy.m_Sprite.position.x - (enemy.m_nLane * 440),
						enemy.m_Sprite.position.y - 52,
						"-" + w.FormatNumberForDisplay((damagePerClick * currentClickRate), 5),
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
								"+" + w.FormatNumberForDisplay(goldPerSecond, 5),
								"#e1b21e"
							);
						}
					}
				}
			}

			// Make sure to only include ticks that are relevant
			var level_jump = getGameLevel() - oldLevel;
			if (level_jump > 0) {
				// Iterate down the levelskipped memory
				for (var i = 4; i >= 0; i--) {
					levelsSkipped[i+1] = levelsSkipped[i];
				}
				levelsSkipped[0] = level_jump;

				oldLevel = getGameLevel();
			}
		}

		if(w.CUI && !replacedCUI) {
			replacedCUI = true;
			advLog("Anti nuke in effect", 1);
			w.CUI.prototype.UpdateLog = function( rgLaneLog )
			{
				var abilities = this.m_Game.m_rgTuningData.abilities;

				if( !this.m_Game.m_rgPlayerTechTree ) {
					return;
				}

				var nHighestTime = 0;

				for( var i=rgLaneLog.length-1; i >= 0; i--) {
					var rgEntry = rgLaneLog[i];

					// If we got a bad time for some reason, assume it's n+1 since we'll be ahead of it by the next update anyway
					if( isNaN( rgEntry.time ) ) {
						rgEntry.time = this.m_nActionLogTime + 1;
					}

					if( rgEntry.time <= this.m_nActionLogTime ) {
						continue;
					}

					switch( rgEntry.type ) {
						case 'ability':
							var ele = this.m_eleUpdateLogTemplate.clone();
							if(useTrollTracker) {
								if(getGameLevel() % 100 === 0 && [10, 11, 12, 15, 20].indexOf(rgEntry.ability) > -1) {
									w.$J(ele).data('abilityid', rgEntry.ability );
									w.$J('.name', ele).text( rgEntry.actor_name );
									w.$J('.ability', ele).text( this.m_Game.m_rgTuningData.abilities[ rgEntry.ability ].name + " on level " + getGameLevel());
									w.$J('img', ele).attr( 'src', w.g_rgIconMap['ability_' + rgEntry.ability].icon );
	
									w.$J(ele).v_tooltip({tooltipClass: 'ta_tooltip', location: 'top'});
	
									this.m_eleUpdateLogContainer[0].insertBefore(ele[0], this.m_eleUpdateLogContainer[0].firstChild);
									advLog(rgEntry.actor_name + " used " + this.m_Game.m_rgTuningData.abilities[ rgEntry.ability ].name + " on level " + getGameLevel(), 1);
									w.$J('.name', ele).attr( "style", "color: red; font-weight: bold;" );
								} else if(getGameLevel() % 100 !== 0 && getGameLevel() % 10 > 3 && rgEntry.ability === 26) {
									w.$J(ele).data('abilityid', rgEntry.ability );
									w.$J('.name', ele).text( rgEntry.actor_name );
									w.$J('.ability', ele).text( this.m_Game.m_rgTuningData.abilities[ rgEntry.ability ].name + " on level " + getGameLevel());
									w.$J('img', ele).attr( 'src', w.g_rgIconMap['ability_' + rgEntry.ability].icon );
									w.$J('.name', ele).attr( "style", "color: yellow" );
	
									w.$J(ele).v_tooltip({tooltipClass: 'ta_tooltip', location: 'top'});
	
									this.m_eleUpdateLogContainer[0].insertBefore(ele[0], this.m_eleUpdateLogContainer[0].firstChild);
								}
							} else {
								w.$J(ele).data('abilityid', rgEntry.ability );
								w.$J('.name', ele).text( rgEntry.actor_name );
								w.$J('.ability', ele).text( this.m_Game.m_rgTuningData.abilities[ rgEntry.ability ].name + " on level " + getGameLevel());
								w.$J('img', ele).attr( 'src', w.g_rgIconMap['ability_' + rgEntry.ability].icon );

								w.$J(ele).v_tooltip({tooltipClass: 'ta_tooltip', location: 'top'});

								this.m_eleUpdateLogContainer[0].insertBefore(ele[0], this.m_eleUpdateLogContainer[0].firstChild);
							}
							break;

						default:
							console.log("Unknown action log type: %s", rgEntry.type);
							console.log(rgEntry);
					}

					if( rgEntry.time > nHighestTime ) {
						nHighestTime = rgEntry.time;
					}
				}

				if( nHighestTime > this.m_nActionLogTime ) {
					this.m_nActionLogTime = nHighestTime;
				}

				// Prune older entries
				var e = this.m_eleUpdateLogContainer[0];
				while(e.children.length > 20 )
				{
					e.children[e.children.length-1].remove();
				}
			};
			if(this.m_eleUpdateLogContainer) {
				this.m_eleUpdateLogContainer[0].innerHTML = "";
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

	function makeDropdown(name, desc, value, values, listener) {
		var label = document.createElement("label");
		var description = document.createTextNode(desc);
		var drop = document.createElement("select");

		for(var k in values) {
			var choice = document.createElement("option");
			choice.value = values[k];
			choice.textContent = k;
			if(values[k] == value) {
				choice.selected = true;
			}
			drop.appendChild(choice);
		}

		drop.name = name;
		drop.style.marginRight = "5px";
		drop.onchange = listener;

		label.appendChild(drop);
		label.appendChild(description);
		label.appendChild(document.createElement("br"));
		return label;
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

	function handleDropdown(event) {
		var dropdown = event.target;
		setPreference(dropdown.name, dropdown.value);

		w[dropdown.name] = dropdown.value;
		return dropdown.value;
	}

	function togglePraise(event) {
		if (event !== undefined) {
			praiseGoldHelm = handleCheckBox(event);
		}
		fixActiveCapacityUI();
	}

	function changePraiseImage(event) {
		if (event !== undefined) {
			goldHelmUI = handleDropdown(event);
		}
		fixActiveCapacityUI();
	}

	function toggleAutoClicker(event) {
		var value = enableAutoClicker;
		if (event !== undefined) {
			value = handleCheckBox(event);
		}
		enableAutoClicker = value;
		advLog('Autoclicker is ' + enableAutoClicker, 1);
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

	function getWantedClicksPerSecond() {
		var level = getGameLevel();
		if (!enableAutoClicker) {
			return 0;
		}
		if (level % control.rainingRounds === 0) {
			if (hasItem(ABILITIES.WORMHOLE)) {
				return 0;
			} else {
				return Math.floor(clickRate/2);
			}
		}
		if (level % control.rainingRounds > control.rainingRounds - control.rainingSafeRounds) {
			return Math.floor(clickRate/10);
		} else if (level % control.rainingRounds > control.rainingRounds - control.rainingSafeRounds*2) {
			return Math.floor(clickRate/5);
		}
		return clickRate;
	}

	function getLevelsSkipped() {
		var total = 0;
		for (var i = 3; i >= 0; i--) {
			levelsSkipped[i+1] = levelsSkipped[i];
			total += levelsSkipped[i];
		}
		total += levelsSkipped[0];
		return total;
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

	function lockElements() {
		var fire = document.querySelector("a.link.element_upgrade_btn[data-type=\"3\"]");
		var water = document.querySelector("a.link.element_upgrade_btn[data-type=\"4\"]");
		var air = document.querySelector("a.link.element_upgrade_btn[data-type=\"5\"]");
		var earth = document.querySelector("a.link.element_upgrade_btn[data-type=\"6\"]");

		var elems = [fire, water, air, earth];

		for (var i = 0; i < elems.length; i++) {
			elems[i].style.visibility = "hidden";
		}
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

		var e = new w.CEasingSinOut(text.y, -200, 1000);
		e.parent = text;
		text.m_easeY = e;

		e = new w.CEasingSinOut(2, -2, 1000);
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
			if (targetIsTreasure || (targetIsBoss && (level < control.speedThreshold || level % control.rainingRounds === 0))) {
				BOSS_DISABLED_ABILITIES.forEach(disableAbility);
			} else {
				BOSS_DISABLED_ABILITIES.forEach(enableAbility);
			}
			if (level < control.allowWormholeLevel && !isNearEndGame()) {
				//disableAbility(ABILITIES.WORMHOLE);
			} else {
				enableAbility(ABILITIES.WORMHOLE);
			}
		}
	}

	function useCooldownIfRelevant() {
		if (getActiveAbilityLaneCount(ABILITIES.DECREASE_COOLDOWNS) > 0 || Math.random() > control.useAbilityChance) {
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
		if (!canUseAbility(ABILITIES.CLUSTER_BOMB) || !canUseOffensiveAbility() || Math.random() > control.useAbilityChance) {
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
				if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds !== 0 && level % 10 === 0)) {
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
		if (!canUseAbility(ABILITIES.NAPALM) || !canUseOffensiveAbility() || Math.random() > control.useAbilityChance) {
			return;
		}

		//Check lane has monsters to burn
		var currentLane = s().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		var level = getGameLevel();

		// Prevent this outright if its within control.rainingSafeRounds of the next rainingRound
		if (level % control.rainingRounds > control.rainingRounds - control.rainingSafeRounds) {
			return;
		}

		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = s().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds !== 0 && level % 10 === 0)) {
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
		if (!canUseAbility(ABILITIES.MORALE_BOOSTER) || Math.random() > control.useAbilityChance) {
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
		if (!canUseAbility(ABILITIES.TACTICAL_NUKE) || !canUseOffensiveAbility() || Math.random() > control.useAbilityChance) {
			return;
		}

		//Check that the lane has a spawner and record it's health percentage
		var currentLane = s().m_nExpectedLane;
		var enemySpawnerExists = false;
		var enemySpawnerHealthPercent = 0.0;
		var level = getGameLevel();
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = s().GetEnemy(currentLane, i);
			if (enemy) {
				if (enemy.m_data.type === 0 || (level > control.speedThreshold && level % control.rainingRounds !== 0 && level % 10 === 0)) {
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
		return;
	}

	function useCrippleSpawnerIfRelevant() {
		// Check if Cripple Spawner is available
		if (!canUseItem(ABILITIES.CRIPPLE_SPAWNER) || Math.random() > control.useAbilityChance) {
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
		if ((getGameLevel() <= 30 || getGameLevel() >= 100000) && canUseItem(ABILITIES.TREASURE)) {
			triggerItem(ABILITIES.TREASURE);
		}
		// Check if metal detector or treasure is purchased
		if (canUseAbility(ABILITIES.METAL_DETECTOR) || canUseItem(ABILITIES.TREASURE)) {
			if (isAbilityActive(ABILITIES.METAL_DETECTOR)) {
				return;
			}

			var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
			// check if current target is a boss, otherwise we won't use metal detector
			if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
				var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

				if (enemyBossHealthPercent <= 0.25) { // We want sufficient time for the metal detector to be applicable
					// Metal Detector is purchased, cooled down, and needed. Trigger it.
					if (canUseAbility(ABILITIES.METAL_DETECTOR)) {
						advLog('Metal Detector is purchased and cooled down, Triggering it on boss', 2);
						triggerAbility(ABILITIES.METAL_DETECTOR);
					} else if (canUseItem(ABILITIES.TREASURE)) {
						advLog('Treasure is available and cooled down, Triggering it on boss', 2);
						triggerItem(ABILITIES.TREASURE);
					}
				}
			}
		}
	}


	function useMaxElementalDmgIfRelevant() {
		// Check if Max Elemental Damage is purchased
		if (isAbilityActive(ABILITIES.MAX_ELEMENTAL_DAMAGE) || Math.random() > control.useAbilityChance) {
			return;
		}
		if (tryUsingItem(ABILITIES.MAX_ELEMENTAL_DAMAGE, true)) {
			// Max Elemental Damage is purchased, cooled down, and needed. Trigger it.
			advLog('Max Elemental Damage is purchased and cooled down, triggering it.', 2);
		}
	}

	function useWormholeIfRelevant() {
		// Check the time before using wormhole.
		var level = getGameLevel();
		if (level % control.rainingRounds !== 0) {
			return;
		}
		// Check if Wormhole is purchased
		if (hasItem(ABILITIES.WORMHOLE)) {
			// Force usage of it regardless of cooldown. Will work if at least one NL was used suring the last second.
			triggerAbility(ABILITIES.WORMHOLE);
			advLog('Less than ' + control.minsLeft + ' minutes for game to end. Triggering wormholes...', 2);
		}
	}

	function useLikeNewIfRelevant() {
		// Allow Like New use for next farm boss round.
		if (!hasItem(ABILITIES.LIKE_NEW)) {
			return;
		}

		var level = getGameLevel();
		//if (level % control.rainingRounds !== 0 && !canUseLikeNew) {
		//	canUseLikeNew = true;
		//	return;
		//}
		// Check if wormhole is on cooldown and roll the dice.

		var cLobbyTime = (getCurrentTime() - s().m_rgGameData.timestamp_game_start) / 3600;
		var likeNewChance = (control.useLikeNewMaxChance - control.useLikeNewMinChance) * cLobbyTime/24.0 + control.useLikeNewMinChance;

		if (Math.random() > likeNewChance || level % control.rainingRounds !== 0) {
			return;
		}
		// Start a timer between 1 and 5 seconds to try to use LikeNew.
		var rand = Math.floor(Math.random() * control.useLikeNewMaxTime - control.useLikeNewMinTime + control.useLikeNewMinTime);
		setTimeout(useLikeNew, rand);
		advLog('Attempting to use Like New after ' + rand + 'ms.', 2);
		//canUseLikeNew = false;
	}

	function useLikeNew() {
		// Make sure that we're still in the boss round when we actually use it.
		var level = getGameLevel();
		if (level % control.rainingRounds === 0) {
			if (tryUsingItem(ABILITIES.LIKE_NEW)) {
				advLog('We can actually use Like New semi-reliably! Cooldowns-b-gone.', 2);
				//canUseLikeNew = true;
			}
		}
	}

	function useReviveIfRelevant(level) {
		if (level % 10 === 9 && Math.random() <= control.useAbilityChance && tryUsingItem(ABILITIES.RESURRECTION)) {
			// Resurrect is purchased and we are using it.
			advLog('Triggered Resurrect.');
		}
	}

	function attemptRespawn() {
		if ((s().m_bIsDead) &&
			((s().m_rgPlayerData.time_died) + 5) < (s().m_nTime)) {
			w.RespawnPlayer();
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

	function canUseOffensiveAbility() {
		var level = getGameLevel();
		var levelmod = level % control.rainingRounds;
		// Early in the game, or we're a safe distance away from raining rounds.
		return (levelmod > 0 && levelmod < control.rainingRounds - control.rainingSafeRounds);
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

	function getCurrentTime() {
		return s().m_rgGameData.timestamp;
	}

	function getActiveAbilityLaneCount(ability) {
		var now = getCurrentTime();
		var abilities = s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].active_player_abilities;
		var count = 0;
		for (var i = 0; i < abilities.length; i++) {
			if (abilities[i].ability != ability || abilities[i].timestamp_done < now) {
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
		if (w.g_Minigame && s().m_bRunning && s().m_rgPlayerTechTree && s().m_rgGameData) {
			w.clearInterval(w.SteamDB_Minigame_Timer);
			firstRun();
			w.SteamDB_Minigame_Timer = w.setInterval(MainLoop, 1000);
		}
	}, 1000);

	// reload page if game isn't fully loaded, regardless of autoRefresh setting
	w.setTimeout(function() {
		// m_rgGameData is 'undefined' if stuck at 97/97 or below
		if (!w.g_Minigame || !w.g_Minigame.m_CurrentScene || !w.g_Minigame.m_CurrentScene.m_rgGameData) {
			w.location.reload(true);
		}
	}, autoRefreshSecondsCheckLoadedDelay * 1000);

	// Append gameid to breadcrumbs
	var breadcrumbs = document.querySelector('.breadcrumbs');

	function countdown(time) {
		var hours = 0;
		var minutes = 0;
		for (var i = 0; i < 24; i++) {
			if (time >= 3600) {
				time = time - 3600;
				hours = hours + 1;
			}
		}
		for (var j = 0; j < 60; j++) {
			if (time >= 60) {
				time = time - 60;
				minutes = minutes + 1;
			}
		}
		return {hours : hours, minutes : minutes};
	}

	function expectedLevel(level) {
		var time = Math.floor(s().m_nTime) % 86400;
		time = time - 16*3600;
		if (time < 0) {
			time = time + 86400;
		}

		var remaining_time = 86400 - time;
		var passed_time = getCurrentTime() - s().m_rgGameData.timestamp_game_start;
		var expected_level = Math.floor(((level/passed_time)*remaining_time)+level);
		var likely_level = Math.floor((expected_level - level)/Math.log(3))+ level;

		return {expected_level : expected_level, likely_level : likely_level, remaining_time : remaining_time};
	}

	if (breadcrumbs) {
		var element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#D4E157';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Room ' + w.g_GameID;
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#FFA07A';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Level: 0, Expected Level: 0, Likely Level: 0';
		breadcrumbs.appendChild(element);
		document.ExpectedLevel = element;

		element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#9AC0FF';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Remaining Time: 0 hours, 0 minutes.';
		breadcrumbs.appendChild(element);
		document.RemainingTime = element;

		element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#33FF33';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Skipped 0 levels in last 5s.';
		breadcrumbs.appendChild(element);
		document.LevelsSkip = element;
	}

	function updateLevelInfoTitle(level)
	{
		var exp_lvl = expectedLevel(level);
		var rem_time = countdown(exp_lvl.remaining_time);
		var lvl_skip = getLevelsSkipped();

		document.ExpectedLevel.textContent = 'Level: ' + w.FormatNumberForDisplay(level) + ', Expected Level: ' + w.FormatNumberForDisplay(exp_lvl.expected_level) + ', Likely Level: ' + w.FormatNumberForDisplay(exp_lvl.likely_level);
		document.RemainingTime.textContent = 'Remaining Time: ' + rem_time.hours + ' hours, ' + rem_time.minutes + ' minutes.';
		document.LevelsSkip.textContent = 'Skipped ' + lvl_skip + ' levels in last 5s.';
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
			var $context = w.$J(context);
			var desc = $context.data('desc');
			var strOut = desc;
			var multiplier = parseFloat($context.data('multiplier'));
			switch ($context.data('upgrade_type')) {
				case 2: // Type for click damage. All tiers.
					strOut = trt_oldTooltip(context);
					var currentCrit = getClickDamage() * getCritMultiplier();
					var newCrit = w.g_Minigame.CurrentScene().m_rgTuningData.player.damage_per_click * (getClickDamageMultiplier() + multiplier) * getCritMultiplier();
					strOut += '<br><br>Crit Click: ' + w.FormatNumberForDisplay(currentCrit) + ' => ' + w.FormatNumberForDisplay(newCrit);
					break;
				case 7: // Lucky Shot's type.
					var currentMultiplier = getCritMultiplier();
					var newMultiplier = currentMultiplier + multiplier;
					var dps = getDPS();
					var clickDamage = getClickDamage();

					strOut += '<br><br>You can have multiple crits in a second. The server combines them into one.';

					strOut += '<br><br>Crit Percentage: ' + getCritChance().toFixed(1) + '%';

					strOut += '<br><br>Critical Damage Multiplier:';
					strOut += '<br>Current: ' + (currentMultiplier) + 'x';
					strOut += '<br>Next Level: ' + (newMultiplier) + 'x';

					strOut += '<br><br>Damage with one crit:';
					strOut += '<br>DPS: ' + w.FormatNumberForDisplay(currentMultiplier * dps) + ' => ' + w.FormatNumberForDisplay(newMultiplier * dps);
					strOut += '<br>Click: ' + w.FormatNumberForDisplay(currentMultiplier * clickDamage) + ' => ' + w.FormatNumberForDisplay(newMultiplier * clickDamage);
					strOut += '<br><br>Base Increased By: ' + multiplier.toFixed(1) + 'x';
					break;
				case 9: // Boss Loot Drop's type
					strOut += '<br><br>Boss Loot Drop Rate:';
					strOut += '<br>Current: ' + getBossLootChance().toFixed(0) + '%';
					strOut += '<br>Next Level: ' + (getBossLootChance() + multiplier * 100).toFixed(0) + '%';
					strOut += '<br><br>Base Increased By: ' + w.FormatNumberForDisplay(multiplier * 100) + '%';
					break;
				default:
					return trt_oldTooltip(context);
			}

			return strOut;
		};
	}

	function enableMultibuy(){

		// We have to add this to the scene so that we can access the "this" identifier.
		s().trt_oldbuy = w.g_Minigame.m_CurrentScene.TrySpendBadgePoints;
		w.g_Minigame.m_CurrentScene.TrySpendBadgePoints = function(ele, count){

			if (count != 1){
				s().trt_oldbuy(ele, count);
				return;
			}

			var instance = this;
			var $ele = w.$J(ele);

			var name = w.$J('.name', ele).text();
			var type = $ele.data('type');
			var cost = $ele.data('cost');

			var badge_points = instance.m_rgPlayerTechTree.badge_points;
			var maxBuy = Math.floor(badge_points / cost);
			var resp = prompt("How many "+ name + " do you want to buy? (max " + maxBuy + ")", 0);

			if (!resp){
				return;
			}

			var newCount = parseInt(resp);

			if (isNaN(newCount) || newCount < 0) {
				alert("Please enter a positive number.");
				return;
			}

			if ( instance.m_rgPlayerTechTree.badge_points < (cost * newCount))
			{
				alert("Not enough badge points.");
				return;
			}

			s().trt_oldbuy(ele, newCount);
		};
	}

	function getGameLevel() {
		return s().m_rgGameData.level + 1;
	}

	/** Check periodicaly if the welcome panel is visible
	 * then trigger an event 'event:welcomePanelVisible' */
	function waitForWelcomePanelLoad() {
		var checkTicks = 20; // not very elegant but effective
		var waitForWelcomePanelInterval = setInterval(function() {
			var $welcomePanel = w.$J('.spend_badge_ponts_ctn');
			var panelReady = !!($welcomePanel && $welcomePanel.length && $welcomePanel.is(':visible'));

			if(panelReady) { // Got it! Tuning time!
				window.document.dispatchEvent(new Event('event:welcomePanelVisible'));
				clearInterval(waitForWelcomePanelInterval);
			}
			else if(w.g_Minigame && w.g_Minigame.CurrentScene() && w.g_Minigame.CurrentScene().m_rgPlayerTechTree
					&& !w.g_Minigame.CurrentScene().m_rgPlayerTechTree.badge_points) { // techtree but no points
				clearInterval(waitForWelcomePanelInterval);
			}
			else if(--checkTicks <= 0) { // give up
				clearInterval(waitForWelcomePanelInterval);
			}
		}, 500);
	}

	// Wait for welcome panel then add more buttons for batch purchase
	w.document.addEventListener('event:welcomePanelVisible', function() {
		// Select existings x10 buttons
		w.$J('#badge_items > .purchase_ability_item > .sub_item').each(function() {
			var x10Button = w.$J(this);

			// New button
			var x100Button = w.$J('<div class="sub_item x100">x100</div>');
			x100Button.click(function(event) { // same from steam script but x100 (incredible!)
					w.g_Minigame.CurrentScene().TrySpendBadgePoints(this, 100);
					event.stopPropagation();
				});
			x100Button.data(x10Button.data());

			x10Button.css('margin-right', '50px'); // Shift the x10 button a little
			x10Button.after(x100Button);
		});

		// Wrap panel update to unable/disable x100 buttons
		var oldUpdate = w.g_Minigame.CurrentScene().m_UI.UpdateSpendBadgePointsDialog;
		w.g_Minigame.CurrentScene().m_UI.UpdateSpendBadgePointsDialog = function() {
			oldUpdate.apply(w.g_Minigame.CurrentScene().m_UI, arguments); // super call

			// remaining badgepoints
			var badgePoints = w.g_Minigame.CurrentScene().m_rgPlayerTechTree.badge_points;

			// each x100 button
			w.$J('#badge_items > .purchase_ability_item > .sub_item.x100').each(function() {
				var button = w.$J(this);
				// disable if not enougth points
				if(badgePoints < button.data().cost * 100) {
					button.addClass('disabled');
				}
				else {
					button.removeClass('disabled');
				}
			});
		};
	}, false);


}(window));
