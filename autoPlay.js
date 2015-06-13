// ==UserScript== 
// @name Monster Minigame AutoScript
// @author /u/mouseasw for creating and maintaining the script, /u/WinneonSword for the Greasemonkey support, and every contributor on the GitHub repo for constant enhancements. /u/wchill and contributors on his repo for MSG2015-specific improvements.
// @version 1.94
// @namespace https://github.com/wchill/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @match http://steamcommunity.com/minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js
// @downloadURL https://raw.githubusercontent.com/wchill/steamSummerMinigame/master/autoPlay.js
// ==/UserScript==

// IMPORTANT: Update the @version property above to a higher number such as 1.1 and 1.2 when you update the script! Otherwise, Tamper / Greasemonkey users will not update automatically.

// OPTIONS
var enableAutoClicker = true; // set to false to disable autoclicker
var clickRate = 20; // change to number of desired clicks per second
var setClickVariable = false; // change to true to improve performance

var disableParticleEffects = true; // Set to false to keep particle effects

var disableFlinching = false; // Set to true to disable flinching animation for enemies.
var disableCritText = false; // Set to true to disable the crit text.
var disableText = false; // Remove all animated text. This includes damage, crits and gold gain. 
                         // This OVERRIDES all text related options.

var isAlreadyRunning = false;

var ABILITIES = {
	"MORALE_BOOSTER": 5,
	"GOOD_LUCK": 6,
	"MEDIC": 7,
	"METAL_DETECTOR": 8,
	"COOLDOWN": 9,
	"NUKE": 10,
	"CLUSTER_BOMB": 11,
	"NAPALM": 12
};

var ITEMS = {
	"REVIVE": 13,
	"GOLD_RAIN": 17,
	"GOD_MODE": 21,
	"REFLECT_DAMAGE":24,
	"CRIT": 18,
	"PUMPED_UP": 19,
	"CRIPPLE_MONSTER": 15,
	"CRIPPLE_SPAWNER": 14,
	"MAXIMIZE_ELEMENT": 16
};
	
var ENEMY_TYPE = {
	"SPAWNER":0,
	"CREEP":1,
	"BOSS":2,
	"MINIBOSS":3,
	"TREASURE":4
};

// Save old functions for toggles.
var trt_oldCrit = window.g_Minigame.CurrentScene().DoCritEffect;
var trt_oldPush = window.g_Minigame.m_CurrentScene.m_rgClickNumbers.push;
var trt_critToggle = false;
var trt_textToggle = false;

if (thingTimer){
	window.clearInterval(thingTimer);
}

function firstRun() {
	// disable particle effects - this drastically reduces the game's memory leak
	if (disableParticleEffects) {
		disableParticles();
		g_Minigame.CurrentScene().DoCritEffect = function( nDamage, x, y, additionalText ) {};
	}

	// disable enemy flinching animation when they get hit
	if (disableFlinching) {
		stopFlinching();
	}

	// Crit toggle.
	if (disableCritText) {
		toggleCritText();
	}

	// Text toggle.
	if (disableText) {
		toggleText();
	}
}

// Remove most effects from the game. Most of these are irreversible.
// Currently invoked only if specifically called.
function trt_destroyAllEffects(){
	stopFlinching();
	disableParticles();
	if (!trt_textToggle){
		toggleText();
	}
}

// Callable function to remove particles.
function disableParticles() {
	if (window.g_Minigame) {
		window.g_Minigame.CurrentScene().DoClickEffect = function() {};
		window.g_Minigame.CurrentScene().SpawnEmitter = function(emitter) {
			emitter.emit = false;
			return emitter;
		}
	}
}

// Callable function to stop the flinching animation.
function stopFlinching(){
	if (window.CEnemy) {
		window.CEnemy.prototype.TakeDamage = function() {};
	}
	if (window.CEnemySpawner) {
		window.CEnemySpawner.prototype.TakeDamage = function() {};
	}
	if (window.CEnemyBoss) {
		window.CEnemyBoss.prototype.TakeDamage = function() {};
	}
}

function toggleCritText(){
	if (!trt_critToggle) {
		// Replaces the entire crit display function.
		window.g_Minigame.CurrentScene().DoCritEffect = function( nDamage, x, y, additionalText ) {};
		trt_critToggle = true;
	} else {
		window.g_Minigame.CurrentScene().DoCritEffect = trt_oldCrit;
		trt_critToggle = false;
	}
}

// Toggles text on and off. We can't explicitly call disable/enable since we need to save the old function.
function toggleText(){
	if (!trt_textToggle) {
		// Replaces the entire text function.
		window.g_Minigame.m_CurrentScene.m_rgClickNumbers.push = function(elem){
			elem.container.removeChild(elem);
		};
		trt_textToggle = true;
	} else {
		window.g_Minigame.m_CurrentScene.m_rgClickNumbers.push = trt_oldPush;
		trt_textToggle = false;
	}
}

function doTheThing() {
	if (isAlreadyRunning || g_Minigame === undefined || !g_Minigame.CurrentScene().m_bRunning || !g_Minigame.CurrentScene().m_rgPlayerTechTree) {
		return;
	}
	isAlreadyRunning = true;
	
	goToLaneWithBestTarget();
	
	useGoodLuckCharmIfRelevant();
	useMedicsIfRelevant();
	useMoraleBoosterIfRelevant();
	useClusterBombIfRelevant();
	useNapalmIfRelevant();
	
	// TODO use abilities if available and a suitable target exists
	// - Tactical Nuke on a Spawner if below 50% and above 25% of its health
	// - Metal Detector if a boss, miniboss, or spawner death is imminent (predicted in > 2 and < 7 seconds)
	// - Morale Booster if available and lane has > 2 live enemies
	// - Decrease Cooldowns right before using another long-cooldown item.
	//       (Decrease Cooldown affects abilities triggered while it is active, not night before it's used)
	
	// TODO purchase abilities and upgrades intelligently
	
	attemptRespawn();
	
	
	
	isAlreadyRunning = false;
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
		
	var skippingSpawner = false;
	var skippedSpawnerLane = 0;
	var skippedSpawnerTarget = 0;
	var targetIsTreasureOrBoss = false;
	
	for (var k = 0; !targetFound && k < enemyTypePriority.length; k++) {
		
		if (enemyTypePriority[k] == ENEMY_TYPE.TREASURE || enemyTypePriority[k] == ENEMY_TYPE.BOSS){
			targetIsTreasureOrBoss = true;
		} else {
			targetIsTreasureOrBoss = false;
		}
		
		var enemies = [];
		
		// gather all the enemies of the specified type.
		for (var i = 0; i < 3; i++) {
			for (var j = 0; j < 4; j++) {
				var enemy = g_Minigame.CurrentScene().GetEnemy(i, j);
				if (enemy && enemy.m_data.type == enemyTypePriority[k]) {
					enemies[enemies.length] = enemy;
				}
			}
		}
	
		//Prefer lane with raining gold, unless current enemy target is a treasure or boss.
		if(lowTarget != ENEMY_TYPE.TREASURE && lowTarget != ENEMY_TYPE.BOSS ){
			var potential = 0;
			for(var i = 0; i < g_Minigame.CurrentScene().m_rgGameData.lanes.length; i++){
				// ignore if lane is empty
				if(g_Minigame.CurrentScene().m_rgGameData.lanes[i].dps == 0)
					continue;
				var stacks = 0;
				if(typeof g_Minigame.m_CurrentScene.m_rgLaneData[i].abilities[17] != 'undefined')
					stacks = g_Minigame.m_CurrentScene.m_rgLaneData[i].abilities[17];
					//console.log('stacks: ' + stacks);
				for(var m = 0; m < g_Minigame.m_CurrentScene.m_rgEnemies.length; m++) {
					var enemyGold = g_Minigame.m_CurrentScene.m_rgEnemies[m].m_data.gold;
					if (stacks * enemyGold > potential) {
                				potential = stacks * enemyGold;
						preferredTarget = g_Minigame.m_CurrentScene.m_rgEnemies[m].m_nID;
						preferredLane = i;
        				}
				}
			}
		}
		
		// target the enemy of the specified type with the lowest hp
		var mostHPDone = 0;
		for (var i = 0; i < enemies.length; i++) {
			if (enemies[i] && !enemies[i].m_bIsDestroyed) {
				// Only select enemy and lane if the preferedLane matches the potential enemy lane
				if(lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
					var element = g_Minigame.CurrentScene().m_rgGameData.lanes[enemies[i].m_nLane].element;
					
					var dmg = g_Minigame.CurrentScene().CalculateDamage(
							g_Minigame.CurrentScene().m_rgPlayerTechTree.dps,
							element
						);
					if(mostHPDone < dmg)
					{
						mostHPDone = dmg;
					}
					else continue;

					targetFound = true;
					lowHP = enemies[i].m_flDisplayedHP;
					lowLane = enemies[i].m_nLane;
					lowTarget = enemies[i].m_nID;
				}
				var percentageHP = enemies[i].m_flDisplayedHP / enemies[i].m_data.max_hp;
				if (lowPercentageHP == 0 || percentageHP < lowPercentageHP) {
					lowPercentageHP = percentageHP;
				}
			}
		}
		
		if(preferredLane != -1 && preferredTarget != -1){
			lowLane = preferredLane;
			lowTarget = preferredTarget;
			console.log('Switching to a lane with best raining gold benefit');
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
		if (skippingSpawner && enemyTypePriority[k] == ENEMY_TYPE.CREEP && lowPercentageHP > creepSnagThreshold ) {
			lowLane = skippedSpawnerLane;
			lowTarget = skippedSpawnerTarget;
		}
	}

	
	// go to the chosen lane
	if (targetFound) {
		if (g_Minigame.CurrentScene().m_nExpectedLane != lowLane) {
			//console.log('switching lanes');
			g_Minigame.CurrentScene().TryChangeLane(lowLane);
		}
		
		// target the chosen enemy
		if (g_Minigame.CurrentScene().m_nTarget != lowTarget) {
			//console.log('switching targets');
			g_Minigame.CurrentScene().TryChangeTarget(lowTarget);
		}
		
		
		// Prevent attack abilities and items if up against a boss or treasure minion
		if (targetIsTreasureOrBoss) {
			// Morale
			disableAbility(ABILITIES.MORALE_BOOSTER);
			// Luck
			disableAbility(ABILITIES.GOOD_LUCK);
			// Nuke
			disableAbility(ABILITIES.NUKE);
			// Clusterbomb
			disableAbility(ABILITIES.CLUSTER_BOMB);
			// Napalm
			disableAbility(ABILITIES.NAPALM);
			// Crit
			disableAbilityItem(ITEMS.CRIT);
			// Cripple Spawner
			disableAbilityItem(ITEMS.CRIPPLE_SPAWNER);
			// Cripple Monster
			disableAbilityItem(ITEMS.CRIPPLE_MONSTER);
			// Max Elemental Damage
			disableAbilityItem(ITEMS.MAXIMIZE_ELEMENT);
			// Reflect Damage
			disableAbilityItem(ITEMS.REFLECT_DAMAGE);
		} else {
			// Morale
			enableAbility(ABILITIES.MORALE_BOOSTER);
			// Luck
			enableAbility(ABILITIES.GOOD_LUCK);
			// Nuke
			enableAbility(ABILITIES.NUKE);
			// Clusterbomb
			enableAbility(ABILITIES.CLUSTER_BOMB);
			// Napalm
			enableAbility(ABILITIES.NAPALM);
			// Crit
			enableAbilityItem(ITEMS.CRIT);
			// Cripple Spawner
			enableAbilityItem(ITEMS.CRIPPLE_SPAWNER);
			// Cripple Monster
			enableAbilityItem(ITEMS.CRIPPLE_MONSTER);
			// Max Elemental Damage
			enableAbilityItem(ITEMS.MAXIMIZE_ELEMENT);
			// Reflect Damage
			enableAbilityItem(ITEMS.REFLECT_DAMAGE);
		}
	}
}

function usePumpedUp(){
	if (hasItem(ITEMS.PUMPED_UP) && !isAbilityCoolingDown(ITEMS.PUMPED_UP)){
		// Crits is purchased, cooled down, and needed. Trigger it.
		console.log('Pumped up is always good.');
		triggerAbility(ITEMS.PUMPED_UP);
		return;
    }
};

function useMedicsIfRelevant() {
	usePumpedUp();
	var myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	
	// check if health is below 50%
	var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / myMaxHealth;
	if (hpPercent > 0.5 || g_Minigame.CurrentScene().m_rgPlayerData.hp < 1) {
		return; // no need to heal - HP is above 50% or already dead
	}
	
	// check if Medics is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.MEDIC) && !isAbilityCoolingDown(ABILITIES.MEDIC)) {

		// Medics is purchased, cooled down, and needed. Trigger it.
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		triggerAbility(ABILITIES.MEDIC);
	} else if (hasItem(ITEMS.GOD_MODE) && !isAbilityCoolingDown(ITEMS.GOD_MODE)) {
		
		console.log('We have god mode, cooled down, and needed. Trigger it.');
		triggerItem(ITEMS.GOD_MODE);
	}
};

// Use Good Luck Charm if doable
function useGoodLuckCharmIfRelevant() {

	// check if Crits is purchased and cooled down
	if (hasItem(ITEMS.CRIT) && !isAbilityCoolingDown(ITEMS.CRIT)){
		if (! isAbilityItemEnabled(ITEMS.CRIT)) {
			return;
		}
		// Crits is purchased, cooled down, and needed. Trigger it.
		console.log('Crit chance is always good.');
		triggerAbility(ITEMS.CRIT);
		return;
    }
	
	// check if Good Luck Charms is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.GOOD_LUCK)) {
		if (isAbilityCoolingDown(ABILITIES.GOOD_LUCK)) {
			return;
		}
		
		if (! isAbilityEnabled(ABILITIES.GOOD_LUCK)) {
			return;
		}

		// Good Luck Charms is purchased, cooled down, and needed. Trigger it.
		console.log('Good Luck Charms is purchased, cooled down, and needed. Trigger it.');
		triggerAbility(ABILITIES.GOOD_LUCK);
	}
}

function useClusterBombIfRelevant() {
	//Check if Cluster Bomb is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.CLUSTER_BOMB)) {
		if (isAbilityCoolingDown(ABILITIES.CLUSTER_BOMB)) {
			return;
		}
		
		//Check lane has monsters to explode
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Bombs away if spawner and 2+ other monsters
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(ABILITIES.CLUSTER_BOMB);
		}
	}
}

function useNapalmIfRelevant() {
	//Check if Napalm is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.NAPALM)) {
		if (isAbilityCoolingDown(ABILITIES.NAPALM)) {
			return;
		}
		
		//Check lane has monsters to burn
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Burn them all if spawner and 2+ other monsters
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(ABILITIES.NAPALM);
		}
	}
}

function useMoraleBoosterIfRelevant() {
	// Check if Morale Booster is purchased
	if(hasPurchasedAbility(5)) {
		if (isAbilityCoolingDown(5)) {
			return;
		}
		
		//Check lane has monsters so the hype isn't wasted
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Hype everybody up!
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(5);
		}
	}
}

function useTacticalNukeIfRelevant() {
	// Check if Tactical Nuke is purchased
	if(hasPurchasedAbility(ABILITIES.NUKE)) {
		if (isAbilityCoolingDown(ABILITIES.NUKE)) {
			return;
		}

		//Check that the lane has a spawner and record it's health percentage
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemySpawnerExists = false;
		var enemySpawnerHealthPercent = 0.0;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				if (enemy.m_data.type == 0) {
					enemySpawnerExists = true;
					enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
				}
			}
		}

		// If there is a spawner and it's health is between 60% and 30%, nuke it!
		if (enemySpawnerExists && enemySpawnerHealthPercent < 0.6 && enemySpawnerHealthPercent > 0.3) {
			console.log("Tactical Nuke is purchased, cooled down, and needed. Nuke 'em.");
			triggerAbility(ABILITIES.NUKE);
		}
	}
}

function useCrippleSpawnerIfRelevant() {
	// Check if Cripple Spawner is available
	if(hasItem(ITEMS.CRIPPLE_SPAWNER)) {
		if (isAbilityCoolingDown(ITEMS.CRIPPLE_SPAWNER)) {
			return;
		}

		//Check that the lane has a spawner and record it's health percentage
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemySpawnerExists = false;
		var enemySpawnerHealthPercent = 0.0;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				if (enemy.m_data.type == 0) {
					enemySpawnerExists = true;
					enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
				}
			}
		}

		// If there is a spawner and it's health is above 95%, cripple it!
		if (enemySpawnerExists && enemySpawnerHealthPercent > 0.95) {
			console.log("Cripple Spawner available, and needed. Cripple 'em.");
			triggerItem(ITEMS.CRIPPLE_SPAWNER);
		}
	}
}

function useGoldRainIfRelevant() {
	// Check if gold rain is purchased
	if (hasItem(ITEMS.GOLD_RAIN)) {
		if (isAbilityCoolingDown(ITEMS.GOLD_RAIN)) {
			return;
		}

		var enemy = g_Minigame.m_CurrentScene.GetEnemy(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane, g_Minigame.m_CurrentScene.m_rgPlayerData.target);
		// check if current target is a boss, otherwise its not worth using the gold rain
		if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {	
			var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

		  if (enemyBossHealthPercent >= 0.6) { // We want sufficient time for the gold rain to be applicable
				// Gold Rain is purchased, cooled down, and needed. Trigger it.
				console.log('Gold rain is purchased and cooled down, Triggering it on boss');
				triggerItem(ITEMS.GOLD_RAIN);
			}
		}
	}
}

//If player is dead, call respawn method
function attemptRespawn() {
	if ((g_Minigame.CurrentScene().m_bIsDead) && 
			((g_Minigame.CurrentScene().m_rgPlayerData.time_died * 1000) + 5000) < (new Date().getTime())) {
		RespawnPlayer();
	}
}

function isAbilityActive(abilityId) {
	return g_Minigame.CurrentScene().bIsAbilityActive(abilityId);
}

function hasItem(itemId) {
	return $J('#abilityitem_' + itemId).is(':visible');
}

function isAbilityCoolingDown(abilityId) {
	return g_Minigame.CurrentScene().GetCooldownForAbility(abilityId) > 0;
}

function hasOneUseAbility(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	return elem != null;
}

function hasPurchasedAbility(abilityId) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return (1 << abilityId) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield;
}

function triggerItem(itemId) {
	triggerAbility(itemId);
}

function triggerAbility(abilityId) {
	g_Minigame.CurrentScene().m_rgAbilityQueue.push({'ability': abilityId})
}

function disableAbility(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "hidden";
	}
}

function enableAbility(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "visible";
	}
}

function isAbilityEnabled(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return  elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}

function disableAbilityItem(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "hidden";
	}
}

function enableAbilityItem(abilityId) {
    	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "visible";
	}
}

function isAbilityItemEnabled(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return  elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}

function toggleAbilityItemVisibility(abilityId, show) {
    var vis = show === true ? "visible" : "hidden";

    var elem = document.getElementById('abilityitem_' + abilityId);
    if (elem && elem.childElements() && elem.childElements().length >= 1) {
        elem.childElements()[0].style.visibility = show;
    }
}

var thingTimer = window.setInterval(doTheThing, 1000);
function clickTheThing() {
    g_Minigame.m_CurrentScene.DoClick(
        {
            data: {
                getLocalPosition: function() {
                    var enemy = g_Minigame.m_CurrentScene.GetEnemy(
                                      g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane,
                                      g_Minigame.m_CurrentScene.m_rgPlayerData.target),
                        laneOffset = enemy.m_nLane * 440;

                    return {
                        x: enemy.m_Sprite.position.x - laneOffset,
                        y: enemy.m_Sprite.position.y - 52
                    }
                }
            }
        }
    );
}

if(enableAutoClicker) {
	var resetTickTimer = setInterval(function(){g_msTickRate = 1000},1000); //Force update to be sent every 1000ms
	if(setClickVariable) {
		var clickTimer = setInterval( function(){
			g_Minigame.m_CurrentScene.m_nClicks = clickRate;
		}, 1000);
	} else {
		var clickTimer = window.setInterval(clickTheThing, 1000/clickRate);
	}
}

var box = document.getElementsByClassName("leave_game_helper")[0];
box.innerHTML = "Autoscript now enabled - your game ID is " + g_GameID +
	"<br>Autoclicker: " + (enableAutoClicker?"enabled - "+clickRate+"cps, "+(setClickVariable?"variable":"clicks"):"disabled") +
	"<br>Particle effects: " + (disableParticleEffects?"disabled":"enabled") +
	"<br>Flinching effect: " + (disableFlinching?"disabled":"enabled") +
	"<br>Crit effect: " + (disableCritText?"disabled":"enabled") +
	"<br>Text: " + (disableText?"disabled":"enabled")
