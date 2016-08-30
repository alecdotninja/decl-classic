var Decl = (function () {
  "use strict";

  var MATCHER_TYPE_ERROR = "Decl: A rule's `matcher` must be a CSS selector (string) or a function which takes a node under consideration and returns a CSS selector (string) that matches all matching nodes in the subtree, an array-like object of matching nodes in the subtree, or a boolean value as to whether the node should be included (in this case, the function will be invoked again for all children of the node).";
  var MATCHES_TYPE_ERROR = "Decl: A rule's `matches` callback must be a function.";
  var UNMATCHES_TYPE_ERROR = "Decl: A rule's `unmatches` callback must be a function.";
  var RULE_TYPE_ERROR = "Decl: Expected an instance of `Decl.Rule`. Use `Decl.createRule` or `new Decl.Rule` to create one.";

  var ROOT_NODE = document.documentElement;

  var MutationObserver = window.MutationObserver || window.webkitMutationObserver || null;
  var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || null;

  var debug = false;

  var rules = [];
  var isWatching = false;

  var isSynchronizingRules = false;
  var isCurrentTreeTainted = false;
  var mutationObserver = null;

  function scheduleRuleSynchronization() {
    if (!isCurrentTreeTainted) {
      isCurrentTreeTainted = true;

      if (isSynchronizingRules) {
        if (debug) {
          console.log('Decl: Tree tainted, but synchronization is already in progress. Ignoring.', arguments);
        }
      }else{
        if (debug) {
          console.log('Decl: Tree tainted. Rules will be synchronized before the next render.', arguments);
        }

        if (requestAnimationFrame) {
          requestAnimationFrame(synchronizeRules);
        } else {
          setTimeout(synchronizeRules, 16); // 16ms ~> 60 fps
        }
      }
    }else{
      if (debug) {
        console.log('Decl: Tree tainted, but synchronization is already scheduled. Ignoring.', arguments);
      }
    }
  }

  function synchronizeRules() {
    isSynchronizingRules = true;

    try {
      if (debug) {
        console.log('Decl: Starting rule synchronization.');
      }

      while(isCurrentTreeTainted) {
        isCurrentTreeTainted = false;

        for (var index = 0, length = rules.length, rule; index < length; index++) {
          rule = rules[index];

          synchronizeRule(rule);
        }
      }
    } finally {
      isSynchronizingRules = false;
    }

    if (debug) {
      console.log('Decl: Done with rule synchronization. Tree is pristine.');
    }
  }

  var _indexOf = Array.prototype.indexOf;

  function arrayDifference(a, b) {
    var difference = [];

    for (var index = 0, length = a.length, element; index < length; index++) {
      element = a[index];

      if (_indexOf.call(b, element) === -1) {
        difference.push(element);
      }
    }

    return difference;
  }

  function callbackForEach(rule, propertyName, nodes) {
    var callback = rule[propertyName];

    for (var index = 0, length = nodes.length, node; index < length; index++) {
      node = nodes[index];

      if (debug) {
        console.log('Decl: Node', node, propertyName, 'on rule', rule);
      }
      
      try {
        if (typeof(callback) === 'function') {
          callback.call(rule, node);
        }
      } catch (exception) {
        if (debug) {
          console.error('Decl: Uncaught exception (', exception, ') in callback', callback, 'on rule', rule, 'for node', node);
        }
      }
    }
  }

  function synchronizeRule(rule) {
    var previouslyMatchingNodes = rule.matchingNodes;
    var currentlyMatchingNodes = findAllMatchingNodes(ROOT_NODE, rule.matcher);

    if (!previouslyMatchingNodes) {
      previouslyMatchingNodes = [];
    }

    rule.matchingNodes = currentlyMatchingNodes;

    var addedNodes = arrayDifference(currentlyMatchingNodes, previouslyMatchingNodes);
    var removedNodes = arrayDifference(previouslyMatchingNodes, currentlyMatchingNodes);

    if (addedNodes.length > 0) {
      callbackForEach(rule, 'matches', addedNodes);
    }

    if (removedNodes.length > 0) {
      callbackForEach(rule, 'unmatches', removedNodes);
    }
  }

  function shutdownRule(rule) {
    if (rule.matchingNodes) {
      var nodes = rule.matchingNodes;
      rule.matchingNodes = [];

      callbackForEach(rule, 'unmatches', nodes);
    }
  }

  function findAllMatchingNodes(node, matcherOrMatchValue, __matchingNodes) {
    var matcher;
    var matchValue;

    if (typeof(matcherOrMatchValue) === 'function') {
      matcher = matcherOrMatchValue;
      matchValue = matcher(node);
    } else {
      matchValue = matcherOrMatchValue;
      matcher = function () {
        return matchValue;
      };
    }

    switch (typeof(matchValue)) {
      case 'string':
        if (typeof(jQuery) === 'function') {
          // jQuery will mutate a node without an id in order to facilitate faster searching.
          // This can be avoided when searching the entire document by explicitly NOT passing a context.
          if(node === ROOT_NODE) {
            return jQuery(matchValue);
          }else{
            return jQuery(matchValue, node);
          }
        } else {
          return node.querySelectorAll(matchValue);
        }

      case 'boolean':
        __matchingNodes = __matchingNodes || [];

        if (matchValue) {
          __matchingNodes.push(node);
        }

        var childNodes = node.childNodes;

        for (var index = 0, length = childNodes.length, childNode; index < length; index++) {
          childNode = childNodes[index];

          findAllMatchingNodes(childNode, matcher, __matchingNodes);
        }

        return __matchingNodes;

      case 'undefined':
        return [];

      case 'object':
        if (matchValue === null) {
          return [];
        } else if (typeof(matchValue.length) === 'number') {
          return matchValue;
        } else {
          throw new TypeError(MATCHER_TYPE_ERROR);
        }

      default:
        throw new TypeError(MATCHER_TYPE_ERROR);
    }
  }

  function Rule(options) {
    if (!(this instanceof Rule)) {
      return new Rule(options);
    }

    this.matchingNodes = [];

    if (typeof(options.matcher) === 'string' || typeof(options.matcher) === 'function') {
      this.matcher = options.matcher;
    } else {
      throw new TypeError(MATCHER_TYPE_ERROR);
    }

    if (options.matches) {
      if (typeof(options.matches) === 'function') {
        this.matches = options.matches;
      } else {
        throw new TypeError(MATCHES_TYPE_ERROR);
      }
    }

    if (options.unmatches) {
      if (typeof(options.unmatches) === 'function') {
        this.unmatches = options.unmatches;
      } else {
        throw new TypeError(UNMATCHES_TYPE_ERROR);
      }
    }
  }

  function createRule(ruleOptions) {
    return Rule(ruleOptions);
  }

  function addRule(rule) {
    if (rule instanceof Rule) {
      var index = rules.indexOf(rule);

      if (index === -1) {
        rules.push(rule);

        if (debug) {
          console.log('Decl: Added rule', rule);
        }

        if (isWatching) {
          scheduleRuleSynchronization();
        }
      }

      return rule;
    } else {
      throw new TypeError(RULE_TYPE_ERROR);
    }
  }

  function removeRule(rule) {
    if (rule instanceof Rule) {
      var index = rules.indexOf(rule);

      if (index !== -1) {
        rules.splice(index, 1);

        if (debug) {
          console.log('Decl: Removed rule', rule);
        }

        shutdownRule(rule);
      }

      return rule;
    } else {
      throw new TypeError(RULE_TYPE_ERROR);
    }
  }

  function startWatching() {
    if (!isWatching) {
      if (MutationObserver) {
        mutationObserver = new MutationObserver(scheduleRuleSynchronization);
        mutationObserver.observe(ROOT_NODE, {childList: true, attributes: true, subtree: true});

        if (debug) {
          console.log('Decl: Started watching', ROOT_NODE, 'via MutationObserver');
        }
      } else {
        ROOT_NODE.addEventListener('DOMAttrModified', scheduleRuleSynchronization, true);
        ROOT_NODE.addEventListener('DOMNodeInserted', scheduleRuleSynchronization, true);
        ROOT_NODE.addEventListener('DOMNodeRemoved', scheduleRuleSynchronization, true);

        if (debug) {
          console.log('Decl: Started watching', ROOT_NODE, 'via mutation events (DOMAttrModified, DOMNodeInserted, and DOMNodeRemoved)');
        }
      }

      isWatching = true;

      return true;
    } else {
      return false;
    }
  }

  function stopWatching() {
    if (isWatching) {
      if (MutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;

        if (debug) {
          console.log('Decl: Stopped watching', ROOT_NODE, 'via MutationObserver');
        }
      } else {
        ROOT_NODE.removeEventListener('DOMAttrModified', scheduleRuleSynchronization, true);
        ROOT_NODE.removeEventListener('DOMNodeInserted', scheduleRuleSynchronization, true);
        ROOT_NODE.removeEventListener('DOMNodeRemoved', scheduleRuleSynchronization, true);

        if (debug) {
          console.log('Decl: Stopped watching', ROOT_NODE, 'via mutation events (DOMAttrModified, DOMNodeInserted, and DOMNodeRemoved)');
        }
      }

      isWatching = false;

      return true;
    } else {
      return false;
    }
  }

  function shutdown() {
    var rule;

    while (rule = rules[0]) {
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

  Object.defineProperties(Decl, {
    debug: {get: function () { return debug; }, set: function(value) { return (debug = value); }, enumerable: true},

    Rule: {value: Rule, enumerable: true},
    createRule: {value: createRule, enumerable: true},

    rules: {value: rules, enumerable: true},
    addRule: {value: addRule, enumerable: true},
    removeRule: {value: removeRule, enumerable: true},

    startWatching: {value: startWatching, enumerable: true},
    stopWatching: {value: stopWatching, enumerable: true},
    isWatching: {get: function () { return isWatching; }, enumerable: true},

    shutdown: {value: shutdown, enumerable: true},

    prototype: {value: null, enumerable: false}
  });

  return Decl;
})();
