var info=["%cMSG15 %cAuto-everything","color: #0000FF", "color: #0000FF",""];

console.log.apply(console,info);



function injectScript(file, node) {

    var th = document.getElementsByTagName(node)[0];

    var s = document.createElement('script');

    s.setAttribute('type', 'text/javascript');

    s.setAttribute('src', file);

    th.appendChild(s);

}
injectScript( 'https://wchill.github.io/steamSummerMinigame/usingScript.js', 'body');
injectScript( chrome.extension.getURL('/js/bignumber.js'), 'body');
injectScript( 'https://wchill.github.io/steamSummerMinigame/autoPlay.user.js', 'body');
injectScript( 'https://wchill.github.io/steamSummerMinigame/upgrademanager.user.js', 'body');



/*

var steam64 = $(document.body).html();

steam64 = steam64.match(/g_steamID = \"(.+)\";/)[1];

console.log('Your Steam ID: ' + steam64);



var loop = setInterval(function() {

	get_http("http://185.18.105.20/msg/api.php?steamid="+steam64, function (response) {

		var gameid_msg15 = response;

		if(!isNaN(gameid_msg15))

		{

			if(gameid_msg15 == -1)

			{

				console.log("You are not allowed to use this! Sorry");

				clearInterval(loop);

			} else {

				if(gameid_msg15 == 0)

				{

					console.log("Still waiting for the Game ID...");

				} else {

					console.log("Got a GameID! Sending the JoinGame command...");

					window.postMessage({ type: "messageType", params: { gameidmsg15: gameid_msg15} }, "*");

					clearInterval(loop);

				}

			}

		} else {

			console.log('Possible Attack! Stopping Script...');

			clearInterval(loop);

		}

	});

}, 1000);

*/
