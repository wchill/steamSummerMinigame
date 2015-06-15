// ==UserScript==
// @name /u/wchill Monster Minigame Auto-script w/ auto-click
// @namespace https://github.com/wchill/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @version 4.0.0
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
var SCRIPT_VERSION = '4.0.0';

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
var enableRenderer = getPreferenceBoolean("enableRenderer", true);
var enableAutoUpdate = getPreferenceBoolean("enableAutoUpdate", true);

var enableElementLock = getPreferenceBoolean("enableElementLock", true);

var autoRefreshMinutes = 30; // refresh page after x minutes

// DO NOT MODIFY
var isAlreadyRunning = false;
var currentClickRate = clickRate;
var lockedElement = -1;
var tickData = {};
var trt_oldCrit = function() {};
var trt_oldPush = function() {};
var trt_oldRender = function() {};

var control = {
    speedThreshold: 5000,
    rainingRounds: 250,
    timePerUpdate: 60000
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
var BOSS_DISABLED_ABILITIES = ['MORALE_BOOSTER', 'GOOD_LUCK_CHARMS', 'TACTICAL_NUKE', 'CLUSTER_BOMB', 'NAPALM', 'CRIT', 'CRIPPLE_SPAWNER', 'CRIPPLE_MONSTER', 'MAX_ELEMENTAL_DAMAGE', 'REFLECT_DAMAGE','THROW_MONEY_AT_SCREEN'];

var ENEMY_TYPE = {
    "SPAWNER": 0,
    "CREEP": 1,
    "BOSS": 2,
    "MINIBOSS": 3,
    "TREASURE": 4
};

function s() {
    return g_Minigame.m_CurrentScene;
}

var refreshTimer = null; // global to cancel running timers if disabled after timer has already started
var GITHUB_BASE_URL = "https://raw.githubusercontent.com/pkolodziejczyk/steamSummerMinigame/master/";


function firstRun() {
    /*
    */

    trt_oldCrit = s().DoCritEffect;
    trt_oldPush = s().m_rgClickNumbers.push;
    trt_oldRender = w.g_Minigame.Renderer.render;

    updateControlData();

    w.controlUpdateTimer = w.setInterval(function() {
        updateControlData();
    }, control.timePerUpdate);

    if(enableElementLock) {
        lockElements();
    }
    // Fix up for capacity
    fixActiveCapacityUI();

    // disable particle effects - this drastically reduces the game's memory leak
    if (removeParticles) {
        if (g_Minigame !== undefined) {
            s().SpawnEmitter = function(emitter) {
                emitter.emit = false;
                return emitter;
            };
        }
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
        /*
node = document.querySelector(".leave_game_helper");
if (node && node.parentNode) {
    node.parentNode.removeChild( node );
}
    */
        document.body.style.backgroundPosition = "0 0";
    }

    if (enableAutoRefresh) {
        autoRefreshPage(autoRefreshMinutes);
    }

    if (enableFingering) {
        startFingering();
    }

    if (enableRenderer) {
        toggleRenderer();
    }

    if (w.CSceneGame !== undefined) {
        w.CSceneGame.prototype.DoScreenShake = function() {};
    }
    
    // Easter egg button
    var egg = document.createElement("span");
    egg.className = "toggle_music_btn";
    egg.innerText = "Easter Egg";
    egg.onclick = function () {
        SmackTV();
    };
    document.querySelector(".game_options").insertBefore(egg, document.querySelector(".leave_game_btn"));

    // Add "players in game" label
    var oldHTML = document.getElementsByClassName("title_activity")[0].innerHTML;
    document.getElementsByClassName("title_activity")[0].innerHTML = "<span id=\"players_in_game\">0/1500</span>&nbsp;Players in room<br />" + oldHTML;

    var info_box = document.querySelector(".leave_game_helper");
    info_box.innerHTML = '<b>OPTIONS</b><br/>Some of these may need a refresh to take effect.<br/>Version: ' + SCRIPT_VERSION +'<br/>';

    // reset the CSS for the info box for aesthetics
    info_box.className = "options_box";
    info_box.style.backgroundColor = "#000000";
    info_box.style.width = "600px";
    info_box.style.top = "73px";
    info_box.style.padding = "12px";
    info_box.style.position = "absolute";
    info_box.style.boxShadow = "2px 2px 0 rgba( 0, 0, 0, 0.6 )";
    info_box.style.color = "#ededed";

    var options = document.createElement("div");
    options.style["-moz-column-count"] = 2;
    options.style["-webkit-column-count"] = 2;
    options.style["column-count"] = 2;

    options.appendChild(makeCheckBox("enableAutoClicker", "Enable autoclicker", enableAutoClicker, toggleAutoClicker));
    if (typeof GM_info !== "undefined") {
        options.appendChild(makeCheckBox("enableAutoRefresh", "Enable auto-refresh (fix memory leak)", enableAutoRefresh, toggleAutoRefresh));
    }
    options.appendChild(makeCheckBox("removeInterface", "Remove interface (needs refresh)", removeInterface, handleEvent));
    options.appendChild(makeCheckBox("removeParticles", "Remove particle effects (needs refresh)", removeParticles, handleEvent));
    options.appendChild(makeCheckBox("removeFlinching", "Remove flinching effects (needs refresh)", removeFlinching, handleEvent));
    options.appendChild(makeCheckBox("removeCritText", "Remove crit text", removeCritText, toggleCritText));
    options.appendChild(makeCheckBox("removeGoldText", "Remove gold text", removeGoldText, handleEvent));
    options.appendChild(makeCheckBox("removeAllText", "Remove all text (overrides above)", removeAllText, toggleAllText));
    options.appendChild(makeCheckBox("enableElementLock", "Lock element upgrades", enableElementLock, toggleElementLock));
    options.appendChild(makeCheckBox("enableFingering", "Enable targeting pointer (needs refresh)", enableFingering, handleEvent));
    options.appendChild(makeCheckBox("enableRenderer", "Enable graphics renderer", enableRenderer, toggleRenderer));
    options.appendChild(makeCheckBox("enableAutoUpdate", "Enable script auto update", enableAutoUpdate, toggleAutoUpdate));
    info_box.appendChild(options);

    enhanceTooltips();
}

function MainLoop() {
    if (!isAlreadyRunning) {
        isAlreadyRunning = true;

        var level = getGameLevel();
        readTickData();

        goToLaneWithBestTarget();
        useGoodLuckCharmIfRelevant();
        useMedicsIfRelevant();
        useMoraleBoosterIfRelevant();
        useClusterBombIfRelevant();
        useNapalmIfRelevant();
        useTacticalNukeIfRelevant();
        useCrippleMonsterIfRelevant();
        useCrippleSpawnerIfRelevant();
        if (level < control.speedThreshold || level % control.rainingRounds == 0) {
            useGoldRainIfRelevant();
        }
        useMetalDetectorIfRelevant();
        attemptRespawn();
        disableCooldownIfRelevant();
        updatePlayersInGame();

        s().m_nClicks = currentClickRate;
        g_msTickRate = 1000;

        var damagePerClick = s().CalculateDamage(
            s().m_rgPlayerTechTree.damage_per_click,
            s().m_rgGameData.lanes[s().m_rgPlayerData.current_lane].element
        );

        advLog("Ticked. Current clicks per second: " + currentClickRate + ". Current damage per second: " + (damagePerClick * currentClickRate), 4);

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
                    var rgDamage = s().m_rgStoredCrits.reduce(function(a,b) {return a+b;});
                    s().m_rgStoredCrits.length = 0;

                    s().DoCritEffect(rgDamage, enemy.m_Sprite.position.x - (enemy.m_nLane * 440), enemy.m_Sprite.position.y - 52, 'Crit!');
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

function makeCheckBox(name, desc, state, listener) {
    var label = document.createElement("label");
    var description = document.createTextNode(desc);
    var checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.name = name;
    checkbox.checked = state;
    checkbox.onclick = listener;

    label.appendChild(checkbox);
    label.appendChild(description);
    label.appendChild(document.createElement("br"));
    return label;
}

function handleEvent(event) {
    handleCheckBox(event);
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
    if(value && !showedUpdateInfo) {
        alert("PLEASE NOTE: This release has auto update functionality enabled by default. This does "
            + "come with a security implications and while you should be okay, it's still important "
            + "that you know about it. If you wish to disable it, simply uncheck the checkbox in options. "
            + "If you have questions, please contact /u/wchill.");
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

function toggleRenderer(event) {
    var value = enableRenderer;
    if (event !== undefined) {
        value = handleCheckBox(event);
    }

    if (value) {
        w.g_Minigame.Renderer.renderer = trt_oldRender;
    } else {
        w.g_Minigame.Renderer.render = function() {}
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

    var elem = Math.abs(hashCode(g_steamID) % 4);

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
}

function displayText(x, y, strText, color) {
    var text = new PIXI.Text(strText, {
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
    if (!targetIsTreasure && !targetIsBoss){
            var potential = 0;
            // Loop through lanes by elemental preference
            var sortedLanes = sortLanesByElementals();
            for(var notI = 0; notI < sortedLanes.length; notI++){
                // Maximize compability with upstream
                i = sortedLanes[notI];
                // ignore if lane is empty
                if(s().m_rgGameData.lanes[i].dps === 0)
                    continue;
                var stacks = 0;
                if(typeof s().m_rgLaneData[i].abilities[17] != 'undefined') {
                    stacks = s().m_rgLaneData[i].abilities[17];
                    advLog('stacks: ' + stacks, 3);
                }
                for(var m = 0; m < s().m_rgEnemies.length; m++) {
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
                if(lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
                    var element = s().m_rgGameData.lanes[enemies[i].m_nLane].element;

                    var dmg = s().CalculateDamage(
                            s().m_rgPlayerTechTree.dps,
                            element
                        );
                    if(mostHPDone < dmg)
                    {
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

        if(preferredLane != -1 && preferredTarget != -1){
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
        if (skippingSpawner && enemyTypePriority[k] == ENEMY_TYPE.CREEP && lowPercentageHP > creepSnagThreshold ) {
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
    }
}

function disableCooldownIfRelevant() {
    if(isAbilityActive('DECREASE_COOLDOWNS', true)) {
        disableAbility('DECREASE_COOLDOWNS');
    } else if(!isAbilityActive('DECREASE_COOLDOWNS')) {
        enableAbility('DECREASE_COOLDOWNS');
    }
}

function useMedicsIfRelevant() {

    // check if Medics is purchased and cooled down
    if (hasAbility('MEDICS')) {

        // Medics is purchased, cooled down, and needed. Trigger it.
        advLog('Medics is purchased, cooled down, and needed. Trigger it.', 2);
        triggerAbility('MEDICS');
        return;
    }

    var myMaxHealth = s().m_rgPlayerTechTree.max_hp;

    // check if health is below 50%
    var hpPercent = s().m_rgPlayerData.hp / myMaxHealth;
    if (hpPercent > 0.5 || s().m_rgPlayerData.hp < 1) {
        return; // no need to heal - HP is above 50% or already dead
    }

    // check if health is below 50%
    var hpPercent = s().m_rgPlayerData.hp / myMaxHealth;
    if (hpPercent > 0.5 || s().m_rgPlayerData.hp < 1) {
        return; // no need to heal - HP is above 50% or already dead
    }

    if (hasAbility('PUMPED_UP')) {

        advLog('We have pumped up, cooled down, and needed. Trigger it.', 2);
        triggerAbility('PUMPED_UP');
    } else if (hasAbility('GOD_MODE')) {

        advLog('We have god mode, cooled down, and needed. Trigger it.', 2);
        triggerAbility('GOD_MODE');
    }
}

// Use Good Luck Charm if doable
function useGoodLuckCharmIfRelevant() {

    // check if Crits is purchased and cooled down
    if (hasAbility('CRIT')){
        // Crits is purchased, cooled down, and needed. Trigger it.
        advLog('Crit chance is always good.', 3);
        triggerAbility('CRIT');
    }

    // check if Good Luck Charms is purchased and cooled down
    if (hasAbility('GOOD_LUCK_CHARMS')) {
        if (!isAbilityEnabled('GOOD_LUCK_CHARMS')) {
            return;
        }

        // Good Luck Charms is purchased, cooled down, and needed. Trigger it.
        advLog('Good Luck Charms is purchased, cooled down, and needed. Trigger it.', 2);
        triggerAbility('GOOD_LUCK_CHARMS');
    }
}

function useClusterBombIfRelevant() {
    //Check if Cluster Bomb is purchased and cooled down
    if (hasAbility('CLUSTER_BOMB')) {

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
            triggerAbility('CLUSTER_BOMB');
        }
    }
}

function useNapalmIfRelevant() {
    //Check if Napalm is purchased and cooled down
    if (hasAbility('NAPALM')) {

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
            triggerAbility('NAPALM');
        }
    }
}

// Use Moral Booster if doable
function useMoraleBoosterIfRelevant() {
    // check if Good Luck Charms is purchased and cooled down
    if (hasAbility('MORALE_BOOSTER')) {
        var numberOfWorthwhileEnemies = 0;
        for(var i = 0; i < s().m_rgGameData.lanes[s().m_nExpectedLane].enemies.length; i++){
            //Worthwhile enemy is when an enamy has a current hp value of at least 1,000,000
            if(s().m_rgGameData.lanes[s().m_nExpectedLane].enemies[i].hp > 1000000) {
                numberOfWorthwhileEnemies++;
            }
        }
        if(numberOfWorthwhileEnemies >= 2){
            // Moral Booster is purchased, cooled down, and needed. Trigger it.
            advLog('Moral Booster is purchased, cooled down, and needed. Trigger it.', 2);
            triggerAbility('MORALE_BOOSTER');
            }
    }
}

function useTacticalNukeIfRelevant() {
    // Check if Tactical Nuke is purchased
    if(hasAbility('TACTICAL_NUKE')) {

        //Check that the lane has a spawner and record it's health percentage
        var currentLane = s().m_nExpectedLane;
        var enemySpawnerExists = false;
        var enemySpawnerHealthPercent = 0.0;
        var level = getGameLevel();
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
            triggerAbility('TACTICAL_NUKE');
        }
    }
}

function useCrippleMonsterIfRelevant() {
    // Check if Cripple Spawner is available
    if(hasAbility('CRIPPLE_MONSTER')) {

        var level = getGameLevel();
        // Use nukes on boss when level >3000 for faster kills
        if (level > control.speedThreshold && level % control.rainingRounds != 0 && level % 10 == 0) {
            var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
            if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
                var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp
                if (enemyBossHealthPercent > 0.5) {
                    advLog("Cripple Monster available and used on boss", 2);
                    triggerAbility('CRIPPLE_MONSTER');
                }
            }
        }
    }
}

function useCrippleSpawnerIfRelevant() {
    // Check if Cripple Spawner is available
    if(hasAbility('CRIPPLE_SPAWNER')) {

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
            triggerAbility('CRIPPLE_SPAWNER');
        }
    }
}

function useGoldRainIfRelevant() {
    // Check if gold rain is purchased
    if (hasAbility('RAINING_GOLD')) {

        var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
        // check if current target is a boss, otherwise its not worth using the gold rain
        if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
            var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

            if (enemyBossHealthPercent >= 0.6) { // We want sufficient time for the gold rain to be applicable
                // Gold Rain is purchased, cooled down, and needed. Trigger it.
                advLog('Gold rain is purchased and cooled down, Triggering it on boss', 2);
                triggerAbility('RAINING_GOLD');
            }
        }
    }
}

function useMetalDetectorIfRelevant() {
    // Early game treasures
    if (getGameLevel() <= 30 && hasAbility('TREASURE')) {
        triggerAbility('TREASURE');
    }
    // Check if metal detector or treasure is purchased
    if (hasAbility('METAL_DETECTOR') || hasAbility('TREASURE')) {
        if (isAbilityActive('METAL_DETECTOR')) {
            return;
        }

        var enemy = s().GetEnemy(s().m_rgPlayerData.current_lane, s().m_rgPlayerData.target);
        // check if current target is a boss, otherwise we won't use metal detector
        if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
            var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

            if (enemyBossHealthPercent >= 0.9) { // We want sufficient time for the metal detector to be applicable
                // Metal Detector is purchased, cooled down, and needed. Trigger it.
                if (hasAbility('METAL_DETECTOR')) {
                    advLog('Metal Detector is purchased and cooled down, Triggering it on boss', 2);
                    triggerAbility('METAL_DETECTOR');
                } else if (hasAbility('TREASURE')) {
                    advLog('Treasure is available and cooled down, Triggering it on boss', 2);
                    triggerAbility('TREASURE');
                }
            }
        }
    }
}

function attemptRespawn() {
    if ((s().m_bIsDead) &&
        ((s().m_rgPlayerData.time_died) + 5) < (s().m_nTime)) {
        RespawnPlayer();
    }
}

function readTickData() {
    var loot = [];
    var scene = s();
    if(scene.m_rgPlayerTechTree && scene.m_rgPlayerTechTree.ability_items) {
        scene.m_rgPlayerTechTree.ability_items.forEach(function(l) {
            loot.push(l.ability);
        });
    }
    tickData = {
        loot: loot
    };
}

function knownAbility(name) {
    if(name in ABILITIES) {
        return true;
    }
    advLog('Unknown ability "' + name + '"! (known: ' + Object.keys(ABILITIES).join(',') + ')', 3);
    return false;
}

function hasAbility(name) {
    if(knownAbility(name)) {
        var id = ABILITIES[name];
        var has = name in UPGRADES ? s().bHaveAbility(id) : tickData.loot.indexOf(id) > -1;
        return has && s().GetCooldownForAbility(id) <= 0;
    }
    return false;
}

function isAbilityActive(name, lane) {
    if(knownAbility(name)) {
        var id = ABILITIES[name];
        var scene = s();
        if(lane) { // check current lane
            return id in scene.m_rgLaneData[scene.m_rgPlayerData.current_lane].abilities;
        } // else check player
        return scene.bIsAbilityActive(id);
    }
    return false;
}

function getAbilityButton(name) {
    if(knownAbility(name)) {
        return $J('#ability' + (name in UPGRADES ? '_' : 'item_') + ABILITIES[name] + ' .link').get(0);
    }
}

function triggerAbility(name) {
    var elem = getAbilityButton(name);
    if(elem) {
    	try {
        	s().TryAbility(elem);
    	} catch (e) {
    		console.log("Error using ability " + name + ": " + e);
    	}
    }
}

function isAbilityEnabled(name) {
    var elem = getAbilityButton(name);
    return elem && elem.style.visibility == "visible";
}

function toggleAbilityVisibility(name, show) {
    var elem = getAbilityButton(name);
    if(elem) {
        elem.style.visibility = show === true ? "visible" : "hidden";
    }
}

function disableAbility(name) {
    toggleAbilityVisibility(name, false);
}

function enableAbility(name) {
    toggleAbilityVisibility(name, true);
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

if (w.controlUpdateTimer) {
    w.clearInterval(w.controlUpdateTimer);
}

function updateControlData() {
    console.log("Updating script control data");
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                try {
                    var post = xhr.responseXML.querySelectorAll("div.content")[1];
                    if(!post) {
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

    if(enableAutoUpdate) {
        updateCode();
    }
}

function updateCode() {
    console.log("Updating script control code");
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                try {
                    var post = xhr.responseXML.querySelectorAll("div.content")[1];
                    if(!post) {
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

function autoRefreshPage(autoRefreshMinutes) {
    refreshTimer = setTimeout(function() {
        autoRefreshHandler();
    }, autoRefreshMinutes * 1000 * 60);
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

function fixActiveCapacityUI() {
    $J('.tv_ui').css('background-image', 'url("' + GITHUB_BASE_URL + 'game_frame_tv_fix.png")');
    $J('#activeinlanecontainer').css('height', '154px');
    $J('#activitycontainer').css('height', '270px');
    $J('#activityscroll').css('height', '270px');
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
