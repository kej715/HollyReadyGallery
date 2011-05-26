if (typeof com === "undefined")
	com = {};
if (typeof com.kyrafre === "undefined")
	com.kyrafre = {};
if (typeof com.kyrafre.gallery === "undefined")
	com.kyrafre.gallery = {};

if (typeof com.kyrafre.gallery.Gallery === "undefined")
{
	com.kyrafre.gallery.Gallery = function(baseURL)
	{
		this.baseURL = baseURL;
	};
}

var jQT = $.jQTouch(
{
	formSelector: false,
	icon: "icon.png",
	startupScreen: "Default.png",
	statusBar: "black",
	useFastTouch: false,
	preloadImages:["images/loading.gif"]
});

com.kyrafre.gallery.Gallery.prototype.addLoadingAnimation = function()
{
	var top = (this.contentHeight / 2) - 24;
	var left = (this.contentWidth / 2) - 24;
	var anim = $("<div class=\"loadingProgress\"/>").appendTo(".contentPane");
	anim.css("top", top);
	anim.css("left", left);
	anim.html("<img src=\"images/loading.gif\"/>");
};

com.kyrafre.gallery.Gallery.prototype.applicationBecameActiveHandler = function()
{
	var self = this;
	
	navigator.network.isReachable("www.hollyready.com", function(reachability)
	{
		var previousState = com.kyrafre.gallery.Gallery.networkState;
		com.kyrafre.gallery.Gallery.networkState = reachability.code || reachability;
		if (com.kyrafre.gallery.Gallery.networkState !== NetworkStatus.REACHABLE_VIA_WIFI_NETWORK)
		{
			if (self.isAudioOn && previousState === NetworkStatus.REACHABLE_VIA_WIFI_NETWORK)
			{
				$(".titleBarToolRight1").attr("src", "icons/65-note-no.png");
				self.isAudioOn = false;
				self.media[0].pause();
			}
		}
		if (com.kyrafre.gallery.Gallery.networkState === NetworkStatus.NOT_REACHABLE)
			navigator.notification.alert("A network connection is not currently available.", function(){}, "Sorry", "Dismiss");
	});
};

com.kyrafre.gallery.Gallery.prototype.displayError = function(textStatus, errorThrown)
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
	
	this.removeLoadingAnimation();
	
	navigator.notification.alert(error, function(){}, "Sorry", "Dismiss");
};

com.kyrafre.gallery.Gallery.prototype.displayImages = function()
{
	var self = this;
	
	var filter = "";
	$("#controls ul").each(function(i)
	{
		var category = $(this);
		var name = category.attr("name");

		if (typeof name !== "undefined" && name !== "")
		{
			var values = "";
			$("input:checked", category).each(function(i)
			{
				if (values.length > 0) values += ",";
				values += this.value;
			});
			if (values.length > 0)
			{
				filter += (filter.length > 0 ? "&" : "?")
						   + name + "=" + values;
			}
		}
	});

	self.addLoadingAnimation();
	var container = $("#image-container");

	$.getJSON(self.properties.listImages + filter).then
	(function(data, textStatus, jqXHR)
	{
		self.removeLoadingAnimation();

		data.sort(function(a, b)
		{
			var s1 = a.title.toLowerCase();
			var s2 = b.title.toLowerCase();
			if (s1 < s2)
			   return -1;
			else if (s1 > s2)
			   return 1;
			else
			   return 0;
		});

		self.imageMetadata = data;
		var width = self.contentWidth - 16;
	 
		container.empty();
		delete self.galleryScroller;
		self.imageLoadingQueue = [];
		self.rightMostScrollTo = 0;

		$.each(self.imageMetadata, function(i, obj)
		{
			obj.index = i;
			var item = $("<div class=\"imageCell\"/>").appendTo(container);
			var title = $("<div class=\"imageTitle\"/>").appendTo(item);
			title.text(obj.title);
			obj.imageContainer = $("<div class=\"imageContainer\"/>").appendTo(item);
			var img = $("<img/>").appendTo(obj.imageContainer);
			var description = $("<div class=\"imageDescription\"/>").appendTo(item);
			description.text(obj.description);
			var sharingContainer = $("<div class=\"sharingButtonsContainer\"/>").appendTo(item);

			$("<div class=\"facebookShare\"/>").appendTo(sharingContainer)
			.text("Share")
			.click(function()
			{
				self.facebookRenderShare(obj, "#gallery");
			});

			$("<div class=\"tweet\"/>").appendTo(sharingContainer)
			.text("Tweet")
			.click(function()
			{
				self.twitterRenderTweet(obj, "#gallery");
			});

			img.attr("src", "images/loading-300x233.png").load(function()
			{
				obj.imageMaxHeight = self.contentHeight
					- (title.outerHeight(true)
					   + description.outerHeight(true)
					   + sharingContainer.outerHeight(true)
					   + 20);
				obj.imageMaxWidth = width;
				obj.width = item.outerWidth(true);
															   
				if (i > 0)
				{
					var predecessor = self.imageMetadata[i - 1];
					obj.position = predecessor.position + predecessor.width;
				}
				else
					obj.position = 0;
															   
				if (i < 5)
				{
					self.imageLoadingQueue.push(obj);
					self.rightMostIndex = self.imageLoadingQueue.length - 1;
					self.loadImages(container);
				}
			});
		});
	},
	function(jqXHR, textStatus, errorThrown)
	{
		self.displayError(textStatus, errorThrown);
		self.removeLoadingAnimation();
	});
};

com.kyrafre.gallery.Gallery.prototype.facebookPost = function(artObject, sourcePage)
{
	var self = this;
	var params = {};
	params.link = self.properties.showPainting + "?p=" + encodeURIComponent(artObject.url);
	params.icon = self.properties.renderImage + "?w=128&h=96&img=" + encodeURIComponent(artObject.url);
	params.name = artObject.title;
	params.caption = artObject.description;
	params.message = $("#facebook-share-text").val();
	self.addLoadingAnimation();
	
	self.facebookSvc.post("https://graph.facebook.com/me/feed", params,
	function(data)
	{
		self.removeLoadingAnimation();
		navigator.notification.alert("\"" + artObject.title + "\" has been shared successfully on Facebook.",
									 function(){}, "Shared", "Dismiss");
		self.goTo(sourcePage, "flip");
	},
	function(error)
	{
		navigator.notification.alert(error, function(){}, "Sorry", "Dismiss");
		self.removeLoadingAnimation();
	});
};

com.kyrafre.gallery.Gallery.prototype.facebookRenderShare = function(artObject, sourcePage)
{
	var self = this;
	$("#facebook-share-image").attr("src", self.properties.renderImage + "?w=128&h=96&img=" + encodeURIComponent(artObject.url));
	$("#facebook-share-title").text(artObject.title);
	$("#facebook-share-description").text(artObject.description);
	var textArea = $("#facebook-share-text");
	textArea.width(self.contentWidth);
	if (typeof self.properties.title !== "undefined")
		textArea.text("See this beautiful " + artObject.medium + " painting at " + self.properties.title + ".");
	else
		textArea.text("This is a beautiful " + artObject.medium + " painting.");
	self.sharedObject = artObject;
	self.sharingSourcePage = sourcePage;
	self.goTo("#facebookShare", "flip");
};

com.kyrafre.gallery.Gallery.prototype.getProperties = function(callback)
{
	var self = this;
	self.addLoadingAnimation();
	
	$.getJSON(self.baseURL + "/properties.json").then
	(function(data, textStatus, jqXHR)
	{
		if (typeof self.properties === "undefined")
			self.properties = {};

		for (var name in data)
			self.properties[name] = data[name];

		self.removeLoadingAnimation();
	 
		if (typeof callback === "function")
			callback();
	},
	function(jqXHR, textStatus, errorThrown)
	{
		self.displayError(textStatus, errorThrown);
		self.removeLoadingAnimation();
	});
};

com.kyrafre.gallery.Gallery.prototype.goTo = function(selector, fx)
{
	if (com.kyrafre.gallery.selectedPage !== selector)
	{
		com.kyrafre.gallery.selectedPage = selector;
		jQT.goTo(selector, fx);		
	}
};

com.kyrafre.gallery.Gallery.prototype.loadAudio = function()
{
	var self = this;
	
	$.getJSON(self.properties.listAudio, function(audioObjects)
	{
			  
		audioObjects.sort(function(a, b)
		{
			var s1 = a.name;
			var s2 = b.name;
			if (s1 < s2)
				return -1;
			else if (s1 > s2)
				return 1;
			else
				return 0;
		});
			  
		self.audio = [];

		for (var i = 0; i < audioObjects.length; ++i)
			self.audio.push(self.baseURL + "/" + audioObjects[i].url);
			  
		if (typeof self.properties.audioOn === "undefined")
			self.properties.audioOn = true;
			  
		if (com.kyrafre.gallery.Gallery.networkState !== NetworkStatus.REACHABLE_VIA_WIFI_NETWORK)
			self.isAudioOn = false;
		else
			self.isAudioOn = self.properties.audioOn;

		if (!self.isAudioOn)
			$(".titleBarToolRight1").attr("src", "icons/65-note-no.png");
			  
		$(".titleBarToolRight1").click(function(evt)
		{
			if (self.isAudioOn)
			{
				self.isAudioOn = false;
				self.media[0].pause();
				$(".titleBarToolRight1").attr("src", "icons/65-note-no.png");
			}
			else
			{
				self.isAudioOn = true;
				self.playAudio();
				$(".titleBarToolRight1").attr("src", "icons/65-note.png");
			}
									   
			return false;
		});
			  
		self.playAudio();
	});
};

com.kyrafre.gallery.Gallery.prototype.loadImage = function(imageObj, container)
{
	var self = this;

	self.addLoadingAnimation();
	
	self.promiseImage(imageObj).then(function()
	{
		self.removeLoadingAnimation();
		var parent = imageObj.imageContainer.parent();
		imageObj.width = parent.outerWidth(true);
		var buttonsContainer = $(".sharingButtonsContainer", parent);
		var buttonsWidth = buttonsContainer.outerWidth(true);
		buttonsContainer.css("left", (imageObj.width - buttonsWidth) / 2);
									 
		if (typeof self.galleryScroller === "undefined")
		{
			self.galleryScroller = new TouchScroll(container.get(0), {elastic:true, scrollevents:true});
									 
			document.addEventListener("scroll", function()
			{
				self.scrollPosition = self.galleryScroller.scrollLeft;
															   
				if (self.scrollPosition > self.rightMostScrollTo)
				{
					self.rightMostScrollTo = self.scrollPosition;
					var n = 0;
															   
					while (self.rightMostIndex + 1 < self.imageMetadata.length)
					{
						var obj = self.imageMetadata[self.rightMostIndex + 1];
						if (obj.position > self.scrollPosition && ++n > 5) break;
						self.imageLoadingQueue.push(obj);
						++self.rightMostIndex;
					}
															   
					if (self.imageLoadingQueue.length > 0)
						self.loadImages(container);
				}
			}, false);
		}
									 
		self.galleryScroller.setupScroller(true);
									 
		var i = imageObj.index > 0 ? imageObj.index : 1;
		while (i < self.imageMetadata.length)
		{
			var predecessor = self.imageMetadata[i - 1];	 
			self.imageMetadata[i++].position = predecessor.position + predecessor.width;
		}
									 
		self.rightMostScrollTo = imageObj.position;
									 
		if (self.imageLoadingQueue.length > 0)
			self.loadImages(container);
									 
		if (typeof self.isAudioLoaded === "undefined")
		{
			self.isAudioLoaded = true;
			self.loadAudio();
		}
	});
};

com.kyrafre.gallery.Gallery.prototype.loadImages = function(container)
{
	var self = this;
	
	if (self.imageLoadingQueue.length > 0)
	{
		var imageObj = self.imageLoadingQueue.splice(0, 1)[0];
		
		if (typeof imageObj.image === "undefined")
			self.loadImage(imageObj, container);

		else if (self.imageLoadingQueue.length > 0)
			self.loadImages(container);
	}
};

com.kyrafre.gallery.Gallery.prototype.loadSlideshowImage = function()
{
	var self = this;
	var container = $("#slideshow-container");	
	var width = self.contentWidth - 16;
	var height = self.contentHeight;
	var item = $(".imageCell", container);
	item.width(self.contentWidth);
	var title = $(".imageTitle", item);
	var image = $("img", item);
	var description = $(".imageDescription", item);
	
	if (typeof self.currentSlideshowObject === "undefined")
		self.currentSlideshowObject = self.imageMetadata[0];

	title.text(self.currentSlideshowObject.title);
	description.text(self.currentSlideshowObject.description);
	image.attr("src", self.properties.renderImage
			   + "?img=" + encodeURIComponent(self.currentSlideshowObject.url)
			   + "&w=" + width
			   + "&h=" + (height - (title.outerHeight(true)
									+ description.outerHeight(true)
									+ $(".sharingButtonsContainer", container).outerHeight(true)
									+ 20)));
};

com.kyrafre.gallery.Gallery.prototype.playAudio = function()
{
	self = this;
	
	if (self.isAudioOn)
	{
		if (self.media.length < 1)
		{
			self.addLoadingAnimation();
			self.queueAudio();
			self.removeLoadingAnimation();
		}
		
		self.media[0].play();

		if (self.media.length < 2 && self.audio.length > 1)
		{
			setTimeout(function()
			{
				self.queueAudio();					   
			}, 1);
		}
	}
};

com.kyrafre.gallery.Gallery.prototype.promiseImage = function(imageObj)
{
	var self = this;
	var promise = new $.Deferred();
	imageObj.imageContainer.empty();
	imageObj.image = $("<img src=\""
					   + self.properties.renderImage
					   + "?img=" + encodeURIComponent(imageObj.url)
					   + "&w=" + imageObj.imageMaxWidth
					   + "&h=" + imageObj.imageMaxHeight
					   + "\"/>").appendTo(imageObj.imageContainer);
	
	imageObj.image.load(function()
	{
		promise.resolve(imageObj);
	});
	
	return promise;
};

com.kyrafre.gallery.Gallery.prototype.queueAudio = function()
{
	self = this;
	
	if (self.audioIndex >= self.audio.length)
		self.audioIndex = 0;
		
	var media = new Media(self.audio[self.audioIndex++],
	function()
	{
		if (self.media.length > 1)
		{
			self.media.splice(0, 1);
			self.media[0].play();
			self.queueAudio();
		}
		else
			self.media[0].play();
	},
	function(error)
	{
		navigator.notification.alert("While loading audio: " + error.message, function(){}, "Sorry", "Dismiss");
	});

	self.media.push(media);
};

com.kyrafre.gallery.Gallery.prototype.removeLoadingAnimation = function()
{
	$(".loadingProgress").remove();
};

com.kyrafre.gallery.Gallery.prototype.renderHTML = function(container, source)
{
	var self = this;
	container.empty();
	self.addLoadingAnimation();
	container.load(source, function(response, status, xhr)
	{
		if (status === "error")
		{
			navigator.notification.alert(xhr.status + " " + xhr.statusText, function(){}, "Error", "Dismiss");
			self.removeLoadingAnimation();
		}
		else
		{
			var createScroller = function()
			{
				var scroller = new TouchScroll(container.get(0), {elastic:true});
				scroller.setupScroller(true);
				self.removeLoadingAnimation();
			};

			var images = $("img", container);

			if (images.length > 0)
			{
				var imagesLoaded = 0;
				images.each(function(i, image)
				{
					if (image.complete) ++imagesLoaded;
				});

				if (imagesLoaded >= images.length)
				   createScroller();
				else
				{
					images.load(function()
					{
						if (++imagesLoaded >= images.length)
							createScroller();
					});
				}
			}
			else
				createScroller();
		}
	});
};

com.kyrafre.gallery.Gallery.prototype.twitterRenderTweet = function(artObject, sourcePage)
{
	var self = this;
	$("#tweet-image").attr("src", self.properties.renderImage + "?w=128&h=96&img=" + encodeURIComponent(artObject.url));
	$("#tweet-title").text(artObject.title);
	$("#tweet-description").text(artObject.description);
	var textArea = $("#tweet-text");
	textArea.width(self.contentWidth);
	var setText = function(url)
	{
		var gallery = typeof self.properties.title !== "undefined" ? (self.properties.title + ", ") : "";
		var title = "\"" + artObject.title + "\"";
		var text = null;
		
		if (gallery.length + title.length + url.length + 2 <= 140)
			text = title + ", " + gallery + url;
		else if (title.length + url.length + 2 <= 140)
			text = title + ", " + url;
		else
			text = title + ", " + gallery;
		
		textArea.text(text);
	};
	var url = self.properties.showPainting + "?p=" + encodeURIComponent(artObject.url);
	$.ajax(
	{
		url: "http://tinyurl.com/api-create.php?url=" + encodeURIComponent(url),
		dataType: "text",
		success: function(tinyURL)
		{
		   setText(tinyURL);
		},
		error: function(jqXHR, textStatus, errorThrown)
		{
		   setText(url);
		}
	});
	
	self.sharedObject = artObject;
	self.sharingSourcePage = sourcePage;
	self.goTo("#tweet", "flip");
};

com.kyrafre.gallery.Gallery.prototype.twitterTweet = function(artObject, sourcePage)
{
	var self = this;
	self.addLoadingAnimation();
	
	self.twitterSvc.tweet($("#tweet-text").val(),
	function(data)
	{
		self.removeLoadingAnimation();
		navigator.notification.alert("\"" + artObject.title + "\" has been tweeted successfully.",
									function(){}, "Tweeted", "Dismiss");
		self.goTo(sourcePage, "flip");
	},
	function(error)
	{
		navigator.notification.alert(error, function(){}, "Sorry", "Dismiss");
		self.removeLoadingAnimation();
	});
};

com.kyrafre.gallery.Gallery.awaitReachability = function(callback)
{
	navigator.network.isReachable("www.hollyready.com", function(reachability)
	{
		com.kyrafre.gallery.Gallery.networkState = reachability.code || reachability;
		if (com.kyrafre.gallery.Gallery.networkState === NetworkStatus.NOT_REACHABLE)
		{
			if (typeof com.kyrafre.gallery.Gallery.isWarningIssued === "undefined")
			{
				navigator.notification.alert("A network connection is not currently available.",
					function(){}, "Warning", "Dismiss");
			}
			setTimeout(function(){com.kyrafre.gallery.Gallery.awaitReachability(callback);}, 4000);
		}
		else if (typeof callback === "function")
			callback();
	});
};

com.kyrafre.gallery.Gallery.initContactPage = function(gallery)
{
	$("#contact-container").css("background-image", "url('"
								+ gallery.properties.renderImage
								+ "?img=" + encodeURIComponent(gallery.properties.background)
								+ "&h=" + gallery.contentHeight + "')");
	var lines = gallery.properties.address.split(";");
	var container = $("#contact-container-address");
	var button = $(".contactButton", container);
	var p = null;
	
	for (var i = 0; i < lines.length; ++i)
	{
		p = $("<p>").appendTo(button);
		$("<a href=\"http://maps.google.com/maps?q=" + encodeURIComponent(lines.join()) + "&t=m\"/>")
		.appendTo(p)
		.text(lines[i]);
	}
	
	var width = button.outerWidth(true);
	var height = button.outerHeight(true);
	var totalHeight = height * 3 + 20;
	var left = (gallery.contentWidth - width) / 2;
	var top = ((gallery.contentHeight - totalHeight) / 2) - $("#header").outerHeight(true);
	container.css("left", left);
	container.css("top", top);
	top += height + 10;
	
	container = $("#contact-container-phone");
	button = $(".contactButton", container);
	p = $("<p/>").appendTo(button);
	$("<a href=\"tel:" + encodeURIComponent(gallery.properties.phone) + "\"/>")
	.appendTo(p)
	.text(gallery.properties.phone);
	
	container.css("left", left);
	container.css("top", top);
	top += height + 10;
	
	container = $("#contact-container-email");
	button = $(".contactButton", container);
	p = $("<p/>").appendTo(button);
	$("<a href=\"mailto:" + encodeURIComponent(gallery.properties.email) + "\"/>")
	.appendTo(p)
	.text(gallery.properties.email);
	
	container.css("left", left);
	container.css("top", top);	
};

com.kyrafre.gallery.Gallery.initPreferencesPage = function(gallery)
{
	var container = $("#controls");
					  
	for (var categoryName in gallery.properties.filters)
	{
		var category = gallery.properties.filters[categoryName];
		$("<h4/>").appendTo(container).text(category.label);
		var list = $("<ul class=\"edit rounded\"/>").appendTo(container);
		list.attr("name", categoryName);
		
		for (var elementName in category.elements)
		{
			var element = category.elements[elementName];
			
			if (element.type === "toggle")
			{
				var item = $("<li/>").appendTo(list);
				item.text(element.label);
				var span = $("<span class=\"toggle\"/>").appendTo(item);
				var control = $("<input type=\"checkbox\"/>").appendTo(span)
				.click(function() {
					gallery.filterChanged = true;
				});
				control.attr("value", elementName);
				if (element.value === "on")
					control.attr("checked", "checked");
			}
		}
	}
};

com.kyrafre.gallery.Gallery.initSlideshowPage = function(gallery)
{
	var container = $("#slideshow-container");	
	var item = $(".imageCell", container);
	var image = $(".imageContainer > img", item);
	image.load(function()
	{
		item.fadeIn("slow", function()
		{
			if (gallery.isSlideshowRunning)
			{
				gallery.slideshowTimer = setTimeout(function()
				{
					item.fadeOut("slow", function()
					{
						var nextIndex = gallery.currentSlideshowObject.index + 1;

						if (nextIndex < gallery.imageMetadata.length)
							gallery.currentSlideshowObject = gallery.imageMetadata[nextIndex];
						else
							gallery.currentSlideshowObject = gallery.imageMetadata[0];

						gallery.loadSlideshowImage();
					});
				}, 5000);
			}
		});
	});
	
	image.click(function()
	{
		self.goTo("#gallery", "pop");
	});
	
	var buttonsContainer = $(".sharingButtonsContainer", item);
	
	$(".facebookShare", buttonsContainer).click(function()
	{
		gallery.facebookRenderShare(gallery.currentSlideshowObject, "#slideshow");
	});
	
	$(".tweet", buttonsContainer).click(function()
	{
		gallery.twitterRenderTweet(gallery.currentSlideshowObject, "#slideshow");
	});	
};

com.kyrafre.gallery.Gallery.init = function()
{
	jQT.resetHeight();
	com.kyrafre.gallery.Gallery.instance = new com.kyrafre.gallery.Gallery("http://www.hollyready.com");
	com.kyrafre.gallery.Gallery.instance.contentHeight = $(window).height()
		- ($("#header").outerHeight(true) + $("#footer").outerHeight(true));
	com.kyrafre.gallery.Gallery.instance.contentWidth = $(window).width();
	com.kyrafre.gallery.Gallery.awaitReachability(function()
	{
		com.kyrafre.gallery.Gallery.start(com.kyrafre.gallery.Gallery.instance);
	});
}

com.kyrafre.gallery.Gallery.start = function(gallery)
{
	gallery.getProperties
	(function()
	{
		if (typeof gallery.properties.title !== "undefined")
		{
			$("#gallery > div > h1").text(gallery.properties.title);
			$("#slideshow > div > h1").text(gallery.properties.title);
		}

		$(".contentPane").height(gallery.contentHeight);
		com.kyrafre.gallery.Gallery.initPreferencesPage(gallery);
		com.kyrafre.gallery.Gallery.initSlideshowPage(gallery);
	 
		$("#gallery").bind("pageAnimationEnd", function(event, info)
		{
			if (info.direction === "in")
			{
				if (gallery.filterChanged)
				{
					gallery.displayImages();	  
					gallery.filterChanged = false;
				}
				else if (typeof gallery.galleryScroller !== "undefined")
				{
					gallery.galleryScroller.setupScroller(true);
					gallery.galleryScroller.scrollTo(gallery.currentSlideshowObject.position, 0);
				}
			}
		});
		$("#gallery").bind("pageAnimationStart", function(event, info)
		{
			if (info.direction === "out")
			{
				for (var i = 0; i < gallery.imageMetadata.length; ++i)
				{
					var position = gallery.scrollPosition + (gallery.contentWidth / 2);
					var obj = gallery.imageMetadata[i];
						   
					if (obj.position <= position && obj.position + obj.width > position)
					{
						gallery.currentSlideshowObject = obj;
						break;
					}
				}
			}
		});
		$("#gallery .titleBarToolRight2").click(function()
		{
			gallery.displayImages();			
			gallery.filterChanged = false;
		});
		$("#gallery .titleBarToolLeft").click(function()
		{
			gallery.goTo("#slideshow", "dissolve");
		});
		$("#slideshow").bind("pageAnimationEnd", function(event, info)
		{
			if (info.direction === "in")
			{
				var buttonsContainer = $("#slideshow-container .sharingButtonsContainer");
				var buttonsWidth = buttonsContainer.outerWidth(true);
				buttonsContainer.css("left", (gallery.contentWidth - buttonsWidth) / 2);
				gallery.loadSlideshowImage();
				gallery.isSlideshowRunning = true;
			}
		});
		$("#slideshow").bind("pageAnimationStart", function(event, info)
		{
			if (info.direction === "out")
			{
				clearTimeout(gallery.slideshowTimer);
				gallery.isSlideshowRunning = false;
			}
		});
		$("#slideshow .titleBarToolLeft").click(function()
		{
			if (gallery.isSlideshowRunning)
			{
				clearTimeout(gallery.slideshowTimer);
				$("#slideshow .titleBarToolLeft").attr("src", "icons/16-play.png");
			}
			else
			{
				gallery.slideshowTimer = setTimeout(function(){gallery.loadSlideshowImage();}, 5000);
				$("#slideshow .titleBarToolLeft").attr("src", "icons/17-pause.png");
			}
												
			gallery.isSlideshowRunning = !gallery.isSlideshowRunning;
		});
		$("#contact").bind("pageAnimationStart", function(event, info)
		{
			if (info.direction === "in" && typeof gallery.contactLoaded === "undefined")
			{
				com.kyrafre.gallery.Gallery.initContactPage(gallery);
				gallery.contactLoaded = true;
			}
		});
		$("#statement").bind("pageAnimationEnd", function(event, info)
		{
			if (info.direction === "in" && typeof gallery.statementLoaded === "undefined")
			{
				gallery.renderHTML($("#statement-container"), gallery.properties.statement);
				gallery.statementLoaded = true;
			}
		});
		$("#statement .titleBarToolRight2").click(function()
		{
			gallery.renderHTML($("#statement-container"), gallery.properties.statement);			
		});
		$(".galleryButton").click(function()
		{
			gallery.goTo("#gallery", "dissolve");
		});
		$("#facebookShare .shareButton").click(function()
		{
			gallery.facebookPost(gallery.sharedObject, gallery.sharingSourcePage);
		});
		$("#facebookShare .cancelButton").click(function()
		{
			gallery.goTo(gallery.sharingSourcePage, "flip");
		});
		$("#tweet .shareButton").click(function()
		{
			gallery.twitterTweet(gallery.sharedObject, gallery.sharingSourcePage);
		});
		$("#tweet .cancelButton").click(function()
		{
			gallery.goTo(gallery.sharingSourcePage, "flip");
		});
		$(".locationButton").click(function()
		{
			gallery.goTo("#contact", "dissolve");
		});
		$(".statementButton").click(function()
		{
			gallery.goTo("#statement", "dissolve");
		});
		$(".preferencesButton").click(function()
		{
			gallery.goTo("#preferences", "dissolve");
		});
		$("#sign-out-button").click(function()
		{
			delete localStorage.facebookToken;
			delete localStorage.twitterToken;
			navigator.notification.alert("Successfully signed out of Facebook and Twitter.",
										 function(){}, "Signed Out", "Dismiss");
		});
	 
		gallery.audioIndex = 0;
		gallery.filterChanged = false;
		gallery.media = [];
		gallery.scrollPosition = 0;
		gallery.selectedPage = "#gallery";

		gallery.displayImages();
	});
};

function onApplicationStart(service, keys)
{
	var values = [];
	var resolveKeys = function()
	{
		if (keys.length > 0)
		{
			var key = keys.splice(0, 1)[0];
			window.plugins.keychain.getForKey(key, service,
			function(key, value)
			{
				values.push(value);
				resolveKeys();
			},
			function(){
				alert("Failed to resolve " + key);
			});
		}
		else
		{
			if (typeof gallery === "undefined") gallery = {};
			com.kyrafre.gallery.Gallery.instance.facebookSvc = new com.kyrafre.facebook.Service
				(new com.kyrafre.facebook.Accessor(values[0], values[1],
												   "http://www.facebook.com/connect/login_success.html"));			
			var twitterServiceProvider = new com.kyrafre.twitter.ServiceProvider("HMAC-SHA1",
																				 "https://api.twitter.com/oauth/request_token",
																				 "https://api.twitter.com/oauth/authorize",
																				 "https://api.twitter.com/oauth/access_token",
																				 "http://localhost/oauth-provider/echo",
																				 "http://www.hollyready.com/auth-callback");
			var twitterAccessor = new com.kyrafre.twitter.Accessor(values[2], values[3], twitterServiceProvider);
			com.kyrafre.gallery.Gallery.instance.twitterSvc = new com.kyrafre.twitter.Service(twitterAccessor);
		}
	};
	resolveKeys();
}

function onApplicationDidBecomeActive()
{
	if (typeof com.kyrafre.gallery.Gallery.instance !== "undefined")
	{
		com.kyrafre.gallery.Gallery.instance.applicationBecameActiveHandler();
	}
}

$(function()
{
	document.addEventListener("deviceready", com.kyrafre.gallery.Gallery.init, false);
});
