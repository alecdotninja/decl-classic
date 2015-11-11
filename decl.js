(function(global, factory) {
	if (typeof module === "object" && typeof module.exports === "object") {
		module.exports = global.document ? 
							factory(global) : 
							function(global) { 
								return factory(global); 
							};
	}else{
		global.Decl = factory(global);
	}
}(typeof window !== "undefined" ? window : this, function createDecl(global) {
	'use strict';

	var rootElement = global.document.documentElement;
	var MutationObserver = global.MutationObserver;

	var Rule = function Rule() {
		if(!(this instanceof Rule)) return new Rule();
	};

	var _indexOf = Array.prototype.indexOf;

	Rule.prototype.sweep = function() {	
		var matchingElements = rootElement.querySelectorAll(this.selector);
		var matches = (this.matches = this.matches || []);
		var index, length, element;

		for(index = 0, length = matchingElements.length; index < length; index++) {
			element = matchingElements[index];

			if(matches.indexOf(element) === -1) {
				matches.push(element);

				try {
					if(this.onMatch) (element);
				}catch(exception){
					setTimeout(function() {
						throw exception;
					}, 0);
				}
			}
		}

		for(index = 0, length = matches.length; index < length; index++) {
			element = matches[index];

			if(_indexOf.call(matchingElements, element) === -1) {
				matches.splice(index--, 1);
				length = matches.length;

				try {
					if(this.onUnmatch) this.onUnmatch(element);
				}catch(exception){
					setTimeout(function() {
						throw exception;
					}, 0);
				}
			}
		}

		return this;
	};

	Rule.prototype.initialize = Rule.prototype.sweep;

	Rule.prototype.cleanup = function() {
		var matches = (this.matches = this.matches || []);
		var index, length, element;

		for(index = 0, length = matches.length; index < length; index++) {
			element = matches[index];
			
			matches.splice(index--, 1);

			try {
				if(this.onUnmatch) this.onUnmatch(element);
			}catch(exception){
				setTimeout(function() {
					throw exception;
				}, 0);
			}
		}

		return this;
	};

	var activeRules = [];
	var stack = [];

	var processActiveRules = function() {
		for(var index = 0, length = activeRules.length, rule; index < length; index++) {
			rule = activeRules[index];

			if(stack.indexOf(rule) === -1) {
				stack.push(rule);

				try {
					rule.sweep();
				}catch(exception){
					setTimeout(function() {
						throw exception;
					}, 0);
				}

				stack.pop();
			}
		}
	};

	var animationFrameState = 0;
	// 0 - outside
	// 1 - waiting
	// 2 - inside

	var handleMutation = function() {
		if(animationFrameState === 0) {
			requestAnimationFrame(function() {
				animationFrameState = 2;

				try {
					handleMutation();
				}finally{
					animationFrameState = 0;
				}
			});

			animationFrameState = 1;
		}else if(animationFrameState === 1) {
			// nothing
		}else if(animationFrameState === 2){
			processActiveRules();
		}else{
			animationFrameState = 0;
		}
	};


	var mutationObserver = null;

	var Decl = function Decl(selector, options) {
		var rule = Decl.createRule(selector, options);

		if(!mutationObserver) {
			Decl.startWatching();
		}

		Decl.addRule(rule);

		return rule;
	};

	Decl.isWatching = false;
	
	Decl.startWatching = function() {
		if(!mutationObserver) {
			for(var index = 0, length = activeRules.length, rule; index < length; index++) {
				rule = activeRules[index];

				try{
					rule.initialize();
				}catch(exception){
					setTimeout(function() {
						throw exception;
					}, 0);
				}
			}

			mutationObserver = new MutationObserver(handleMutation);

			mutationObserver.observe(rootElement, {
				attributes: true,
				characterData: true,
				childList: true,
				subtree: true
			});

			Decl.isWatching = true;
		}

		return this;
	};

	Decl.stopWatching = function() {
		if(mutationObserver) {
			mutationObserver.disconnect();
			mutationObserver = null;

			for(var index = 0, length = activeRules.length, rule; index < length; index++) {
				rule = activeRules[index];

				try{
					rule.cleanup();
				}catch(exception){
					setTimeout(function() {
						throw exception;
					}, 0);
				}
			}

			Decl.isWatching = false;
		}

		return this;
	};

	Decl.addRule = function(rule) {
		if(mutationObserver) {
			try{
				rule.initialize();
			}catch(exception){
				setTimeout(function() {
					throw exception;
				}, 0);
			}
		}

		activeRules.push(rule);

		return this;
	};

	Decl.removeRule = function(rule) {
		var index = activeRules.indexOf(rule);

		if(index >= 0) {
			activeRules.splice(index, 1);

			try{
				rule.cleanup();
			}catch(exception){
				setTimeout(function() {
					throw exception;
				}, 0);
			}
		}

		return this;
	};

	Decl.createRule = function(selector, options) {
		var rule = new Rule(); // eww

		rule.selector = selector;
		rule.onMatch = options.matches;
		rule.onUnmatch = options.unmatches;
		
		return rule;
	};
	
	return Decl;
}));
