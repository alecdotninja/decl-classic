var Decl = (function() {
	"use strict";

	var MATCHER_TYPE_ERROR = "Decl: A rule's `matcher` must be a CSS selector (string) or a function which takes a node under consideration and returns a CSS selector (string) that matches all matching nodes in the subtree, an array-like object of matching nodes in the subtree, or a boolean value as to whether the node should be included (in this case, the function will be invoked again for all children of the node).";
	var MATCHES_TYPE_ERROR = "Decl: A rule's `matches` callback must be a function.";
	var UNMATCHES_TYPE_ERROR = "Decl: A rule's `unmatches` callback must be a function.";
	var RULE_TYPE_ERROR = "Decl: Expected an instance of `Decl.Rule`. Use `Decl.createRule` or `new Decl.Rule` to create one.";

	var ROOT_NODE = document.documentElement;

	var MutationObserver = window.MutationObserver || window.webkitMutationObserver || null;
	var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || null;

	var rules = [];
	var isWatching = false;

	var isCurrentTreeTainted = false;
	var mutationObserver = null;

	function sechduleRuleSynchronization() {
		if(!isCurrentTreeTainted) {
			isCurrentTreeTainted = true;

			if(requestAnimationFrame) {
				requestAnimationFrame(synchronizeRules);
			}else{
				setTimeout(synchronizeRules, 16)
			}
		}
	}

	function synchronizeRules() {
		isCurrentTreeTainted = false;

		if(mutationObserver) {
			mutationObserver.takeRecords();
		}

		for(var index = 0, length = rules.length, rule; index < length; index++) {
			rule = rules[index];

			synchronizeRule(rule);
		}
	}

	var _indexOf = Array.prototype.indexOf;
	function arrayDifference(a, b) {
		var difference = [];

		for(var index = 0, length = a.length, element; index < length; index++) {
			element = a[index];

			if(_indexOf.call(b, element) === -1) {
				difference.push(element);
			}
		}		

		return difference;
	}

	function callbackForEach(nodes, callback) {
		for(var index = 0, length = nodes.length, node; index < length; index++) {
			node = nodes[index];

			try {
				callback(node);
			}catch(exception){
				console.error(exception);
			}
		}
	}

	function synchronizeRule(rule) {
		var previouslyMatchingNodes = rule._matchingNodes;
		var currentlyMatchingNodes = findAllMatchingNodes(ROOT_NODE, rule.matcher);
		
		rule._matchingNodes = currentlyMatchingNodes;

		var addedNodes = arrayDifference(currentlyMatchingNodes, previouslyMatchingNodes);
		var removedNodes = arrayDifference(previouslyMatchingNodes, currentlyMatchingNodes);

		callbackForEach(addedNodes, rule.matches);
		callbackForEach(removedNodes, rule.unmatches);
	}

	function shutdownRule(rule) {
		if(rule._matchingNodes) {
			var nodes = rule._matchingNodes;
			rule._matchingNodes = [];

			callbackForEach(nodes, rule.unmatches);
		}
	}

	function findAllMatchingNodes(node, matcherOrMatchValue, __matchingNodes) {
		var matcher;
		var matchValue;

		if(typeof(matcherOrMatchValue) === 'function') {
			matcher = matcherOrMatchValue;
			matchValue = matcher(node);
		}else{
			matchValue = matcherOrMatchValue;
			matcher = function() {
				return matchValue;
			};
		}

		switch( typeof(matchValue) ) {
			case 'string':
				if(typeof(jQuery) === 'function') {
					return jQuery(matchValue, node);
				}else{
					return node.querySelectorAll(matchValue);
				}

			case 'boolean':
				__matchingNodes = __matchingNodes || [];

				if(matchValue) {
					__matchingNodes.push(node);
				}

				var childNodes = node.childNodes;

				for(var index = 0, length = childNodes.length, childNode; index < length; index++) {
					childNode = childNodes[index];
					
					findAllMatchingNodes(childNode, matcher, __matchingNodes);
				}

				return __matchingNodes;

			case 'undefined':
				return [];

			case 'object':
				if(matchValue === null) {
					return [];
				}else if(typeof(matchValue.length) === 'number') {
					return matchValue;
				}else{
					throw new TypeError(MATCHER_TYPE_ERROR);
				}

			default:
				throw new TypeError(MATCHER_TYPE_ERROR);
		}
	};

	function Rule(options) {
		if(!(this instanceof Rule)) {
			return new Rule(options);
		}

		if(typeof(options.matcher) === 'string' || typeof(options.matcher) === 'function') {
			this.matcher = options.matcher;
		}else{
			throw new TypeError(MATCHER_TYPE_ERROR);
		}

		if(options.matches) {
			if(typeof(options.matches) === 'function') {
				this.matches = options.matches;
			}else{
				throw new TypeError(MATCHES_TYPE_ERROR);
			}
		}

		if(options.unmatches) {
			if(typeof(options.unmatches) === 'function') {
				this.unmatches = options.unmatches;
			}else{
				throw new TypeError(UNMATCHES_TYPE_ERROR);
			}
		}

		this._matchingNodes = [];
	}

	function createRule(ruleOptions) {
		return Rule(ruleOptions);
	}

	function addRule(rule) {
		if(rule instanceof Rule) {
			var index = rules.indexOf(rule);

			if(index === -1) {
				rules.push(rule);

				if(isWatching) {
					sechduleRuleSynchronization();
				}
			}

			return rule;
		}else{
			throw new TypeError(RULE_TYPE_ERROR);
		}
	}

	function removeRule(rule) {
		if(rule instanceof Rule) {
			var index = rules.indexOf(rule);

			if(index !== -1) {
				rules.splice(index, 1);

				shutdownRule(rule);
			}

			return rule;
		}else{
			throw new TypeError(RULE_TYPE_ERROR);
		}
	}

	function startWatching() {
		if(!isWatching) {
			if(MutationObserver) {
				mutationObserver = new MutationObserver(sechduleRuleSynchronization);
				mutationObserver.observe(ROOT_NODE, { childList: true, attributes: true, subtree: true });
			}else{
				ROOT_NODE.addEventListener('DOMAttrModified', sechduleRuleSynchronization, true);
				ROOT_NODE.addEventListener('DOMNodeInserted', sechduleRuleSynchronization, true);
				ROOT_NODE.addEventListener('DOMNodeRemoved', sechduleRuleSynchronization, true);
			}
			
			isWatching = true;

			return true;
		}else{
			return false;
		}
	}

	function stopWatching() {
		if(isWatching) {
			if(MutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
			}else{
				ROOT_NODE.removeEventListener('DOMAttrModified', sechduleRuleSynchronization, true);
				ROOT_NODE.removeEventListener('DOMNodeInserted', sechduleRuleSynchronization, true);
				ROOT_NODE.removeEventListener('DOMNodeRemoved', sechduleRuleSynchronization, true);
			}
			
			isWatching = false;

			return true;
		}else{
			return false;
		}
	}

	function shutdown() {
		var rule;

		while(rule = rules[0]) {
			removeRule(rule);
		}

		stopWatching();
	}

	function Decl(ruleOptions) {
		var rule = createRule(ruleOptions);

		addRule(rule);
		startWatching();

		return rule;
	}

	var _slice = Array.prototype.slice;
	Object.defineProperties(Rule.prototype, {
		matchingNodes: { get: function() { return _slice.call(this._matchingNodes, 0); }, enumerable: true }
	});

	Object.defineProperties(Decl, {
		Rule: { value: Rule, enumerable: true },
		createRule: { value: createRule, enumerable: true },

		rules: { get: function() { return rules.slice(0); }, enumerable: true },
		addRule: { value: addRule, enumerable: true },
		removeRule: { value: removeRule, enumerable: true },

		startWatching: { value: startWatching, enumerable: true },
		stopWatching: { value: stopWatching, enumerable: true },
		isWatching: { get: function() { return isWatching; }, enumerable: true },

		shutdown: { value: shutdown, enumerable: true }
	});

	return Decl;
})();
