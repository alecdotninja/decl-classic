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

	var append = Function.prototype.apply.bind(Array.prototype.push);

	var Element = global.Element;
	if(typeof(Element) !== 'function') throw new Error('createDecl: global must define Element');

	var documentElement = global.document && global.document.documentElement;
	if(!(documentElement instanceof Element)) throw new Error('createDecl: global must have an initialized document');

	var MutationObserver = global.MutationObserver;
	if(typeof(MutationObserver) !== 'function') throw new Error('createDecl: global must define MutationObserver');
	
	var rules = [];
	var mutationObserver = null;
	var rootNode = global.document.documentElement;

	function handleMutations(mutations) {
		mutations.forEach(function(mutation) {
			var addedNodes = null;

			if(mutation.addedNodes) {
				addedNodes = Array.apply(null, mutation.addedNodes);
			}

			var removedNodes = null;

			if(mutation.removedNodes) {
				removedNodes = Array.apply(null, mutation.removedNodes);
			}

			var changedNodes = null;

			if(mutation.target && mutation.target instanceof Element) {
				changedNodes = [mutation.target];
			}

			rules.forEach(function(rule) {
				if(addedNodes) {
					rule.handleNodesAdded(addedNodes);
				}

				if(changedNodes) {
					rule.handleNodesChanged(changedNodes);
				}

				if(removedNodes) {
					rule.handleNodesRemoved(removedNodes);
				}
			});
		});
	}

	function Decl(selector, options) {
		var rule = Decl.createRule(selector, options);

		Decl.addRule(rule);

		if(!mutationObserver) {
			Decl.startWatching();
		}

		return rule;
	}

	Object.defineProperties(Decl, {
		startWatching: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function startWatching() {
				if(mutationObserver) throw new Error('Decl is already watching.');
				mutationObserver = new MutationObserver(handleMutations)

				mutationObserver.observe(rootNode, {
					attributes: true,
					characterData: true,
					childList: true,
					subtree: true
				});

				var addedNodes = [rootNode];

				rules.forEach(function(rule) {
					rule.handleNodesAdded(addedNodes);
				});
			}
		},
		stopWatching: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function stopWatching() {
				if(!mutationObserver) throw new Error('Decl is not watching.');

				var removedNodes = [rootNode];

				rules.forEach(function(rule) {
					rule.handleNodesRemoved(removedNodes);
				});

				mutationObserver.disconnect();
				mutationObserver = null;
			}
		},
		isWatching: {
			configurable: false,
			enumerable: true,
			get: function getIsWatching() {
				return !!mutationObserver;
			},
			set: function setIsWatching(newIsWatching) {
				var isWatching = !!mutationObserver;

				if(typeof(newIsWatching) !== 'boolean') {
					throw new TypeError('Decl.isWatching must be a boolean');
				}

				if(newIsWatching && !isWatching) {
					Decl.startWatching();
				}else if(!newIsWatching && isWatching){
					Decl.stopWatching();
				}

				return isWatching;
			}
		},

		rootNode: {
			configurable: false,
			enumerable: true,
			get: function getRootNode() {
				return rootNode;
			},
			set: function setRootNode(newRootNode) {
				if(mutationObserver) {
					throw new Error('Decl.rootNode cannot be changed while watching');
				}

				if(!(rootNode instanceof Element)) {
					throw new TypeError('Decl.rootNode must be an Element');
				}

				return rootNode = newRootNode;
			}
		},

		Rule: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function Rule() {
				throw new Error('Use Decl.createRule instead');
			}
		},

		createRule: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function createRule(selector, options) {
				if(typeof(selector) !== 'string') {
					throw new TypeError('Decl.createRule: selector must be a string');
				}

				if(options.matches && typeof(options.matches) !== 'function') {
					throw new TypeError('Decl.createRule: matches must be a function');
				}

				if(options.unmatches && typeof(options.unmatches) !== 'function') {
					throw new TypeError('Decl.createRule: unmatches must be a function');
				}

				var rule = new Rule();

				Object.defineProperties(rule, {
					selector: {
						configurable: false,
						enumerable: true,
						writable: false,
						value: selector
					},
					matches: {
						configurable: false,
						enumerable: true,
						writable: false,
						value: options.matches
					},
					unmatches: {
						configurable: false,
						enumerable: true,
						writable: false,
						value: options.unmatches
					}
				});

				return rule;
			}
		},

		addRule: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function addRule(rule) {
				if(rule instanceof Rule) {
					rules.push(rule);
				}else{
					throw new TypeError('Decl.addRule: rule must be a Decl.Rule');
				}
			}
		},
		removeRule: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function removeRule(rule) {
				if(rule instanceof Rule) {
					var index = rules.indexOf(rule);

					if(index >= 0) {
						rules.splice(index, 1);
					}else{
						throw new Error('Decl.removeRule: rule not found');
					}
				}else{
					throw new TypeError('Decl.removeRule: rule must be a Decl.Rule');
				}
			}
		},

		prototype: {
			configurable: false,
			enumerable: false,
			writable: false,
			value: null
		}
	});

	function Rule() {
		if(!(this instanceof Rule)) return new Rule();

		var matchingNodes = [];

		Object.defineProperty(this, 'matchingNodes', {
			configurable: false,
			enumerable: true,
			writable: false,
			value: matchingNodes
		});
	}

	Object.defineProperty(Decl.Rule, 'prototype', {
		configurable: false,
		enumerable: false,
		writable: false,
		value: Rule.prototype
	});

	Object.defineProperties(Rule.prototype, {
		constructor: {
			configurable: false,
			enumerable: false,
			writable: false,
			value: Decl.Rule
		},

		matchingNodes: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: null
		},
		selector: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: null
		},

		handleNodesAdded: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function handleNodesAdded(addedNodes) {
				var matchingNodes = this.matchingNodes;

				this.collectRelevantNodes(addedNodes).forEach(function(node) {
					var index = matchingNodes.indexOf(node);

					if(index === -1) {
						matchingNodes.push(node);
						if(typeof(this.matches) === 'function') this.matches(node);				
					}
				}.bind(this));
			}
		},
		handleNodesRemoved: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function handleNodesRemoved(removedNodes) {
				var matchingNodes = this.matchingNodes;

				this.collectRelevantNodes(removedNodes).forEach(function(node) {
					var index = matchingNodes.indexOf(node);

					if(index >= 0) {
						matchingNodes.splice(index, 1);
						if(typeof(this.unmatches) === 'function') this.unmatches(node);
					}
				}.bind(this));
			}
		},
		handleNodesChanged: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function handleNodesChanged(changedNodes) {
				var matchingNodes = this.matchingNodes;

				this.collectRelevantNodes(changedNodes).forEach(function(node) {
					var index = matchingNodes.indexOf(node);

					if(index === -1) {
						matchingNodes.push(node);
						if(typeof(this.matches) === 'function') this.matches(node);				
					}
				});

				var stillMatchingNodes = this.collectRelevantNodes(matchingNodes);

				for(var index = 0, length = matchingNodes.length, node = null; index < length; index++) {
					node = matchingNodes[index];

					if(stillMatchingNodes.indexOf(node) === -1) {
						matchingNodes.splice(index, 1);

						if(typeof(this.unmatches) === 'function') this.unmatches(node);

						index = index - 1;
					}
				}
			}
		},
		collectRelevantNodes: {
			configurable: false,
			enumerable: true,
			writable: false,
			value: function collectRelevantNodes(rootNodes) {
				var relevantNodes = [];

				rootNodes.forEach(function(node) {
					if(node instanceof Element) {
						if(node.matches(this.selector)) {
							relevantNodes.push(node);
						}

						append(relevantNodes, node.querySelectorAll(this.selector));
					}
				}.bind(this));

				return relevantNodes;
			}
		},
		isActive: {
			configurable: false,
			enumerable: true,
			get: function getIsRuleActive() {
				return Decl.isWatching && rules.indexOf(this) >= 0;
			},
			set: function setIsRuleActive(newIsRuleActive) {
				throw new Error('rule.isRuleActive cannot be modified directly');
			}
		}
	});

	return Decl;
}));