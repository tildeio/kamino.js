/* Kamino 3 Unit Test Suite | http://github.com/Cyril-sf/kamino.js */
(function (root) {
  var isLoader = typeof define == "function" && !!define.amd,
  isModule = typeof require == "function" && typeof exports == "object" && exports && !isLoader,
  isBrowser = "window" in root && root.window == root && typeof root.navigator != "undefined",
  isEngine = !isBrowser && !isModule && typeof root.load == "function",

  load = function load(module, path) {
    return root[module] || (isModule ? require(path) : isEngine ?
      (root.load(path.replace(/\.js$/, "") + ".js"), root[module]) : null);
  },

  // Load Spec, Newton, and Kamino 3.
  Spec = load("Spec", "./../vendor/spec/lib/spec"), Newton = load("Newton", "./../vendor/spec/lib/newton"), Kamino = load("Kamino", "../lib/kamino"),

  // Create the test suite.
  testSuite = Kamino.testSuite = new Spec.Suite("Kamino 3 Unit Tests");

  // Create and attach the logger event handler.
  testSuite.on("all", isBrowser ? Newton.createReport("suite") : Newton.createConsole(function (value) {
    if (typeof console != "undefined" && console.log) {
      console.log(value);
    } else if (typeof print == "function" && !isBrowser) {
      // In browsers, the global `print` function prints the current page.
      print(value);
    } else {
      throw value;
    }
  }));

  // Ensures that `Kamino.parse` throws an exception when parsing the given
  // `source` string.
  Spec.Test.prototype.parseError = function (source, message, callback) {
    return this.error(function () {
      Kamino.parse(source, callback);
    }, function (exception) {
      return exception.name == "SyntaxError";
    }, message);
  };

  // Ensures that `Kamino.parse` parses the given source string correctly.
  Spec.Test.prototype.parses = function (expected, source, message, callback) {
    var value;
    try {
      value = Kamino.parse(source, callback);
    } catch( exception) {
      value = exception.name;
    }
    return this.deepEqual(value, expected, message);
  };

  // Ensures that `Kamino.stringify` throws an exception when serializing the given
  // `value` object.
  Spec.Test.prototype.serializeError = function (value, message, filter, width) {
    return this.error(function () {
      Kamino.stringify(value, filter, width);
    }, function (exception) {
      return exception == DOMException;
    }, message);
  };

  // Ensures that `Kamino.stringify` serializes the given object correctly.
  Spec.Test.prototype.serializes = function (expected, value, message, filter, width) {
    var value;
    try {
      value = Kamino.stringify(value, filter, width);
    } catch( exception) {
      value = exception.name;
    }
    return this.strictEqual(value, expected, message);
  };

  // Tests
  // -----

  testSuite.addTest("`parse`: Empty Source Strings", function () {
    this.parseError("", "Empty Kamino source string");
    this.parseError("\n\n\r\n", "Source string containing only line terminators");
    this.parseError(" ", "Source string containing a single space character");
    this.parseError(" ", "Source string containing multiple space characters");
    this.done(4);
  });

  testSuite.addTest("`parse`: Whitespace", function (test) {
    // The only valid Kamino whitespace characters are tabs, spaces, and line
    // terminators. All other Unicode category `Z` (`Zs`, `Zl`, and `Zp`)
    // characters are invalid (note that the `Zs` category includes the
    // space character).
    var characters = ["{\u00a0}", "{\u1680}", "{\u180e}", "{\u2000}", "{\u2001}",
      "{\u2002}", "{\u2003}", "{\u2004}", "{\u2005}", "{\u2006}", "{\u2007}",
      "{\u2008}", "{\u2009}", "{\u200a}", "{\u202f}", "{\u205f}", "{\u3000}",
      "{\u2028}", "{\u2029}"];

    Spec.forEach(characters, function (value) {
      test.parseError(value, "Source string containing an invalid Unicode whitespace character");
    });

    this.parseError("{\u000b}", "Source string containing a vertical tab");
    this.parseError("{\u000c}", "Source string containing a form feed");
    this.parseError("{\ufeff}", "Source string containing a byte-order mark");

    this.parses({}, "{\r\n}", "Source string containing a CRLF line ending");
    this.parses({}, "{\n\n\r\n}", "Source string containing multiple line terminators");
    this.parses({}, "{\t}", "Source string containing a tab character");
    this.parses({}, "{ }", "Source string containing a space character");
    this.done(26);
  });

  testSuite.addTest("`parse`: Octal Values", function (test) {
    // `08` and `018` are invalid octal values.
    Spec.forEach(["00", "01", "02", "03", "04", "05", "06", "07", "010", "011", "08", "018"], function (value) {
      test.parseError(value, "Octal literal");
      test.parseError("-" + value, "Negative octal literal");
      test.parseError('"\\' + value + '"', "Octal escape sequence in a string");
      test.parseError('"\\x' + value + '"', "Hex escape sequence in a string");
    });
    this.done(48);
  });

  testSuite.addTest("`parse`: special numeric values", function (test) {
    this.parses(Infinity, "Infinity", "Infinity");
    this.parses(NaN, "NaN", "Not a number");
    this.parses(-Infinity, "NInfinity", "Negative Infinity");

    this.done(3);
  });

  testSuite.addTest("`parse`: Numeric Literals", function () {
    this.parses(100, "100", "Integer");
    this.parses(-100, "-100", "Negative integer");
    this.parses(10.5, "10.5", "Float");
    this.parses(-3.141, "-3.141", "Negative float");
    this.parses(0.625, "0.625", "Decimal");
    this.parses(-0.03125, "-0.03125", "Negative decimal");
    this.parses(1000, "1e3", "Exponential");
    this.parses(100, "1e+2", "Positive exponential");
    this.parses(-0.01, "-1e-2", "Negative exponential");
    this.parses(3125, "0.03125e+5", "Decimalized exponential");
    this.parses(100, "1E2", "Case-insensitive exponential delimiter");

    this.parseError("+1", "Leading `+`");
    this.parseError("1.", "Trailing decimal point");
    this.parseError(".1", "Leading decimal point");
    this.parseError("1e", "Missing exponent");
    this.parseError("1e-", "Missing signed exponent");
    this.parseError("--1", "Leading `--`");
    this.parseError("1-+", "Trailing `-+`");
    this.parseError("0xaf", "Hex literal");

    // The native `Kamino.parse` implementation in IE 9 allows this syntax, but
    // the feature tests should detect the broken implementation.
    this.parseError("- 5", "Invalid negative sign");

    this.done(20);
  });

  testSuite.addTest("`parse`: String Literals", function (test) {
    var expected = 49, controlCharacters = ["\u0001", "\u0002", "\u0003",
      "\u0004", "\u0005", "\u0006", "\u0007", "\b", "\t", "\n", "\u000b", "\f",
      "\r", "\u000e", "\u000f", "\u0010", "\u0011", "\u0012", "\u0013",
      "\u0014", "\u0015", "\u0016", "\u0017", "\u0018", "\u0019", "\u001a",
      "\u001b", "\u001c", "\u001d", "\u001e", "\u001f"];

    // Opera 7 discards null characters in strings.
    if ("\0".length) {
      expected += 1;
      controlCharacters.push("\u0000");
    }

    this.parses("value", '"value"', "Double-quoted string literal");
    this.parses("", '""', "Empty string literal");

    this.parses("\u2028", '"\\u2028"', "String containing an escaped Unicode line separator");
    this.parses("\u2029", '"\\u2029"', "String containing an escaped Unicode paragraph separator");
    this.parses("\ud834\udf06", '"\\ud834\\udf06"', "String containing an escaped Unicode surrogate pair");
    this.parses("\ud834\udf06", '"\ud834\udf06"', "String containing an unescaped Unicode surrogate pair");
    this.parses("\u0001", '"\\u0001"', "String containing an escaped ASCII control character");
    this.parses("\b", '"\\b"', "String containing an escaped backspace");
    this.parses("\f", '"\\f"', "String containing an escaped form feed");
    this.parses("\n", '"\\n"', "String containing an escaped line feed");
    this.parses("\r", '"\\r"', "String containing an escaped carriage return");
    this.parses("\t", '"\\t"', "String containing an escaped tab");

    this.parses("hello/world", '"hello\\/world"', "String containing an escaped solidus");
    this.parses("hello\\world", '"hello\\\\world"', "String containing an escaped reverse solidus");
    this.parses("hello\"world", '"hello\\"world"', "String containing an escaped double-quote character");

    this.parseError("'hello'", "Single-quoted string literal");
    this.parseError('"\\x61"', "String containing a hex escape sequence");
    this.parseError('"hello \r\n world"', "String containing an unescaped CRLF line ending");

    Spec.forEach(controlCharacters, function (value) {
      test.parseError('"' + value + '"', "String containing an unescaped ASCII control character");
    });

    this.done(expected);
  });

  testSuite.addTest("`parse`: Date Literals", function() {
    this.parses(new Date(Date.UTC(1994, 6, 3)), '%"1994-07-03T00:00:00.000Z"', "Dates should be parses according to the simplified date time string format");
    this.parses(new Date(Date.UTC(1993, 5, 2, 2, 10, 28, 224)), '%"1993-06-02T02:10:28.224Z"', "The date time string should conform to the format outlined in the spec");
    this.parses(new Date(-8.64e15), '%"-271821-04-20T00:00:00.000Z"', "The minimum valid date value should parse correctly");
    this.parses(new Date(8.64e15), '%"+275760-09-13T00:00:00.000Z"', "The maximum valid date value should parse correctly");
    this.parses(new Date(Date.UTC(10000, 0, 1)), '%"+010000-01-01T00:00:00.000Z"', "https://bugs.ecmascript.org/show_bug.cgi?id=119");

    // Tests based on research by @Yaffle. See kriskowal/es5-shim#111.
    this.parses(new Date(-1), '%"1969-12-31T23:59:59.999Z"', "Millisecond values < 1000 should be serialized correctly");
    this.parses(new Date(-621987552e5), '%"-000001-01-01T00:00:00.000Z"', "Years prior to 0 should be serialized as extended years");
    this.parses(new Date(2534023008e5), '%"+010000-01-01T00:00:00.000Z"', "Years after 9999 should be serialized as extended years");
    this.parses(new Date(-3509827334573292), '%"-109252-01-01T10:37:06.708Z"', "Issue #4: Opera > 9.64 should correctly serialize a date with a year of `-109252`");

    this.done(9);
  });

  testSuite.addTest("`parse`: RegExp Literals", function () {
    this.parses(new RegExp("w+"), "^\"w+\"\"\"", "Regular expressions with no modifiers");
    this.parses(new RegExp("w+", "i"), "^\"w+\"\"i\"", "Regular expressions with case-incensitive modifier");
    this.parses(new RegExp("w+", "g"), "^\"w+\"\"g\"", "Regular expressions with global matching modifier");
    this.parses(new RegExp("w+", "m"), "^\"w+\"\"m\"", "Regular expressions with multiline matching modifier");
    // this.parses(new RegExp("\w+"), "R10/\\w+/", "Regular expressions with a non default last index");

    this.done(4);
  });

  testSuite.addTest("`parse`: Array Literals", function () {
    this.parseError("[1, 2, 3,]", "Trailing comma in array literal");
    this.parses([1, 2, [3, [4, 5]], 6, [true, false], [null], [[]]], "[1, 2, [3, [4, 5]], 6, [true, false], [null], [[]]]", "Nested arrays");
    this.parses([{}], "[{}]", "Array containing empty object literal");
    this.parses([100, true, false, null, {"a": ["hello"], "b": ["world"]}, [0.01]], "[1e2, true, false, null, {\"a\": [\"hello\"], \"b\": [\"world\"]}, [1e-2]]", "Mixed array");
    this.done(4);
  });

  testSuite.addTest("`parse`: Object Literals", function () {
    this.parses({"hello": "world"}, "{\"hello\": \"world\"}", "Object literal containing one member");
    this.parses({"hello": "world", "foo": ["bar", true], "fox": {"quick": true, "purple": false}}, "{\"hello\": \"world\", \"foo\": [\"bar\", true], \"fox\": {\"quick\": true, \"purple\": false}}", "Object literal containing multiple members");

    this.parseError("{key: 1}", "Unquoted identifier used as a property name");
    this.parseError("{false: 1}", "`false` used as a property name");
    this.parseError("{true: 1}", "`true` used as a property name");
    this.parseError("{null: 1}", "`null` used as a property name");
    this.parseError("{'key': 1}", "Single-quoted string used as a property name");
    this.parseError("{1: 2, 3: 4}", "Number used as a property name");

    this.parseError("{\"hello\": \"world\", \"foo\": \"bar\",}", "Trailing comma in object literal");
    this.done(9);
  });

  testSuite.addTest("`parse`: object references", function () {
    message = Kamino.parse("{\"article\":{\"users\":[{\"name\":\"John\"}],\"comment\":{\"author\":&3}}}");
    this.strictEqual(message.article.users[0], message.article.comment.author, "");
    this.strictEqual(message.article.comment.author.name, "John");

    message = Kamino.parse("{\"article\":{\"users\":[{\"name\":\"John\"}],\"comment\":{\"author\":&3,\"article\":&1}}}");
    this.strictEqual(message.article.users[0], message.article.comment.author);
    this.strictEqual(message.article.comment.author.name, "John");
    this.strictEqual(message.article, message.article.comment.article);

    this.done(5);
  });

  // JavaScript expressions should never be evaluated, as Kamino 3 does not use
  // `eval`.
  testSuite.addTest("`parse`: Invalid Expressions", function (test) {
    Spec.forEach(["1 + 1", "1 * 2", "var value = 123;", "{});value = 123;({}", "call()", "1, 2, 3, \"value\""], function (expression) {
      test.parseError(expression, "Source string containing a JavaScript expression");
    });
    this.done(6);
  });

  testSuite.addTest("`stringify` and `parse`: Optional Arguments", function () {
    this.parses({"a": 1, "b": 16}, '{"a": 1, "b": "10000"}', "Callback function provided", function (key, value) {
      return typeof value == "string" ? parseInt(value, 2) : value;
    });
    this.serializes("{\n  \"bar\": 456\n}", {"foo": 123, "bar": 456}, "Object; optional `filter` and `whitespace` arguments", ["bar"], 2);
    // Test adapted from the Opera Kamino test suite via Ken Snyder.
    // See http://testsuites.opera.com/Kamino/correctness/scripts/045.js
    this.serializes('{"PI":3.141592653589793}', Math, "List of non-enumerable property names specified as the `filter` argument", ["PI"]);
    this.equal(3, Kamino.parse("[1, 2, 3]", function (key, value) {
      if (typeof value == "object" && value) {
        return value;
      }
    }).length, "Issue #10: `walk` should not use `splice` when removing an array element");
    this.done(4);
  });

  testSuite.addTest("`stringify`", function () {
    var expected = 32, value, pattern;

    // Special values.
    this.serializes("null", null, "`null` is represented literally");
    this.serializes(undefined, undefined, "`undefined` is represented literally");
    this.serializes("Infinity", 1 / 0, "`Infinity` is serialized as `Infinity`");
    this.serializes("NaN", 0 / 0, "`NaN` is serialized as `NaN`");
    this.serializes("NInfinity", -1 / 0, "`-Infinity` is serialized as `NInfinity`");
    this.serializes("true", true, "Boolean primitives are represented literally");
    this.serializes("false", new Boolean(false), "Boolean objects are represented literally");
    this.serializes('"\\\\\\"How\\bquickly\\tdaft\\njumping\\fzebras\\rvex\\""', new String('\\"How\bquickly\tdaft\njumping\fzebras\rvex"'), "All control characters in strings are escaped");

    this.serializes("[false,1,\"Kit\"]", [new Boolean, new Number(1), new String("Kit")], "Arrays are serialized recursively");
    this.serializes("[null]", [void 0], "`[undefined]` is serialized as `[null]`");

    // Property enumeration is implementation-dependent.
    value = {
      "jdalton": ["John-David", 29],
      "kitcambridge": ["Kit", 18],
      "mathias": ["Mathias", 23]
    };
    this.parses(value, Kamino.stringify(value), "Objects are serialized recursively");

    // Complex cyclic structures.
    value = { "foo": { "b": { "foo": { "c": { "foo": null} } } } };
    this.serializes('{"foo":{"b":{"foo":{"c":{"foo":null}}}}}', value, "Nested objects containing identically-named properties should serialize correctly");

    // Sparse arrays.
    value = [];
    value[5] = 1;
    this.serializes("[null,null,null,null,null,1]", value, "Sparse arrays should serialize correctly");

    // Dates.
    this.serializes('%"1994-07-03T00:00:00.000Z"', new Date(Date.UTC(1994, 6, 3)), "Dates should be serialized according to the simplified date time string format");
    this.serializes('%"1993-06-02T02:10:28.224Z"', new Date(Date.UTC(1993, 5, 2, 2, 10, 28, 224)), "The date time string should conform to the format outlined in the spec");
    this.serializes('%"-271821-04-20T00:00:00.000Z"', new Date(-8.64e15), "The minimum valid date value should serialize correctly");
    this.serializes('%"+275760-09-13T00:00:00.000Z"', new Date(8.64e15), "The maximum valid date value should serialize correctly");
    this.serializes('%"+010000-01-01T00:00:00.000Z"', new Date(Date.UTC(10000, 0, 1)), "https://bugs.ecmascript.org/show_bug.cgi?id=119");

    // Tests based on research by @Yaffle. See kriskowal/es5-shim#111.
    this.serializes('%"1969-12-31T23:59:59.999Z"', new Date(-1), "Millisecond values < 1000 should be serialized correctly");
    this.serializes('%"-000001-01-01T00:00:00.000Z"', new Date(-621987552e5), "Years prior to 0 should be serialized as extended years");
    this.serializes('%"+010000-01-01T00:00:00.000Z"', new Date(2534023008e5), "Years after 9999 should be serialized as extended years");
    this.serializes('%"-109252-01-01T10:37:06.708Z"', new Date(-3509827334573292), "Issue #4: Opera > 9.64 should correctly serialize a date with a year of `-109252`");

    // Opera 7 normalizes dates with invalid time values to represent the
    // current date.
    value = new Date("Kit");
    if (!isFinite(value)) {
      expected += 1;
      this.serializes("null", value, "Invalid dates should serialize as `null`");
    }

    // Regular Expressions.
    this.serializes('^"w+"""', new RegExp("\w+"), "Regular expressions with no modifiers");
    this.serializes('^"w+""i"', new RegExp("\w+", "i"), "Regular expressions with no modifiers");
    this.serializes('^"w+""g"', new RegExp("\w+", "g"), "Regular expressions with no modifiers");
    this.serializes('^"w+""m"', new RegExp("\w+", "m"), "Regular expressions with no modifiers");

    // Additional arguments.
    this.serializes("[\n  1,\n  2,\n  3,\n  [\n    4,\n    5\n  ]\n]", [1, 2, 3, [4, 5]], "Nested arrays; optional `whitespace` argument", null, "  ");
    this.serializes("[]", [], "Empty array; optional string `whitespace` argument", null, "  ");
    this.serializes("{}", {}, "Empty object; optional numeric `whitespace` argument", null, 2);
    this.serializes("[\n  1\n]", [1], "Single-element array; optional numeric `whitespace` argument", null, 2);
    this.serializes("{\n  \"foo\": 123\n}", { "foo": 123 }, "Single-member object; optional string `whitespace` argument", null, "  ");
    this.serializes("{\n  \"foo\": {\n    \"bar\": [\n      123\n    ]\n  }\n}", {"foo": {"bar": [123]}}, "Nested objects; optional numeric `whitespace` argument", null, 2);

    this.done(expected);
  });

  testSuite.addTest("`stringify`: object references", function () {
    var user = {name: "John"},
        comment = {author: user},
        article = {users: [user], comment: comment},
        message = {article: article};

    this.serializes("{\"article\":{\"users\":[{\"name\":\"John\"}],\"comment\":{\"author\":&3}}}", message, "An object with references can be serialized");

    message.article.comment.article = message.article;
    this.serializes("{\"article\":{\"users\":[{\"name\":\"John\"}],\"comment\":{\"author\":&3,\"article\":&1}}}", message, "An object with circular references can be serialized");

    this.done(2);
  });

  testSuite.addTest("`stringify`: Invalid Expressions", function (test) {
    var myFn = new Function(), myError = new Error(), myElement = window.document.createElement();

    Spec.forEach([myFn, myError, myElement], function(expression) {
      test.serializeError(expression);
    });

    this.done(3);
  });

  testSuite.addTest("`clone`", function() {
    var person = {
      firstName: "Cyril",
      lastName: "Fluck"
    };

    var blog = {
      administrator: person,
      author: person
    };

    this.strictEqual(blog.administrator, blog.author, "Object references are equal"); // true

    var kaminoClone = Kamino.clone(blog);
    this.strictEqual(kaminoClone.administrator, kaminoClone.author, "Object references are preserved when an object is cloned");

    blog.administrator.firstName = "John";
    blog.administrator.lastName = "Doe";

    this.notStrictEqual(kaminoClone.administrator, blog.administrator, "Objects are cloned");

    this.done(3);
  });

  /*
   * The following tests are adapted from the ECMAScript 5 Conformance Suite.
   * Copyright 2009, Microsoft Corporation. Distributed under the New BSD License.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   *   - Redistributions of source code must retain the above copyright notice,
   *     this list of conditions and the following disclaimer.
   *   - Redistributions in binary form must reproduce the above copyright notice,
   *     this list of conditions and the following disclaimer in the documentation
   *     and/or other materials provided with the distribution.
   *   - Neither the name of Microsoft nor the names of its contributors may be
   *     used to endorse or promote products derived from this software without
   *     specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
  */
  testSuite.addTest("ECMAScript 5 Conformance", function () {
    var value = { "a1": { "b1": [1, 2, 3, 4], "b2": { "c1": 1, "c2": 2 } }, "a2": "a2" };

    // Section 15.12.1.1: The Kamino Grammar.
    // ------------------------------------

    // Tests 15.12.1.1-0-1 thru 15.12.1.1-0-8.
    this.parseError("12\t\r\n 34", "Valid whitespace characters may not separate two discrete tokens");
    this.parseError("\u000b1234", "The vertical tab is not a valid whitespace character");
    this.parseError("\u000c1234", "The form feed is not a valid whitespace character");
    this.parseError("\u00a01234", "The non-breaking space is not a valid whitespace character");
    this.parseError("\u200b1234", "The zero-width space is not a valid whitespace character");
    this.parseError("\ufeff1234", "The byte order mark (zero-width non-breaking space) is not a valid whitespace character");
    this.parseError("\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u30001234", "Other Unicode category `Z` characters are not valid whitespace characters");
    this.parseError("\u2028\u20291234", "The line (U+2028) and paragraph (U+2029) separators are not valid whitespace characters");

    // Test 15.12.1.1-0-9.
    this.parses({ "property": {}, "prop2": [true, null, 123.456] },
      '\t\r \n{\t\r \n' +
      '"property"\t\r \n:\t\r \n{\t\r \n}\t\r \n,\t\r \n' +
      '"prop2"\t\r \n:\t\r \n' +
        '[\t\r \ntrue\t\r \n,\t\r \nnull\t\r \n,123.456\t\r \n]' +
      '\t\r \n}\t\r \n',
    "Valid whitespace characters may precede and follow all tokens");

    // Tests 15.12.1.1-g1-1 thru 15.12.1.1-g1-4.
    this.parses(1234, "\t1234", "Leading tab characters should be ignored");
    this.parseError("12\t34", "A tab character may not separate two disparate tokens");
    this.parses(1234, "\r1234", "Leading carriage returns should be ignored");
    this.parseError("12\r34", "A carriage return may not separate two disparate tokens");
    this.parses(1234, "\n1234", "Leading line feeds should be ignored");
    this.parseError("12\n34", "A line feed may not separate two disparate tokens");
    this.parses(1234, " 1234", "Leading space characters should be ignored");
    this.parseError("12 34", "A space character may not separate two disparate tokens");

    // Tests 15.12.1.1-g2-1 thru 15.12.1.1-g2-5.
    this.parses("abc", '"abc"', "Strings must be enclosed in double quotes");
    this.parseError("'abc'", "Single-quoted strings are not permitted");
    // Note: the original test 15.12.1.1-g2-3 (`"\u0022abc\u0022"`) is incorrect,
    // as the JavaScript interpreter will always convert `\u0022` to `"`.
    this.parseError("\\u0022abc\\u0022", "Unicode-escaped double quote delimiters are not permitted");
    this.parseError('"ab'+"c'", "Strings must terminate with a double quote character");
    this.parses("", '""', "Strings may be empty");

    // Tests 15.12.1.1-g4-1 thru 15.12.1.1-g4-4.
    this.parseError('"\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007"', "Unescaped control characters in the range [U+0000, U+0007] are not permitted within strings");
    this.parseError('"\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f"', "Unescaped control characters in the range [U+0008, U+000F] are not permitted within strings");
    this.parseError('"\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017"', "Unescaped control characters in the range [U+0010, U+0017] are not permitted within strings");
    this.parseError('"\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f"', "Unescaped control characters in the range [U+0018, U+001F] are not permitted within strings");

    // Tests 15.12.1.1-g5-1 thru 15.12.1.1-g5-3.
    this.parses("X", '"\\u0058"', "Unicode escape sequences are permitted within strings");
    this.parseError('"\\u005"', "Unicode escape sequences may not comprise fewer than four hexdigits");
    this.parseError('"\\u0X50"', "Unicode escape sequences may not contain non-hex characters");

    // Tests 15.12.1.1-g6-1 thru 15.12.1.1-g6-7.
    this.parses("/", '"\\/"', "Escaped solidus");
    this.parses("\\", '"\\\\"', "Escaped reverse solidus");
    this.parses("\b", '"\\b"', "Escaped backspace");
    this.parses("\f", '"\\f"', "Escaped form feed");
    this.parses("\n", '"\\n"', "Escaped line feed");
    this.parses("\r", '"\\r"', "Escaped carriage return");
    this.parses("\t", '"\\t"', "Escaped tab");

    // Section 15.12.3: `Kamino.stringify()`.
    // ------------------------------------

    // Test 15.12.3-11-1 thru 5.12.3-11-15.
    this.serializes(void 0, void 0, "`Kamino.stringify(undefined)` should return `undefined`");
    this.serializes('"replacement"', void 0, "The `Kamino.stringify` callback function can be called on a top-level `undefined` value", function (key, value) {
      return "replacement";
    });
    this.serializes('"a string"', "a string", "`Kamino.stringify` should serialize top-level string primitives");
    this.serializes("123", 123, "`Kamino.stringify` should serialize top-level number primitives");
    this.serializes("true", true, "`Kamino.stringify` should serialize top-level Boolean primitives");
    this.serializes("null", null, "`Kamino.stringify` should serialize top-level `null` values");
    this.serializes("42", new Number(42), "`Kamino.stringify` should serialize top-level number objects");
    this.serializes('"wrapped"', new String("wrapped"), "`Kamino.stringify` should serialize top-level string objects");
    this.serializes("false", new Boolean(false), "`Kamino.stringify` should serialize top-level Boolean objects");
    this.serializes(void 0, 42, "The `Kamino.stringify` callback function may return `undefined` when called on a top-level number primitive", function () {
      return void 0;
    });
    this.serializes(void 0, { "prop": 1 }, "The `Kamino.stringify` callback function may return `undefined` when called on a top-level object", function () {
      return void 0;
    });
    this.serializes("[4,2]", 42, "The `Kamino.stringify` callback function may return an array when called on a top-level number primitive", function (key, value) {
      return value == 42 ? [4, 2] : value;
    });
    this.serializes('{"forty":2}', 42, "The `Kamino.stringify` callback function may return an object literal when called on a top-level number primitive", function (key, value) {
      return value == 42 ? { "forty": 2 } : value;
    });

    // Test 15.12.3-4-1.
    this.serializes("[42]", [42], "`Kamino.stringify` should ignore `filter` arguments that are not functions or arrays", {});

    // Test 15.12.3-5-a-i-1 and 15.12.3-5-b-i-1.
    this.equal(Kamino.stringify(value, null, new Number(5)), Kamino.stringify(value, null, 5), "Optional `width` argument: Number object and primitive width values should produce identical results");
    this.equal(Kamino.stringify(value, null, new String("xxx")), Kamino.stringify(value, null, "xxx"), "Optional `width` argument: String object and primitive width values should produce identical results");

    // Test 15.12.3-6-a-1 and 15.12.3-6-a-2.
    this.equal(Kamino.stringify(value, null, 10), Kamino.stringify(value, null, 100), "Optional `width` argument: The maximum numeric width value should be 10");
    this.equal(Kamino.stringify(value, null, 5.99999), Kamino.stringify(value, null, 5), "Optional `width` argument: Numeric values should be converted to integers");

    // Test 15.12.3-6-b-1 and 15.12.3-6-b-4.
    this.equal(Kamino.stringify(value, null, 0.999999), Kamino.stringify(value), "Optional `width` argument: Numeric width values between 0 and 1 should be ignored");
    this.equal(Kamino.stringify(value, null, 0), Kamino.stringify(value), "Optional `width` argument: Zero should be ignored");
    this.equal(Kamino.stringify(value, null, -5), Kamino.stringify(value), "Optional `width` argument: Negative numeric values should be ignored");
    this.equal(Kamino.stringify(value, null, 5), Kamino.stringify(value, null, "     "), "Optional `width` argument: Numeric width values in the range [1, 10] should produce identical results to that of string values containing `width` spaces");

    // Test 15.12.3-7-a-1.
    this.equal(Kamino.stringify(value, null, "0123456789xxxxxxxxx"), Kamino.stringify(value, null, "0123456789"), "Optional `width` argument: String width values longer than 10 characters should be truncated");

    // Test 15.12.3-8-a-1 thru 15.12.3-8-a-5.
    this.equal(Kamino.stringify(value, null, ""), Kamino.stringify(value), "Empty string `width` arguments should be ignored");
    this.equal(Kamino.stringify(value, null, true), Kamino.stringify(value), "Boolean primitive `width` arguments should be ignored");
    this.equal(Kamino.stringify(value, null, null), Kamino.stringify(value), "`null` `width` arguments should be ignored");
    this.equal(Kamino.stringify(value, null, new Boolean(false)), Kamino.stringify(value), "Boolean object `width` arguments should be ignored");
    this.equal(Kamino.stringify(value, null, value), Kamino.stringify(value), "Object literal `width` arguments should be ignored");

    // Test 15.12.3@2-2-b-i-1.
    this.serializes('["fortytwo objects"]', [{
      "prop": 42,
      "toJSON": function () {
        return "fortytwo objects";
      }
    }], "An object literal with a custom `toJSON` method nested within an array may return a string primitive for serialization");

    // Test 15.12.3@2-2-b-i-2.
    this.serializes('[42]', [{
      "prop": 42,
      "toJSON": function () {
        return new Number(42);
      }
    }], "An object literal with a custom `toJSON` method nested within an array may return a number object for serialization");

    // Test 15.12.3@2-2-b-i-3.
    this.serializes('[true]', [{
      "prop": 42,
      "toJSON": function () {
        return new Boolean(true);
      }
    }], "An object literal with a custom `toJSON` method nested within an array may return a Boolean object for serialization");

    // Test 15.12.3@2-3-a-1.
    this.serializes('["fortytwo"]', [42], "The `Kamino.stringify` callback function may return a string object when called on an array", function (key, value) {
      return value === 42 ? new String("fortytwo") : value;
    });

    // Test 15.12.3@2-3-a-2.
    this.serializes('[84]', [42], "The `Kamino.stringify` callback function may return a number object when called on an array", function (key, value) {
      return value === 42 ? new Number(84) : value;
    });

    // Test 15.12.3@2-3-a-3.
    this.serializes('[false]', [42], "The `Kamino.stringify` callback function may return a Boolean object when called on an array", function (key, value) {
      return value === 42 ? new Boolean(false) : value;
    });

    this.done(70);
  });

  // This test may fail in certain implementations.
  testSuite.addTest("Anticipated ECMAScript 6 Additions", function () {
    var expected = 0, value;
    try {
      value = {};
      // IE 8 only allows properties to be defined on DOM elements. Credits:
      // John-David Dalton and Juriy Zaytsev.
      if (Object.defineProperty(value, value, value), "value" in Object.getOwnPropertyDescriptor(value, value)) {
        expected += 1;
        value = [0, 1, 2, 3];
        Object.prototype[3] = 3;
        Object.defineProperty(value, 1, {
          "get": function () {
            Object.defineProperty(value, 4, { "value": 4 });
            delete value[2];
            delete value[3];
            value[5] = 5;
            return 1;
          }
        });
        // Test by Jeff Walden and Allen Wirfs-Brock.
        this.serializes('{"0":{"1":{"3":{"3":3}},"3":3},"3":3}', { 0: { 1: { 3: { 4: { 5: { 2: "omitted" } } } } } }, "Issue #12: `parse` should process property name arrays sequentially", value);
      }
    } catch (exception) {}
    // Clean up.
    delete Object.prototype[3];
    this.done(expected);
  });

  testSuite.shuffle();

  if (isLoader) {
    define(function () {
      return testSuite;
    });
  } else if (!isBrowser && (!isModule || (typeof module == "object" && module == require.main))) {
    testSuite.run();
  }
})(this);
