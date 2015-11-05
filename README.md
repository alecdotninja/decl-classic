# decl.js
Decl is a simple library designed to enable more declarative and unobtrusive JavaScript.

## Usage

```javascript
// Automatically adds select2 to all <select data-select2 />
Decl('select[data-select2]', {
  matches: function(node) {
    $(node).select2();
  },
  unmatches: function(node) {
    $(node).select2('destroy');
  }
});
```
