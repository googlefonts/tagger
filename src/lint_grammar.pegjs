Expression
    = head:Term _ "and" _ tail:Expression { return head && tail }
    / head:Term _ "or" _ tail:Expression { return head || tail }
    / Negation / Term / Parenthesized
 
Term =
    head:Value _ ">" _ tail:Value  { return head > tail }
/  head:Value _ ">=" _ tail:Value  { return head >= tail }
/  head:Value _ "<" _ tail:Value   { return head < tail }
/  head:Value _ "<=" _ tail:Value  { return head <= tail }
/  head:Value _ "==" _ tail:Value  { return head == tail }
/  head:Value _ "!=" _ tail:Value  { return head != tail }
/  head:Value _ "&" _ tail:Value   { return head & tail }
/  head:Value _ "|" _ tail:Value   { return head | tail }
/  head:String _ "in" _ tail:Value { return tail.includes(head) }
/ head:Value { return head !== undefined && head }
    
Value = Tag / FontAccess / FunctionCall / TagValues / Integer / "family" { return options.family }
 
Negation = "not" _ head:Expression  { return !head }

Parenthesized
  = "(" _ expr:Expression _ ")" { return expr }

Tag
  = "tag[\"" name:[A-Za-z/ ]+ "\"]" { return options.tags[name.join("")] }

FontAccess
  = "font[\"" key:[^"]+ "\"]" _ "[" _ subkey:[^"]+ "\]" { 
      // Basic font table access - return undefined for now as font data isn't fully implemented
      return undefined;
    }

FunctionCall
  = name:[a-zA-Z_][a-zA-Z0-9_]* _ "(" _ ")" {
      // Handle function calls - for now return undefined for unknown functions
      const funcName = name.join("");
      if (funcName === "tag_covers_100_percent") {
        // This would need access to tag data to implement properly
        return false;
      }
      return undefined;
    }

TagValues
  = "any" _ "(" _ var1:[a-zA-Z_][a-zA-Z0-9_]* _ ">" _ number:[0-9]+ _ "for" _ var2:[a-zA-Z_][a-zA-Z0-9_]* _ "in" _ "tag" _ "." _ "values" _ "(" _ ")" _ ")" {
      // Handle the any() comprehension - return false for now
      return false;
    }

Integer "integer"
  = _ [0-9]+ { return parseInt(text(), 10); }

_ "whitespace"
  = [ \t\n\r]*

String
  = "\"" string:[^"]+ "\"" { return string.join("") }