var info=["%cMSG15 %cAuto-everything","color: #0000FF", "color: #0000FF",""];

console.log.apply(console,info);



function injectScript(file, node) {

    var th = document.getElementsByTagName(node)[0];

    var s = document.createElement('script');

    s.setAttribute('type', 'text/javascript');

    s.setAttribute('src', file);

    th.appendChild(s);

}

 var url = window.location.href;

if (url.indexOf('towerattack') == -1)
{
	injectScript( 'https://codetorex.github.io/SteamMonsterLobby/MonsterLobby.user.js', 'body');
}
else
{
	injectScript( 'https://wchill.github.io/steamSummerMinigame/usingScript.js', 'body');
	injectScript( chrome.extension.getURL('/js/bignumber.js'), 'body');
	injectScript( 'https://codetorex.github.io/SteamMonsterLobby/MonsterLobby.user.js', 'body');
	injectScript( 'https://wchill.github.io/steamSummerMinigame/autoPlay.user.js', 'body');
	injectScript( 'https://wchill.github.io/steamSummerMinigame/upgrademanager.user.js', 'body');
}
