/**
 * Custom ESLint rule to prevent "Danni" usage
 * Prevents regression after Danni → Alonso rename
 */

module.exports = {
  "rules": {
    "no-danni-references": {
      "meta": {
        "type": "problem",
        "docs": {
          "description": "Prevent use of deprecated bot name 'Danni' (use 'Alonso' instead)",
          "category": "Possible Errors"
        },
        "fixable": "code",
        "schema": []
      },
      "create": function(context) {
        return {
          "Program": function(node) {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText();
            
            // Check for Danni references (case-insensitive)
            const danniRegex = /\bdanni\b/gi;
            let match;
            
            while ((match = danniRegex.exec(text)) !== null) {
              const start = match.index;
              const end = start + match[0].length;
              
              context.report({
                node: node,
                loc: sourceCode.getLocFromIndex(start),
                message: "Deprecated bot name 'Danni' found. Use 'Alonso' instead.",
                fix: function(fixer) {
                  return fixer.replaceTextRange([start, end], "Alonso");
                }
              });
            }
          }
        };
      }
    }
  }
};