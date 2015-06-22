// ==UserScript==
// @name         Monster Minigame AutoUpgrade 2.0
// @namespace    https://github.com/Pawsed/SteamMonsterAutoUpgradeManager/
// @version      2.0
// @description  An automatic upgrade manager for the 2015 Summer Steam Monster Minigame
// @match        *://steamcommunity.com/minigame/towerattack*
// @match        *://steamcommunity.com//minigame/towerattack*
// @updateURL    https://github.com/Pawsed/SteamMonsterAutoUpgradeManager/raw/master/upgrademanager.user.js
// @downloadURL  https://github.com/Pawsed/SteamMonsterAutoUpgradeManager/raw/master/upgrademanager.user.js
// @grant        none
// ==/UserScript==
// Automatically buy miscellaneous abilities? Medics is considered
// essential and will be bought despite this setting.
var autoBuyAbilities = false;

// How many elements do you want to upgrade? If we decide to upgrade an
// element, we'll try to always keep this many as close in levels as we
// can, and ignore the rest.
var elementalSpecializations = 0;

// How frequent do we check to see if we can upgrade?
var upgradeManagerPeriod = 500;
var busyCount = 0;

var survivalTime = 10;
var autoUpgradeManager, upgradeManagerPrefilter;

function startAutoUpgradeManager() {
	if (autoUpgradeManager) {
		console.log("UpgradeManager is already running!");
		return;
	}

	/************
	 * SETTINGS *
	 ************/

	// Should we highlight the item we're going for next?
	var highlightNext = true;

	// Should we automatically by the next item?
	var autoBuyNext = true;

	// To estimate the overall boost in damage from upgrading an element,
	// we sort the elements from highest level to lowest, then multiply
	// each one's level by the number in the corresponding spot to get a
	// weighted average of their effects on your overall damage per click.
	// If you don't prioritize lanes that you're strongest against, this
	// will be [0.25, 0.25, 0.25, 0.25], giving each element an equal
	// scaling. However, this defaults to [0.4, 0.3, 0.2, 0.1] under the
	// assumption that you will spend much more time in lanes with your
	// strongest elements.
	var elementalCoefficients = [0.4, 0.3, 0.2, 0.1];

	// To include passive DPS upgrades (Auto-fire, etc.) we have to scale
	// down their DPS boosts for an accurate comparison to clicking. This
	// is approximately how many clicks per second we should assume you are
	// consistently doing. If you have an autoclicker, this is easy to set.

	/***********
	 * GLOBALS *
	 ***********/
	var scene = g_Minigame.CurrentScene();
	var waitingForUpdate = false;

	var next = {
		id: -1,
		cost: 0
	};

	var necessary = [
		{
			id: 11,
			level: 1
		} // Medics
	];

	var gAbilities = [
		11, // Medics
		13, // Good Luck Charms
		16, // Tactical Nuke
		18, // Napalm
		17, // Cluster Bomb
		14, // Metal Detector
		15, // Decrease Cooldowns
		12 // Morale Booster
	];

	var gLuckyShot = 7;
	var gElementalUpgrades = [3, 4, 5, 6]; // Fire, Water, Earth, Air

	var gHealthUpgrades = [];
	var gAutoUpgrades = [];
	var gDamageUpgrades = [];

	Object.keys(scene.m_rgTuningData.upgrades)
		.sort(function(a, b) {
			return a - b;
		}) // why is default sort string comparison
		.forEach(function(id) {
			var upgrade = scene.m_rgTuningData.upgrades[id];
			switch (upgrade.type) {
				case 0:
					gHealthUpgrades.push(+id);
					break;
				case 1:
					gAutoUpgrades.push(+id);
					break;
				case 2:
					gDamageUpgrades.push(+id);
					break;
			}
		});

	/***********
	 * HELPERS *
	 ***********/
	var getElementals = (function() {
		var cache = false;
		return function(refresh) {
			if (!cache || refresh) {
				cache = gElementalUpgrades
					.map(function(id) {
						return {
							id: id,
							level: scene.GetUpgradeLevel(id)
						};
					})
					.sort(function(a, b) {
						return b.level - a.level;
					});
			}
			return cache;
		};
	})();

	var getElementalCoefficient = function(elementals) {
		elementals = elementals || getElementals();
		return scene.m_rgTuningData.upgrades[4].multiplier *
			elementals.reduce(function(sum, elemental, i) {
				return sum + elemental.level * elementalCoefficients[i];
			}, 0);
	};

	var canUpgrade = function(id) {
		// do we even have the upgrade?
		if (!scene.bHaveUpgrade(id)) return false;

		// does it have a required upgrade?
		var data = scene.m_rgTuningData.upgrades[id];
		var required = data.required_upgrade;
		if (required !== undefined) {
			// is it at the required level to unlock?
			var level = data.required_upgrade_level || 1;
			return (level <= scene.GetUpgradeLevel(required));
		}

		// otherwise, we're good to go!
		return true;
	};

	var calculateUpgradeTree = function(id, level) {
		var data = scene.m_rgTuningData.upgrades[id];
		var boost = 0;
		var cost = 0;
		var parent;

		var cur_level = scene.GetUpgradeLevel(id);
		if (level === undefined) level = cur_level + 1;

		// for each missing level, add boost and cost
		for (var level_diff = level - cur_level; level_diff > 0; level_diff--) {
			boost += data.multiplier;
			cost += data.cost * Math.pow(data.cost_exponential_base, level - level_diff);
		}

		// recurse for required upgrades`
		var required = data.required_upgrade;
		if (required !== undefined) {
			var parents = calculateUpgradeTree(required, data.required_upgrade_level || 1);
			if (parents.cost > 0) {
				boost += parents.boost;
				cost += parents.cost;
				parent = parents.required || required;
			}
		}

		return {
			boost: boost,
			cost: cost,
			required: parent
		};
	};

	var necessaryUpgrade = function() {
		var best = {
			id: -1,
			cost: 0
		};
		var wanted, id;
		while (necessary.length > 0) {
			wanted = necessary[0];
			id = wanted.id;
			if (scene.GetUpgradeLevel(id) < wanted.level) {
				best = {
					id: id,
					cost: scene.GetUpgradeCost(id)
				};
				break;
			}
			necessary.shift();
		}
		return best;
	};

	var nextAbilityUpgrade = function() {
		var best = {
			id: -1,
			cost: 0
		};
		if (autoBuyAbilities) {
			gAbilities.some(function(id) {
				if (canUpgrade(id) && scene.GetUpgradeLevel(id) < 1) {
					best = {
						id: id,
						cost: scene.GetUpgradeCost(id)
					};
					return true;
				}
			});
		}
		return best;
	};

	var bestHealthUpgrade = function() {
		var best = {
			id: -1,
			cost: 0,
			hpg: 0
		};
		var result, hpg;
		gHealthUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			hpg = scene.m_rgTuningData.player.hp * result.boost / result.cost;
			if (hpg >= best.hpg) {
				if (result.required !== undefined) id = result.required;
				cost = scene.GetUpgradeCost(id);
				if (cost <= scene.m_rgPlayerData.gold || (best.cost === 0 || cost < best.cost)) { // TODO
					best = {
						id: id,
						cost: cost,
						hpg: hpg
					};
				}
			}
		});
		return best;
	};

	var bestDamageUpgrade = function() {
		var best = {
			id: -1,
			cost: 0,
			dpg: 0
		};
		var result, data, cost, dpg, boost;

		var dpc = scene.m_rgPlayerTechTree.damage_per_click;
		var base_dpc = scene.m_rgTuningData.player.damage_per_click;
		var critmult = scene.m_rgPlayerTechTree.damage_multiplier_crit;
		var unusedCritChance = getAbilityItemQuantity(18) * 0.01; // Take unused Crit items into account, since they will probably be applied soon
		var critrate = Math.min(scene.m_rgPlayerTechTree.crit_percentage + unusedCritChance, 1);
		var elementals = getElementals();
		var elementalCoefficient = getElementalCoefficient(elementals);

		// check auto damage upgrades
		gAutoUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			dpg = 0;
			/*if (dpg >= best.dpg) {
			 if (result.required !== undefined) id = result.required;
			 best = {
			 id: id,
			 cost: scene.GetUpgradeCost(id),
			 dpg: dpg
			 };
			 }*/
		});

		// check Lucky Shot
		if (canUpgrade(gLuckyShot)) { // lazy check because prereq is necessary upgrade
			data = scene.m_rgTuningData.upgrades[gLuckyShot];
			boost = dpc * critrate * data.multiplier;
			cost = scene.GetUpgradeCost(gLuckyShot);
			dpg = boost / cost;
			if (dpg >= best.dpg) {
				best = {
					id: gLuckyShot,
					cost: cost,
					dpg: dpg
				};
			}
		}

		// check click damage upgrades
		gDamageUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			dpg = base_dpc * result.boost * (critrate * critmult + (1 - critrate) * elementalCoefficient) / result.cost;
			if (dpg >= best.dpg) {
				if (result.required !== undefined) id = result.required;
				best = {
					id: id,
					cost: scene.GetUpgradeCost(id),
					dpg: dpg
				};
			}
		});

		// check elementals
		data = scene.m_rgTuningData.upgrades[4];
		var elementalLevels = elementals.reduce(function(sum, elemental) {
			return sum + elemental.level;
		}, 1);
		cost = data.cost * Math.pow(data.cost_exponential_base, elementalLevels);

		// - make new elementals array for testing
		var testElementals = elementals.map(function(elemental) {
			return {
				level: elemental.level
			};
		});
		if (elementalSpecializations != 0) {
			var upgradeLevel = testElementals[elementalSpecializations - 1].level;
			testElementals[elementalSpecializations - 1].level++;
			if (elementalSpecializations > 1) {
				// swap positions if upgraded elemental now has bigger level than (originally) next highest
				var prevElem = testElementals[elementalSpecializations - 2].level;
				if (prevElem <= upgradeLevel) {
					testElementals[elementalSpecializations - 2].level = upgradeLevel + 1;
					testElementals[elementalSpecializations - 1].level = prevElem;
				}
			}
		}

		// - calculate stats
		boost = dpc * (1 - critrate) * (getElementalCoefficient(testElementals) - elementalCoefficient);
		dpg = boost / cost;
		if (dpg > best.dpg) { // give base damage boosters priority
			// find all elements at upgradeLevel and randomly pick one
			var match = elementals.filter(function(elemental) {
				return elemental.level == upgradeLevel;
			});
			match = match[Math.floor(Math.random() * match.length)].id;
			best = {
				id: match,
				cost: cost,
				dpg: dpg
			};
		}

		return best;
	};

	var timeToDie = (function() {
		var cache = false;
		return function(refresh) {
			if (cache === false || refresh) {
				var maxHp = scene.m_rgPlayerTechTree.max_hp;
				var enemyDps = scene.m_rgGameData.lanes.reduce(function(max, lane) {
					return Math.max(max, lane.enemies.reduce(function(sum, enemy) {
						return sum + enemy.dps;
					}, 0));
				}, 0);
				cache = maxHp / (enemyDps || scene.m_rgGameData.level * 4);
			}
			return cache;
		};
	})();

	var updateNext = function() {
		next = necessaryUpgrade();
		if (next.id === -1) {
			if (timeToDie() < survivalTime) {
				next = bestHealthUpgrade();
			}

			else {
				var damage = bestDamageUpgrade();
				var ability = nextAbilityUpgrade();
				next = (damage.cost < ability.cost || ability.id === -1) ? damage : ability;
			}
		}
		if (next.id !== -1) {
			if (highlightNext) {
				$J('.next_upgrade').removeClass('next_upgrade');
				$J(document.getElementById('upgr_' + next.id)).addClass('next_upgrade');
			}
			console.log(
				'%cnext buy: %c%s %c(%s)', 'font-weight:bold', 'color:red',
				scene.m_rgTuningData.upgrades[next.id].name, 'color:red;font-style:italic',
				FormatNumberForDisplay(next.cost)
			);
		}
	};

	var hook = function(base, method, func) {
		var original = method + '_upgradeManager';
		if (!base.prototype[original]) base.prototype[original] = base.prototype[method];
		base.prototype[method] = function() {
			this[original].apply(this, arguments);
			func.apply(this, arguments);
		};
	};

	/********
	 * MAIN *
	 ********/
		// ---------- JS hooks ----------
	hook(CSceneGame, 'TryUpgrade', function() {
		// if it's a valid try, we should reevaluate after the update
		if (this.m_bUpgradesBusy) {
			if (highlightNext) $J(document.body).addClass('upgrade_waiting');
			next.id = -1;
		}
	});

	hook(CSceneGame, 'ChangeLevel', function() {
		// recalculate enemy DPS to see if we can survive this level
		if (timeToDie(true) < survivalTime) updateNext();
	});

	upgradeManagerPrefilter = function(opts, origOpts, xhr) {
		if (/ChooseUpgrade/.test(opts.url)) {
			xhr
				.success(function() {
					// wait as short a delay as possible
					// then we re-run to figure out the next item to queue
					window.setTimeout(upgradeManager, 0);
				})
				.fail(function() {
					// we're desynced. wait til data refresh
					// m_bUpgradesBusy was not set to false
					scene.m_bNeedTechTree = true;
					waitingForUpdate = true;
				});
		} else if (/GetPlayerData/.test(opts.url)) {
			if (waitingForUpdate) {
				xhr.success(function(result) {
					var message = g_Server.m_protobuf_GetPlayerDataResponse.decode(result).toRaw(true, true);
					if (message.tech_tree) {
						// done waiting! no longer busy
						waitingForUpdate = false;
						scene.m_bUpgradesBusy = false;
						window.setTimeout(upgradeManager, 0);
					}
				});
			}
		}
	};

	// ---------- CSS ----------
	$J(document.body).removeClass('upgrade_waiting');
	$J('.next_upgrade').removeClass('next_upgrade');
	if (highlightNext) {
		var cssPrefix = function(property, value) {
			return '-webkit-' + property + ': ' + value + '; ' + property + ': ' + value + ';';
		};

		var css =
			'.next_upgrade { ' + cssPrefix('filter', 'brightness(1.5) contrast(2)') + ' }\n' +
			'.next_upgrade.cantafford { ' + cssPrefix('filter', 'contrast(1.3)') + ' }\n' +
			'.next_upgrade .info .name, .next_upgrade.element_upgrade .level { color: #e1b21e; }\n' +
			'#upgrades .next_upgrade .link { ' + cssPrefix('filter', 'brightness(0.8) hue-rotate(120deg)') + ' }\n' +
			'#elements .next_upgrade .link { ' + cssPrefix('filter', 'hue-rotate(120deg)') + ' }\n' +
			'.next_upgrade .cost { ' + cssPrefix('filter', 'hue-rotate(-120deg)') + ' }\n' +
			'.upgrade_waiting .next_upgrade { ' + cssPrefix('animation', 'blink 1s infinite alternate') + ' }\n' +
			'@-webkit-keyframes blink { to { opacity: 0.5; } }\n' +
			'@keyframes blink { to { opacity: 0.5; } }';

		var style = document.getElementById('upgradeManagerStyles');
		if (!style) {
			style = document.createElement('style');
			$J(style).attr('id', 'upgradeManagerStyles').appendTo('head');
		}
		$J(style).html(css);
	}

	// ---------- Timer ----------
	function upgradeManager() {
		scene = g_Minigame.CurrentScene();

		// tried to buy upgrade and waiting for reply; don't do anything
		if (scene.m_bUpgradesBusy) {
			busyCount++;
			if(busyCount < 5){
				return;
			}
			m_bUpgradesBusy = false;
			busyCount = 0;
		}

		// no item queued; refresh stats and queue next item
		if (next.id === -1) {
			if (highlightNext) $J(document.body).removeClass('upgrade_waiting');
			getElementals(true);
			timeToDie(true);
			updateNext();
		}

		// item queued; buy if we can afford it
		if (next.id !== -1 && autoBuyNext) {
			if (next.cost <= scene.m_rgPlayerData.gold) {
				var link = $J('.link', document.getElementById('upgr_' + next.id)).get(0);
				if (link) {
					scene.TryUpgrade(link);
				} else {
					console.error('failed to find upgrade');
				}
			}
		}
	}

	autoUpgradeManager = setInterval(upgradeManager, upgradeManagerPeriod);

	console.log("autoUpgradeManager has been started.");
}

function getAbilityItemQuantity(abilityID) {
	for (var i = 0; i < g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items.length; ++i) {
		var abilityItem = g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items[i];

		if (abilityItem.ability == abilityID)
			return abilityItem.quantity;
	}

	return 0;
}

function gameRunning() {
	return g_Minigame && g_Minigame.CurrentScene() && g_Minigame.CurrentScene().m_bRunning;
}

function tryStart() {
	if (!gameRunning()) {
		setTimeout(tryStart, 1000);
	} else {
		if (!upgradeManagerPrefilter) {
			// add prefilter on first run
			$J.ajaxPrefilter(function() {
				// this will be defined by the end of the script
				upgradeManagerPrefilter.apply(this, arguments);
			});
		}
		startAutoUpgradeManager();
		/*upgradeManager = startAutoUpgradeManager();
		 if (upgradeManagerTimer) window.clearTimeout(upgradeManagerTimer);
		 var upgradeManagerTimer = window.setInterval(upgradeManager, 5000);*/
	}
}

setTimeout(tryStart, 5000);
