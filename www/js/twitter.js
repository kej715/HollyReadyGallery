if (typeof com === "undefined") com = {};
if (typeof com.kyrafre === "undefined") com.kyrafre = {};
if (typeof com.kyrafre.twitter === "undefined") com.kyrafre.twitter = {};

if (typeof com.kyrafre.twitter.Accessor === "undefined")
{
	com.kyrafre.twitter.Accessor = function(consumerKey, consumerSecret, serviceProvider)
	{
		this.consumerKey = consumerKey;
		this.consumerSecret = consumerSecret;
		this.serviceProvider = serviceProvider;
	};
}

if (typeof com.kyrafre.twitter.ServiceProvider === "undefined")
{
	com.kyrafre.twitter.ServiceProvider = function(signatureMethod, requestTokenURL, userAuthorizationURL,
												   accessTokenURL, echoURL, callbackURL)
	{
		this.signatureMethod = signatureMethod;
		this.requestTokenURL = requestTokenURL;
		this.userAuthorizationURL = userAuthorizationURL;
		this.accessTokenURL = accessTokenURL;
		this.echoURL = echoURL;
		this.callbackURL = callbackURL;
	}
}

if (typeof com.kyrafre.twitter.Service === "undefined")
{
	com.kyrafre.twitter.Service = function(accessor, parameters)
	{
		this.accessor = accessor;
		this.authenticationParameters = (typeof parameters !== "undefined") ? parameters : [];
	};
}

com.kyrafre.twitter.Service.prototype.authenticate = function(callback)
{
	var self = this;
	
	delete localStorage.twitterToken;
	delete localStorage.twitterTokenSecret;
	delete localStorage.twitterScreenName;
	delete localStorage.twitterUserId;
	
	var message = {};
	message.method = "POST";
	message.action = self.accessor.serviceProvider.requestTokenURL;
	message.parameters = [];
	
	for (var i = 0; i < self.authenticationParameters.length; ++i)
		message.parameters.push(self.authenticationParameters[i]);
	
	var requestBody = OAuth.formEncode(message.parameters);
	OAuth.completeRequest(message, self.accessor);

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function()
	{
		if (xhr.readyState == 4)
		{
			var results = OAuth.decodeForm(xhr.responseText);
			var oauthToken = OAuth.getParameter(results, "oauth_token");
			var authorizeURL = "https://api.twitter.com/oauth/authorize?oauth_token=" + oauthToken;
			self.clientBrowser = ChildBrowser.install();
			if (self.clientBrowser != null)
			{
				self.clientBrowser.onLocationChange = function(loc)
				{
					self.handleLocChanged(loc, xhr, self.accessor, callback);
				};
				window.plugins.childBrowser.showWebPage(authorizeURL);
			}
		}
	};
	xhr.open(message.method, message.action, true);
	xhr.setRequestHeader("Authorization", OAuth.getAuthorizationHeader("", message.parameters));
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	xhr.send(requestBody);	
};

com.kyrafre.twitter.Service.prototype.handleLocChanged = function(loc, xhr, accessor, callback)
{
	var self = this;

	if (loc.indexOf(accessor.serviceProvider.callbackURL) > -1) {
		self.clientBrowser.close();
		var results = OAuth.decodeForm(xhr.responseText);
		var message = {method: "POST", action: accessor.serviceProvider.accessTokenURL};
		OAuth.completeRequest(message,
		{
			consumerKey: accessor.consumerKey,
			consumerSecret: accessor.consumerSecret,
			token: OAuth.getParameter(results, "oauth_token"),
			tokenSecret: OAuth.getParameter(results, "oauth_token_secret")
		});
		var requestAccess = new XMLHttpRequest();
		requestAccess.onreadystatechange = function()
		{
			if (requestAccess.readyState == 4)
			{
				var params = self.parseQueryString(requestAccess.responseText);
				localStorage.twitterToken = params["oauth_token"];
				localStorage.twitterTokenSecret = params["oauth_token_secret"];
				localStorage.twitterScreenName = params["screen_name"];
				localStorage.twitterUserId = params["user_id"];
				
				if (typeof callback === "function")
					callback();
			}
		};
		requestAccess.open(message.method, message.action, true);
		requestAccess.setRequestHeader("Authorization", OAuth.getAuthorizationHeader("", message.parameters));
		requestAccess.send(); 
	}
}

com.kyrafre.twitter.Service.prototype.parseQueryString = function(url)
{
    var vars = [];
    var hashes = url.slice(url.indexOf('?') + 1).split('&');
	
    for(var i = 0; i < hashes.length; i++)
    {
        var hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
	
    return vars;
}

com.kyrafre.twitter.Service.prototype.createAJAXRequestObject = function(url, method, params, successCallback, errorCallback)
{
	var self = this;
	var ajaxObject = {
		url: url,
		data: params,
		dataType: 'json',
		type: method,
		timeout: 60*1000,
		beforeSend: function(req)
		{
			var message = {};
			message.method = method;
			message.action = url;
			message.parameters = params;
			OAuth.completeRequest(message,
			{
				consumerKey: self.accessor.consumerKey,
				consumerSecret: self.accessor.consumerSecret,
				token: localStorage.twitterToken,
				tokenSecret: localStorage.twitterTokenSecret
			});
			req.setRequestHeader("oauth_consumer_key", self.accessor.consumerKey);
			req.setRequestHeader("oauth_nonce", message.parameters['oauth_nonce']);
			req.setRequestHeader("oauth_signature_method", 'HMAC-SHA1');
			req.setRequestHeader("oauth_token", localStorage.twitterToken);
			req.setRequestHeader("oauth_timestamp", message.parameters['oauth_timestamp']);
			req.setRequestHeader("oauth_version", '1.0');
			req.setRequestHeader("Authorization", OAuth.getAuthorizationHeader("", message.parameters));
			req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		},
		success: successCallback,
		error: errorCallback
	};
	
	return ajaxObject;
}

com.kyrafre.twitter.Service.prototype.tweet = function(status, successCallback, errorCallback)
{
	var self = this;
	
	if (typeof localStorage.twitterToken === "undefined")
	{
		self.authenticate(function()
		{
			self.tweet(status, successCallback, errorCallback);
		});
		
		return;
	}
	
	$.ajax(self.createAJAXRequestObject("https://api.twitter.com/1/statuses/update.json", "POST",
										{status:status},
	function(data, textStatus, jqXHR)
	{
		if (typeof successCallback === "function")
			successCallback(data);
	},
	function(jqXHR, textStatus, errorThrown)
	{
		if (jqXHR.status == 400 || jqXHR.status == 401)
		{
			self.authenticate(function()
			{
				self.tweet(status, successCallback, errorCallback);
			});						
			return;
		}

		if (typeof errorCallback === "function")
		{
			var error = "";
										
			if (jqXHR.status == 403)
				error = "Twitter says that this is a duplicate tweet.";
			else if (typeof errorThrown === "string" && errorThrown !== "")
				error = errorThrown;
			else if (typeof errorThrown === "object" && typeof errorThrown.toString === "function")
				error = errorThrown.toString();
			else if (textStatus != null)
				error = textStatus;
										
			if (error === "" || error === "error")
				error = "The server is currently unavailable.";
										
			errorCallback(error);
		}
	}));
};
