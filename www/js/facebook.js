if (typeof com === "undefined")
	com = {};
if (typeof com.kyrafre === "undefined")
	com.kyrafre = {};
if (typeof com.kyrafre.facebook === "undefined")
	com.kyrafre.facebook = {};

if (typeof com.kyrafre.facebook.Accessor === "undefined")
{
	com.kyrafre.facebook.Accessor = function(appId, appSecret, callbackURL)
	{
		this.appId = appId;
		this.appSecret = appSecret;
		this.callbackURL = callbackURL;
	};
}

if (typeof com.kyrafre.facebook.Service === "undefined")
{
	com.kyrafre.facebook.Service = function(accessor)
	{
		this.accessor = accessor;
	};
}

com.kyrafre.facebook.Service.prototype.handleLocChanged = function(loc, callback)
{
	var self = this;
	
	if (loc.indexOf(self.accessor.callbackURL) > -1)
	{
		self.clientBrowser.close(); 
		var fbCode = loc.match(/code=(.*)$/)[1];
		$.ajax(
		{
			url: "https://graph.facebook.com/oauth/access_token?client_id=" + self.accessor.appId
					+ "&client_secret=" + self.accessor.appSecret
					+ "&code=" + fbCode
					+ "&redirect_uri=http://www.facebook.com/connect/login_success.html",
			data: {},
			success: function(data, status)
			{
				localStorage.facebookToken = data.split("=")[1];
				self.clientBrowser.close();
			   
				if (typeof callback === "function")
					callback();
			},
			error: function(error)
			{
				self.clientBrowser.close();
				navigator.notification.alert(error, function(){}, "Sorry", "Dismiss");
			},
			dataType: 'text',
			type: 'POST'
		});
	}
};

com.kyrafre.facebook.Service.prototype.authenticate = function(callback)
{
	var self = this;
	delete localStorage.facebookToken;
	
	var authorizeURL = "https://graph.facebook.com/oauth/authorize?"
	+ "client_id=" + self.accessor.appId
	+ "&redirect_uri=" + self.accessor.callbackURL
	+ "&display=touch"
	+ "&scope=read_stream,publish_stream,offline_access,publish_checkins";
	
	self.clientBrowser = ChildBrowser.install();
	
	if (self.clientBrowser != null)
	{
		self.clientBrowser.deleteCookies();
		self.clientBrowser.onLocationChange = function(loc)
		{
			self.handleLocChanged(loc, callback);
		};
		window.plugins.childBrowser.showWebPage(authorizeURL);
	}
};

com.kyrafre.facebook.Service.prototype.post = function(url, params, successCallback, errorCallback)
{
	var self = this;
	
	if (typeof localStorage.facebookToken === "undefined")
	{
		self.authenticate(function()
		{
			self.post(url, params, successCallback, errorCallback);
		});
		
		return;
	}
	
	params.access_token = localStorage.facebookToken;
	
	$.post(url, params).then
	(function(data, textStatus, jqXHR)
	{
		if (typeof successCallback === "function")
			successCallback(data);
	},
	function(jqXHR, textStatus, errorThrown)
	{
		if (jqXHR.status == 400 || jqXHR.status == 401 || jqXHR.status == 403)
		{
			try
			{
				var errObj = $.parseJSON(jqXHR.responseText);
	 
				if (typeof errObj.error !== "undefined" && errObj.error.type === "OAuthException")
				{
					self.authenticate(function()
					{
						self.post(url, params, successCallback, errorCallback);
					});
					return;
				}
			}
			catch (xcptn)
			{
				if (typeof errorCallback === "function")
					errorCallback("Facebook produced an unexpected response: " + xcptn);
			}
		}
		else if (typeof errorCallback === "function")
		{
			var error = "";
	 
			if (typeof errorThrown === "string" && errorThrown !== "")
				error = errorThrown;
			else if (typeof errorThrown === "object" && typeof errorThrown.toString === "function")
				error = errorThrown.toString();
			else if (textStatus != null)
				error = textStatus;
	 
			if (error === "" || error === "error")
				error = "The server is currently unavailable.";
	 
			errorCallback(error);
		}
	});
};
