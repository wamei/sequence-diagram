/** js sequence diagrams 2.0.1
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  @license Simplified BSD license.
 */
(function() {
'use strict';
/*global Diagram */

// The following are included by preprocessor */
/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
/*global grammar _ */

function Diagram() {
  this.title   = undefined;
  this.actors  = [];
  this.signals = [];
}
/*
 * Return an existing actor with this alias, or creates a new one with alias and name.
 */
Diagram.prototype.getActor = function(alias, name, lineno) {
  alias = alias.trim();

  var start = 0;
  if (alias.indexOf('*') == 0) {
    alias = alias.slice(1);
    start = this.signals.length;
  }

  var i;
  var actors = this.actors;
  for (i in actors) {
    if (actors[i].alias == alias) {
      if (start > 0 && actors[i].start == 0) {
        actors[i].start = start;
        this.signals.push(actors[i]);
      }
      return actors[i];
    }
  }
  i = actors.push(new Diagram.Actor(alias, (name || alias), actors.length, start, lineno));
  if (start > 0) {
    this.signals.push(actors[i-1]);
  }
  return actors[ i - 1 ];
};

/*
 * Parses the input as either a alias, or a "name as alias", and returns the corresponding actor.
 */
Diagram.prototype.getActorWithAlias = function(input, lineno) {
  input = input.trim();

  // We are lazy and do some of the parsing in javascript :(. TODO move into the .jison file.
  var s = /([\s\S]+) as (\S+)$/im.exec(input);
  var alias;
  var name;
  if (s) {
    name  = s[1].trim();
    alias = s[2].trim();
  } else {
    name = alias = input;
  }
  return this.getActor(alias, name, lineno);
};

Diagram.prototype.setTitle = function(title, lineno) {
  this.title = {
    message: title,
    lineno: lineno
  };
};

Diagram.prototype.destoryActor = function(actor, lineno) {
  actor.end = this.signals.length;
};

Diagram.prototype.addSignal = function(signal) {
  signal.index = this.signals.length;
  this.signals.push(signal);
};

Diagram.Actor = function(alias, name, index, start, lineno) {
  this.type  = 'Actor';
  this.alias = alias;
  this.name  = name;
  this.index = index;
  this.start = start;
  this.end   = 0;
  this.message  = name;
  this.executionStack = [];
  this.executions = [];
  this.maxExecutionsLevel = -1;
  this.lineno = lineno;
};

Diagram.Signal = function(actorA, signaltype, actorB, message, executionLevelChangeA, executionLevelChangeB, lineno) {
  this.type       = 'Signal';
  this.actorA     = actorA;
  this.actorB     = actorB;
  this.linetype   = signaltype & 3;
  this.arrowtype  = (signaltype >> 2) & 3;
  this.leftarrowtype  = (signaltype >> 4) & 3;
  this.message    = message;
  this.index      = null;
  this.lineno     = lineno;
  // If this is a self-signal and an Execution level modifier was only applied to the
  // left-hand side of the signal, move it to the right-hand side to prevent rendering issues.
  if (actorA === actorB && executionLevelChangeB === Diagram.EXECUTION_CHANGE.NONE) {
    executionLevelChangeB = executionLevelChangeA;
    executionLevelChangeA = Diagram.EXECUTION_CHANGE.NONE;
  }

  if (actorA === actorB && executionLevelChangeA === executionLevelChangeB &&
      executionLevelChangeA !== Diagram.EXECUTION_CHANGE.NONE) {
    throw new Error("You cannot move the Execution nesting level in the same " +
                    "direction twice on a single self-signal.");
  }
  try {
    this.actorA.changeExecutionLevel(executionLevelChangeA, this);
    this.startLevel = this.actorA.executionStack.length - 1;
    this.actorB.changeExecutionLevel(executionLevelChangeB, this);
    this.endLevel   = this.actorB.executionStack.length - 1;
  } catch(error) {
    error.line = this.lineno;
    throw error;
  }
};

Diagram.Signal.prototype.isSelf = function() {
  return this.actorA.index == this.actorB.index;
};

/*
 * If the signal is a self signal, this method returns the higher Execution nesting level
 * between the start and end of the signal.
 */
Diagram.Signal.prototype.maxExecutionLevel = function () {
  if (!this.isSelf()) {
    throw new Error("maxExecutionLevel() was called on a non-self signal.");
  }
  return Math.max(this.startLevel, this.endLevel);
};

Diagram.Execution = function(actor, startSignal, level) {
  this.actor = actor;
  this.startSignal = startSignal;
  this.endSignal = null;
  this.level = level;
};

Diagram.Actor.prototype.changeExecutionLevel = function(change, signal) {
  switch (change) {
  case Diagram.EXECUTION_CHANGE.NONE:
    break;
  case Diagram.EXECUTION_CHANGE.INCREASE:
    var newLevel = this.executionStack.length;
    this.maxExecutionsLevel =
      Math.max(this.maxExecutionsLevel, newLevel);
    var execution = new Diagram.Execution(this, signal, newLevel);
    this.executionStack.push(execution);
    this.executions.push(execution);
    break;
  case Diagram.EXECUTION_CHANGE.DECREASE:
    if (this.executionStack.length > 0) {
      this.executionStack.pop().setEndSignal(signal);
    } else {
      var error = new Error("The execution level for actor " + this.name + " was dropped below 0.");
      error.line = this.lineno;
      throw error;
    }
    break;
  }
};

Diagram.Execution.prototype.setEndSignal = function (signal) {
  this.endSignal = signal;
};

Diagram.Note = function(actor, placement, message, lineno) {
  this.type      = 'Note';
  this.actor     = actor;
  this.placement = placement;
  this.message   = message;
  this.lineno    = lineno;

  if (this.hasManyActors() && actor[0] == actor[1]) {
    throw new Error('Note should be over two different actors');
  }
};

Diagram.Note.prototype.hasManyActors = function() {
  return _.isArray(this.actor);
};

Diagram.unescape = function(s) {
  // Turn "\\n" into "\n"
  return s.trim().replace(/^"(.*)"$/m, '$1').replace(/\\n/gm, '\n');
};

Diagram.LINETYPE = {
  SOLID: 0,
  DOTTED: 1
};

Diagram.ARROWTYPE = {
  FILLED: 0,
  OPEN: 1
};

Diagram.LEFTARROWTYPE = {
  NONE: 0,
  FILLED: 1,
  OPEN: 2
};

Diagram.PLACEMENT = {
  LEFTOF: 0,
  RIGHTOF: 1,
  OVER: 2
};

Diagram.EXECUTION_CHANGE = {
  NONE     : 0,
  INCREASE : 1,
  DECREASE : 2
};

// Some older browsers don't have getPrototypeOf, thus we polyfill it
// https://github.com/bramp/js-sequence-diagrams/issues/57
// https://github.com/zaach/jison/issues/194
// Taken from http://ejohn.org/blog/objectgetprototypeof/
if (typeof Object.getPrototypeOf !== 'function') {
  /* jshint -W103 */
  if (typeof 'test'.__proto__ === 'object') {
    Object.getPrototypeOf = function(object) {
      return object.__proto__;
    };
  } else {
    Object.getPrototypeOf = function(object) {
      // May break if the constructor has been tampered with
      return object.constructor.prototype;
    };
  }
  /* jshint +W103 */
}

/** The following is included by preprocessor */
/* parser generated by jison 0.4.15 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = function() {
    function Parser() {
        this.yy = {};
    }
    var o = function(k, v, o, l) {
        for (o = o || {}, l = k.length; l--; o[k[l]] = v) ;
        return o;
    }, $V0 = [ 5, 8, 9, 13, 15, 17, 26, 27, 28 ], $V1 = [ 1, 14 ], $V2 = [ 1, 15 ], $V3 = [ 2, 18 ], $V4 = [ 1, 19 ], $V5 = [ 1, 21 ], $V6 = [ 1, 32 ], $V7 = [ 1, 33 ], $V8 = [ 26, 27, 28 ], $V9 = [ 1, 40 ], $Va = [ 1, 41 ], $Vb = [ 26, 34 ], $Vc = [ 26, 27, 28, 35, 36 ], parser = {
        trace: function() {},
        yy: {},
        symbols_: {
            error: 2,
            start: 3,
            document: 4,
            EOF: 5,
            line: 6,
            statement: 7,
            NL: 8,
            participant: 9,
            actor_alias: 10,
            signal: 11,
            note_statement: 12,
            title: 13,
            message: 14,
            destroy: 15,
            actor: 16,
            note: 17,
            placement: 18,
            over: 19,
            actor_pair: 20,
            ",": 21,
            left_of: 22,
            right_of: 23,
            execution_modifier: 24,
            signaltype: 25,
            LINE: 26,
            PLUS: 27,
            ACTOR: 28,
            leftarrowtype: 29,
            linetype: 30,
            arrowtype: 31,
            LARROW: 32,
            LOPENARROW: 33,
            DOTLINE: 34,
            ARROW: 35,
            OPENARROW: 36,
            MESSAGE: 37,
            $accept: 0,
            $end: 1
        },
        terminals_: {
            2: "error",
            5: "EOF",
            8: "NL",
            9: "participant",
            13: "title",
            15: "destroy",
            17: "note",
            19: "over",
            21: ",",
            22: "left_of",
            23: "right_of",
            26: "LINE",
            27: "PLUS",
            28: "ACTOR",
            32: "LARROW",
            33: "LOPENARROW",
            34: "DOTLINE",
            35: "ARROW",
            36: "OPENARROW",
            37: "MESSAGE"
        },
        productions_: [ 0, [ 3, 2 ], [ 4, 0 ], [ 4, 2 ], [ 6, 1 ], [ 6, 1 ], [ 7, 2 ], [ 7, 1 ], [ 7, 1 ], [ 7, 2 ], [ 7, 2 ], [ 12, 4 ], [ 12, 4 ], [ 20, 1 ], [ 20, 3 ], [ 18, 1 ], [ 18, 1 ], [ 11, 6 ], [ 24, 0 ], [ 24, 1 ], [ 24, 1 ], [ 16, 1 ], [ 10, 1 ], [ 25, 3 ], [ 25, 2 ], [ 25, 1 ], [ 29, 1 ], [ 29, 1 ], [ 30, 1 ], [ 30, 1 ], [ 31, 1 ], [ 31, 1 ], [ 14, 1 ] ],
        performAction: function(yytext, yyleng, yylineno, yy, yystate, $$, _$) {
            /* this == yyval */
            var $0 = $$.length - 1;
            switch (yystate) {
              case 1:
                return yy.parser.yy;

              case 4:
                break;

              case 6:
                $$[$0];
                break;

              case 7:
              case 8:
                yy.parser.yy.addSignal($$[$0]);
                break;

              case 9:
                yy.parser.yy.setTitle($$[$0], yylineno);
                break;

              case 10:
                yy.parser.yy.destoryActor($$[$0], yylineno);
                break;

              case 11:
                this.$ = new Diagram.Note($$[$0 - 1], $$[$0 - 2], $$[$0], yylineno);
                break;

              case 12:
                this.$ = new Diagram.Note($$[$0 - 1], Diagram.PLACEMENT.OVER, $$[$0], yylineno);
                break;

              case 13:
              case 25:
                this.$ = $$[$0];
                break;

              case 14:
                this.$ = [ $$[$0 - 2], $$[$0] ];
                break;

              case 15:
                this.$ = Diagram.PLACEMENT.LEFTOF;
                break;

              case 16:
                this.$ = Diagram.PLACEMENT.RIGHTOF;
                break;

              case 17:
                this.$ = new Diagram.Signal($$[$0 - 4], $$[$0 - 3], $$[$0 - 1], $$[$0], $$[$0 - 5], $$[$0 - 2], yylineno);
                break;

              case 18:
                this.$ = Diagram.EXECUTION_CHANGE.NONE;
                break;

              case 19:
                this.$ = Diagram.EXECUTION_CHANGE.DECREASE;
                break;

              case 20:
                this.$ = Diagram.EXECUTION_CHANGE.INCREASE;
                break;

              case 21:
                this.$ = yy.parser.yy.getActor(Diagram.unescape($$[$0]));
                break;

              case 22:
                this.$ = yy.parser.yy.getActorWithAlias(Diagram.unescape($$[$0]), yylineno);
                break;

              case 23:
                this.$ = $$[$0 - 1] | $$[$0] << 2 | $$[$0 - 2] << 4;
                break;

              case 24:
                this.$ = $$[$0 - 1] | $$[$0] << 2;
                break;

              case 26:
                this.$ = Diagram.LEFTARROWTYPE.FILLED;
                break;

              case 27:
                this.$ = Diagram.LEFTARROWTYPE.OPEN;
                break;

              case 28:
                this.$ = Diagram.LINETYPE.SOLID;
                break;

              case 29:
                this.$ = Diagram.LINETYPE.DOTTED;
                break;

              case 30:
                this.$ = Diagram.ARROWTYPE.FILLED;
                break;

              case 31:
                this.$ = Diagram.ARROWTYPE.OPEN;
                break;

              case 32:
                this.$ = Diagram.unescape($$[$0].substring(1));
            }
        },
        table: [ o($V0, [ 2, 2 ], {
            3: 1,
            4: 2
        }), {
            1: [ 3 ]
        }, {
            5: [ 1, 3 ],
            6: 4,
            7: 5,
            8: [ 1, 6 ],
            9: [ 1, 7 ],
            11: 8,
            12: 9,
            13: [ 1, 10 ],
            15: [ 1, 11 ],
            17: [ 1, 13 ],
            24: 12,
            26: $V1,
            27: $V2,
            28: $V3
        }, {
            1: [ 2, 1 ]
        }, o($V0, [ 2, 3 ]), o($V0, [ 2, 4 ]), o($V0, [ 2, 5 ]), {
            10: 16,
            28: [ 1, 17 ]
        }, o($V0, [ 2, 7 ]), o($V0, [ 2, 8 ]), {
            14: 18,
            37: $V4
        }, {
            16: 20,
            28: $V5
        }, {
            16: 22,
            28: $V5
        }, {
            18: 23,
            19: [ 1, 24 ],
            22: [ 1, 25 ],
            23: [ 1, 26 ]
        }, {
            28: [ 2, 19 ]
        }, {
            28: [ 2, 20 ]
        }, o($V0, [ 2, 6 ]), o($V0, [ 2, 22 ]), o($V0, [ 2, 9 ]), o($V0, [ 2, 32 ]), o($V0, [ 2, 10 ]), o([ 5, 8, 9, 13, 15, 17, 21, 26, 27, 28, 32, 33, 34, 37 ], [ 2, 21 ]), {
            25: 27,
            26: $V6,
            29: 28,
            30: 29,
            32: [ 1, 30 ],
            33: [ 1, 31 ],
            34: $V7
        }, {
            16: 34,
            28: $V5
        }, {
            16: 36,
            20: 35,
            28: $V5
        }, {
            28: [ 2, 15 ]
        }, {
            28: [ 2, 16 ]
        }, {
            24: 37,
            26: $V1,
            27: $V2,
            28: $V3
        }, {
            26: $V6,
            30: 38,
            34: $V7
        }, o($V8, [ 2, 25 ], {
            31: 39,
            35: $V9,
            36: $Va
        }), o($Vb, [ 2, 26 ]), o($Vb, [ 2, 27 ]), o($Vc, [ 2, 28 ]), o($Vc, [ 2, 29 ]), {
            14: 42,
            37: $V4
        }, {
            14: 43,
            37: $V4
        }, {
            21: [ 1, 44 ],
            37: [ 2, 13 ]
        }, {
            16: 45,
            28: $V5
        }, {
            31: 46,
            35: $V9,
            36: $Va
        }, o($V8, [ 2, 24 ]), o($V8, [ 2, 30 ]), o($V8, [ 2, 31 ]), o($V0, [ 2, 11 ]), o($V0, [ 2, 12 ]), {
            16: 47,
            28: $V5
        }, {
            14: 48,
            37: $V4
        }, o($V8, [ 2, 23 ]), {
            37: [ 2, 14 ]
        }, o($V0, [ 2, 17 ]) ],
        defaultActions: {
            3: [ 2, 1 ],
            14: [ 2, 19 ],
            15: [ 2, 20 ],
            25: [ 2, 15 ],
            26: [ 2, 16 ],
            47: [ 2, 14 ]
        },
        parseError: function(str, hash) {
            if (!hash.recoverable) throw new Error(str);
            this.trace(str);
        },
        parse: function(input) {
            function lex() {
                var token;
                return token = lexer.lex() || EOF, "number" != typeof token && (token = self.symbols_[token] || token), 
                token;
            }
            var self = this, stack = [ 0 ], vstack = [ null ], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, EOF = 1, args = lstack.slice.call(arguments, 1), lexer = Object.create(this.lexer), sharedState = {
                yy: {}
            };
            for (var k in this.yy) Object.prototype.hasOwnProperty.call(this.yy, k) && (sharedState.yy[k] = this.yy[k]);
            lexer.setInput(input, sharedState.yy), sharedState.yy.lexer = lexer, sharedState.yy.parser = this, 
            void 0 === lexer.yylloc && (lexer.yylloc = {});
            var yyloc = lexer.yylloc;
            lstack.push(yyloc);
            var ranges = lexer.options && lexer.options.ranges;
            "function" == typeof sharedState.yy.parseError ? this.parseError = sharedState.yy.parseError : this.parseError = Object.getPrototypeOf(this).parseError;
            for (var symbol, preErrorSymbol, state, action, r, p, len, newState, expected, yyval = {}; ;) {
                if (state = stack[stack.length - 1], this.defaultActions[state] ? action = this.defaultActions[state] : (null !== symbol && void 0 !== symbol || (symbol = lex()), 
                action = table[state] && table[state][symbol]), void 0 === action || !action.length || !action[0]) {
                    var errStr = "";
                    expected = [];
                    for (p in table[state]) this.terminals_[p] && p > 2 && expected.push("'" + this.terminals_[p] + "'");
                    errStr = lexer.showPosition ? "Parse error on line " + (yylineno + 1) + ":\n" + lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'" : "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == EOF ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'"), 
                    this.parseError(errStr, {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected
                    });
                }
                if (action[0] instanceof Array && action.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
                switch (action[0]) {
                  case 1:
                    stack.push(symbol), vstack.push(lexer.yytext), lstack.push(lexer.yylloc), stack.push(action[1]), 
                    symbol = null, preErrorSymbol ? (symbol = preErrorSymbol, preErrorSymbol = null) : (yyleng = lexer.yyleng, 
                    yytext = lexer.yytext, yylineno = lexer.yylineno, yyloc = lexer.yylloc, recovering > 0 && recovering--);
                    break;

                  case 2:
                    if (len = this.productions_[action[1]][1], yyval.$ = vstack[vstack.length - len], 
                    yyval._$ = {
                        first_line: lstack[lstack.length - (len || 1)].first_line,
                        last_line: lstack[lstack.length - 1].last_line,
                        first_column: lstack[lstack.length - (len || 1)].first_column,
                        last_column: lstack[lstack.length - 1].last_column
                    }, ranges && (yyval._$.range = [ lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1] ]), 
                    void 0 !== (r = this.performAction.apply(yyval, [ yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack ].concat(args)))) return r;
                    len && (stack = stack.slice(0, -1 * len * 2), vstack = vstack.slice(0, -1 * len), 
                    lstack = lstack.slice(0, -1 * len)), stack.push(this.productions_[action[1]][0]), 
                    vstack.push(yyval.$), lstack.push(yyval._$), newState = table[stack[stack.length - 2]][stack[stack.length - 1]], 
                    stack.push(newState);
                    break;

                  case 3:
                    return !0;
                }
            }
            return !0;
        }
    }, lexer = function() {
        return {
            EOF: 1,
            parseError: function(str, hash) {
                if (!this.yy.parser) throw new Error(str);
                this.yy.parser.parseError(str, hash);
            },
            // resets the lexer, sets new input
            setInput: function(input, yy) {
                return this.yy = yy || this.yy || {}, this._input = input, this._more = this._backtrack = this.done = !1, 
                this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = [ "INITIAL" ], 
                this.yylloc = {
                    first_line: 1,
                    first_column: 0,
                    last_line: 1,
                    last_column: 0
                }, this.options.ranges && (this.yylloc.range = [ 0, 0 ]), this.offset = 0, this;
            },
            // consumes and returns one char from the input
            input: function() {
                var ch = this._input[0];
                return this.yytext += ch, this.yyleng++, this.offset++, this.match += ch, this.matched += ch, 
                ch.match(/(?:\r\n?|\n).*/g) ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, 
                this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), 
                ch;
            },
            // unshifts one char (or a string) into the input
            unput: function(ch) {
                var len = ch.length, lines = ch.split(/(?:\r\n?|\n)/g);
                this._input = ch + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - len), 
                //this.yyleng -= len;
                this.offset -= len;
                var oldLines = this.match.split(/(?:\r\n?|\n)/g);
                this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), 
                lines.length - 1 && (this.yylineno -= lines.length - 1);
                var r = this.yylloc.range;
                return this.yylloc = {
                    first_line: this.yylloc.first_line,
                    last_line: this.yylineno + 1,
                    first_column: this.yylloc.first_column,
                    last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
                }, this.options.ranges && (this.yylloc.range = [ r[0], r[0] + this.yyleng - len ]), 
                this.yyleng = this.yytext.length, this;
            },
            // When called from action, caches matched text and appends it on next action
            more: function() {
                return this._more = !0, this;
            },
            // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
            reject: function() {
                return this.options.backtrack_lexer ? (this._backtrack = !0, this) : this.parseError("Lexical error on line " + (this.yylineno + 1) + ". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n" + this.showPosition(), {
                    text: "",
                    token: null,
                    line: this.yylineno
                });
            },
            // retain first n characters of the match
            less: function(n) {
                this.unput(this.match.slice(n));
            },
            // displays already matched input, i.e. for error messages
            pastInput: function() {
                var past = this.matched.substr(0, this.matched.length - this.match.length);
                return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
            },
            // displays upcoming input, i.e. for error messages
            upcomingInput: function() {
                var next = this.match;
                return next.length < 20 && (next += this._input.substr(0, 20 - next.length)), (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
            },
            // displays the character position where the lexing error occurred, i.e. for error messages
            showPosition: function() {
                var pre = this.pastInput(), c = new Array(pre.length + 1).join("-");
                return pre + this.upcomingInput() + "\n" + c + "^";
            },
            // test the lexed token: return FALSE when not a match, otherwise return token
            test_match: function(match, indexed_rule) {
                var token, lines, backup;
                if (this.options.backtrack_lexer && (// save context
                backup = {
                    yylineno: this.yylineno,
                    yylloc: {
                        first_line: this.yylloc.first_line,
                        last_line: this.last_line,
                        first_column: this.yylloc.first_column,
                        last_column: this.yylloc.last_column
                    },
                    yytext: this.yytext,
                    match: this.match,
                    matches: this.matches,
                    matched: this.matched,
                    yyleng: this.yyleng,
                    offset: this.offset,
                    _more: this._more,
                    _input: this._input,
                    yy: this.yy,
                    conditionStack: this.conditionStack.slice(0),
                    done: this.done
                }, this.options.ranges && (backup.yylloc.range = this.yylloc.range.slice(0))), lines = match[0].match(/(?:\r\n?|\n).*/g), 
                lines && (this.yylineno += lines.length), this.yylloc = {
                    first_line: this.yylloc.last_line,
                    last_line: this.yylineno + 1,
                    first_column: this.yylloc.last_column,
                    last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length
                }, this.yytext += match[0], this.match += match[0], this.matches = match, this.yyleng = this.yytext.length, 
                this.options.ranges && (this.yylloc.range = [ this.offset, this.offset += this.yyleng ]), 
                this._more = !1, this._backtrack = !1, this._input = this._input.slice(match[0].length), 
                this.matched += match[0], token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]), 
                this.done && this._input && (this.done = !1), token) return token;
                if (this._backtrack) {
                    // recover context
                    for (var k in backup) this[k] = backup[k];
                    return !1;
                }
                return !1;
            },
            // return next match in input
            next: function() {
                if (this.done) return this.EOF;
                this._input || (this.done = !0);
                var token, match, tempMatch, index;
                this._more || (this.yytext = "", this.match = "");
                for (var rules = this._currentRules(), i = 0; i < rules.length; i++) if ((tempMatch = this._input.match(this.rules[rules[i]])) && (!match || tempMatch[0].length > match[0].length)) {
                    if (match = tempMatch, index = i, this.options.backtrack_lexer) {
                        if ((token = this.test_match(tempMatch, rules[i])) !== !1) return token;
                        if (this._backtrack) {
                            match = !1;
                            continue;
                        }
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return !1;
                    }
                    if (!this.options.flex) break;
                }
                return match ? (token = this.test_match(match, rules[index])) !== !1 && token : "" === this._input ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {
                    text: "",
                    token: null,
                    line: this.yylineno
                });
            },
            // return next match that has a token
            lex: function() {
                var r = this.next();
                return r ? r : this.lex();
            },
            // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
            begin: function(condition) {
                this.conditionStack.push(condition);
            },
            // pop the previously active lexer condition state off the condition stack
            popState: function() {
                return this.conditionStack.length - 1 > 0 ? this.conditionStack.pop() : this.conditionStack[0];
            },
            // produce the lexer rule set which is active for the currently active lexer condition state
            _currentRules: function() {
                return this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1] ? this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules : this.conditions.INITIAL.rules;
            },
            // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
            topState: function(n) {
                return n = this.conditionStack.length - 1 - Math.abs(n || 0), n >= 0 ? this.conditionStack[n] : "INITIAL";
            },
            // alias for begin(condition)
            pushState: function(condition) {
                this.begin(condition);
            },
            // return the number of states currently on the stack
            stateStackSize: function() {
                return this.conditionStack.length;
            },
            options: {
                "case-insensitive": !0
            },
            performAction: function(yy, yy_, $avoiding_name_collisions, YY_START) {
                switch ($avoiding_name_collisions) {
                  case 0:
                    return 8;

                  case 1:
                    /* skip whitespace */
                    break;

                  case 2:
                    /* skip comments */
                    break;

                  case 3:
                    return 9;

                  case 4:
                    return 22;

                  case 5:
                    return 23;

                  case 6:
                    return 19;

                  case 7:
                    return 17;

                  case 8:
                    return 13;

                  case 9:
                    return 15;

                  case 10:
                    return 21;

                  case 11:
                    return 28;

                  case 12:
                    return 28;

                  case 13:
                    return 34;

                  case 14:
                    return 26;

                  case 15:
                    return 27;

                  case 16:
                    return 36;

                  case 17:
                    return 35;

                  case 18:
                    return 33;

                  case 19:
                    return 32;

                  case 20:
                    return 37;

                  case 21:
                    return 5;

                  case 22:
                    return "INVALID";
                }
            },
            rules: [ /^(?:[\r\n]+)/i, /^(?:\s+)/i, /^(?:#[^\r\n]*)/i, /^(?:participant\b)/i, /^(?:left of\b)/i, /^(?:right of\b)/i, /^(?:over\b)/i, /^(?:note\b)/i, /^(?:title\b)/i, /^(?:destroy\b)/i, /^(?:,)/i, /^(?:[^\-<>:,\r\n"+]+)/i, /^(?:"[^"]+")/i, /^(?:--)/i, /^(?:-)/i, /^(?:\+)/i, /^(?:>>)/i, /^(?:>)/i, /^(?:<<)/i, /^(?:<)/i, /^(?:[^\r\n]+)/i, /^(?:$)/i, /^(?:.)/i ],
            conditions: {
                INITIAL: {
                    rules: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22 ],
                    inclusive: !0
                }
            }
        };
    }();
    return parser.lexer = lexer, Parser.prototype = parser, parser.Parser = Parser, 
    new Parser();
}();

"undefined" != typeof require && "undefined" != typeof exports && (exports.parser = parser, 
exports.Parser = parser.Parser, exports.parse = function() {
    return parser.parse.apply(parser, arguments);
}, exports.main = function(args) {
    args[1] || (console.log("Usage: " + args[0] + " FILE"), process.exit(1));
    var source = require("fs").readFileSync(require("path").normalize(args[1]), "utf8");
    return exports.parser.parse(source);
}, "undefined" != typeof module && require.main === module && exports.main(process.argv.slice(1)));
/**
 * jison doesn't have a good exception, so we make one.
 * This is brittle as it depends on jison internals
 */
function ParseError(message, hash) {
  _.extend(this, hash);

  this.name = 'ParseError';
  this.message = (message || '');
}
ParseError.prototype = new Error();
Diagram.ParseError = ParseError;

Diagram.parse = function(input) {
  // TODO jison v0.4.17 changed their API slightly, so parser is no longer defined:

  // Create the object to track state and deal with errors
  parser.yy = new Diagram();
  parser.yy.parseError = function(message, hash) {
    throw new ParseError(message, hash);
  };

  // Parse
  var diagram = parser.parse(input);

  // Then clean up the parseError key that a user won't care about
  delete diagram.parseError;
  return diagram;
};


/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
/*global Diagram, _ */

// Following the CSS convention
// Margin is the gap outside the box
// Padding is the gap inside the box
// Each object has x/y/width/height properties
// The x/y should be top left corner
// width/height is with both margin and padding

// TODO
// Image width is wrong, when there is a note in the right hand col
// Title box could look better
// Note box could look better

var DIAGRAM_MARGIN = 10;

var ACTOR_MARGIN   = 10; // Margin around a actor
var ACTOR_PADDING  = 10; // Padding inside a actor

var SIGNAL_MARGIN  = 5; // Margin around a signal
var SIGNAL_PADDING = 5; // Padding inside a signal

var NOTE_MARGIN   = 10; // Margin around a note
var NOTE_PADDING  = 5; // Padding inside a note
var NOTE_OVERLAP  = 15; // Overlap when using a "note over A,B"

var TITLE_MARGIN   = 0;
var TITLE_PADDING  = 5;

var SELF_SIGNAL_WIDTH = 20; // How far out a self signal goes

var EXECUTION_WIDTH = 10;
var OVERLAPPING_EXECUTION_OFFSET = EXECUTION_WIDTH * 0.5;

var PLACEMENT = Diagram.PLACEMENT;
var LINETYPE  = Diagram.LINETYPE;
var ARROWTYPE = Diagram.ARROWTYPE;
var LEFTARROWTYPE = Diagram.LEFTARROWTYPE;

var ALIGN_LEFT   = 0;
var ALIGN_CENTER = 1;

function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function() {
  return 'AssertException: ' + this.message;
};

function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}

if (!String.prototype.trim) {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

Diagram.themes = {};
function registerTheme(name, theme) {
  Diagram.themes[name] = theme;
}

/******************
 * Drawing-related extra diagram methods.
 ******************/

// These functions return the x-offset from the lifeline centre given the current Execution nesting-level.
function executionMarginLeft(level) {
  if (level < 0) {
    return 0;
  }
  return -EXECUTION_WIDTH * 0.5 + level * OVERLAPPING_EXECUTION_OFFSET;
}

function executionMarginRight(level) {
  if (level < 0) {
    return 0;
  }
  return EXECUTION_WIDTH * 0.5 + level * OVERLAPPING_EXECUTION_OFFSET;
}

/******************
 * Drawing extras
 ******************/

function getCenterX(box) {
  return box.x + box.width / 2;
}

function getCenterY(box) {
  return box.y + box.height / 2;
}

/******************
 * SVG Path extras
 ******************/

function clamp(x, min, max) {
  if (x < min) {
    return min;
  }
  if (x > max) {
    return max;
  }
  return x;
}

function wobble(x1, y1, x2, y2) {
  assert(_.every([x1,x2,y1,y2], _.isFinite), 'x1,x2,y1,y2 must be numeric');

  // Wobble no more than 1/25 of the line length
  var factor = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) / 25;

  // Distance along line where the control points are
  // Clamp between 20% and 80% so any arrow heads aren't angled too much
  var r1 = clamp(Math.random(), 0.2, 0.8);
  var r2 = clamp(Math.random(), 0.2, 0.8);

  var xfactor = Math.random() > 0.5 ? factor : -factor;
  var yfactor = Math.random() > 0.5 ? factor : -factor;

  var p1 = {
    x: (x2 - x1) * r1 + x1 + xfactor,
    y: (y2 - y1) * r1 + y1 + yfactor
  };

  var p2 = {
    x: (x2 - x1) * r2 + x1 - xfactor,
    y: (y2 - y1) * r2 + y1 - yfactor
  };

  return 'C' + p1.x.toFixed(1) + ',' + p1.y.toFixed(1) + // start control point
         ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1) + // end control point
         ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);      // end point
}

/**
 * Draws a wobbly (hand drawn) rect
 */
function handRect(x, y, w, h) {
  assert(_.every([x, y, w, h], _.isFinite), 'x, y, w, h must be numeric');
  return 'M' + x + ',' + y +
   wobble(x, y, x + w, y) +
   wobble(x + w, y, x + w, y + h) +
   wobble(x + w, y + h, x, y + h) +
   wobble(x, y + h, x, y);
}

/**
 * Draws a wobbly (hand drawn) line
 */
function handLine(x1, y1, x2, y2) {
  assert(_.every([x1,x2,y1,y2], _.isFinite), 'x1,x2,y1,y2 must be numeric');
  return 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + wobble(x1, y1, x2, y2);
}

/******************
 * BaseTheme
 ******************/

var BaseTheme = function(diagram, options) {
  this.init(diagram, options);
};

_.extend(BaseTheme.prototype, {

  // Init called while creating the Theme
  init: function(diagram, options) {
    this.diagram = diagram;

    this.actorsHeight_  = 0;
    this.signalsHeight_ = 0;
    this.title_ = undefined; // hack - This should be somewhere better
  },

  setupPaper: function(container) {},

  draw: function(container) {
    this.setupPaper(container);

    this.layout();

    var titleHeight = this.title_ ? this.title_.height : 0;
    var y = DIAGRAM_MARGIN + titleHeight;

    this.drawTitle();
    this.drawActors(y);
    this.drawExecutions(y + this.actorsHeight_);
    this.drawSignals(y + this.actorsHeight_);
  },

  layout: function() {
    // Local copies
    var diagram = this.diagram;
    var font    = this.font_;
    var actors  = diagram.actors;
    var signals = diagram.signals;

    diagram.width  = 0; // min width
    diagram.height = 0; // min height

    // Setup some layout stuff
    if (diagram.title) {
      var title = this.title_ = {};
      title.message = diagram.title.message;
      title.lineno = diagram.title.lineno;
      var bb = this.textBBox(title.message, font);
      title.textBB = bb;

      title.width  = bb.width  + (TITLE_PADDING + TITLE_MARGIN) * 2;
      title.height = bb.height + (TITLE_PADDING + TITLE_MARGIN) * 2;
      title.x = DIAGRAM_MARGIN;
      title.y = DIAGRAM_MARGIN;

      diagram.width  += title.width;
      diagram.height += title.height;
    }

    _.each(actors, _.bind(function(a) {
      var bb = this.textBBox(a.name, font);
      a.textBB = bb;

      a.x = 0; a.y = 0;
      a.width  = bb.width  + (ACTOR_PADDING + ACTOR_MARGIN) * 2;
      a.height = bb.height + (ACTOR_PADDING + ACTOR_MARGIN) * 2;

      a.distances = [];
      a.paddingRight = 0;
      if (a.maxExecutionsLevel >= 0) {
        a.padding_right = (EXECUTION_WIDTH / 2.0) +
          (a.maxExecutionsLevel *
           OVERLAPPING_EXECUTION_OFFSET);
      }
      this.actorsHeight_ = Math.max(a.height, this.actorsHeight_);
    }, this));

    function actorEnsureDistance(a, b, d) {
      assert(a < b, 'a must be less than or equal to b');

      if (a < 0) {
        // Ensure b has left margin
        b = actors[b];
        b.x = Math.max(d - b.width / 2, b.x);
      } else if (b >= actors.length) {
        // Ensure a has right margin
        a = actors[a];
        a.paddingRight = Math.max(d, a.paddingRight);
      } else {
        a = actors[a];
        a.distances[b] = Math.max(d, a.distances[b] ? a.distances[b] : 0);
      }
    }

    _.each(signals, _.bind(function(s) {
      // Indexes of the left and right actors involved
      var a;
      var b;

      var bb = this.textBBox(s.message, font);

      s.textBB = bb;
      s.width   = bb.width;
      s.height  = bb.height;

      var extraWidth = 0;

      if (s.type == 'Signal') {

        s.width  += (SIGNAL_MARGIN + SIGNAL_PADDING) * 2;
        s.height += (SIGNAL_MARGIN + SIGNAL_PADDING) * 2;

        if (s.isSelf()) {
          // TODO Self signals need a min height
          a = s.actorA.index;
          b = a + 1;
          s.width += SELF_SIGNAL_WIDTH;
        } else {
          a = Math.min(s.actorA.index, s.actorB.index);
          b = Math.max(s.actorA.index, s.actorB.index);
        }

      } else if (s.type == 'Note') {
        s.width  += (NOTE_MARGIN + NOTE_PADDING) * 2;
        s.height += (NOTE_MARGIN + NOTE_PADDING) * 2;

        // HACK lets include the actor's padding
        extraWidth = 2 * ACTOR_MARGIN;

        if (s.placement == PLACEMENT.LEFTOF) {
          b = s.actor.index;
          a = b - 1;
        } else if (s.placement == PLACEMENT.RIGHTOF) {
          a = s.actor.index;
          b = a + 1;
        } else if (s.placement == PLACEMENT.OVER && s.hasManyActors()) {
          // Over multiple actors
          a = Math.min(s.actor[0].index, s.actor[1].index);
          b = Math.max(s.actor[0].index, s.actor[1].index);

          // We don't need our padding, and we want to overlap
          extraWidth = -(NOTE_PADDING * 2 + NOTE_OVERLAP * 2);

        } else if (s.placement == PLACEMENT.OVER) {
          // Over single actor
          a = s.actor.index;
          actorEnsureDistance(a - 1, a, s.width / 2);
          actorEnsureDistance(a, a + 1, s.width / 2);
          this.signalsHeight_ += s.height;

          return; // Bail out early
        }
      } else if (s.type == 'Actor') {
        s.width  = bb.width  + (ACTOR_PADDING + ACTOR_MARGIN) * 2;
        s.height = bb.height + (ACTOR_PADDING + ACTOR_MARGIN) * 2;
        a = s.index;
        b = a + 1;
      } else {
        throw new Error('Unhandled signal type:' + s.type);
      }

      actorEnsureDistance(a, b, s.width + extraWidth);
      this.signalsHeight_ += s.height;
    }, this));

    // Re-jig the positions
    var actorsX = 0;
    _.each(actors, function(a) {
      a.x = Math.max(actorsX, a.x);

      // TODO This only works if we loop in sequence, 0, 1, 2, etc
      _.each(a.distances, function(distance, b) {
        // lodash (and possibly others) do not like sparse arrays
        // so sometimes they return undefined
        if (typeof distance == 'undefined') {
          return;
        }

        b = actors[b];
        distance = Math.max(distance, a.width / 2, b.width / 2);
        b.x = Math.max(b.x, a.x + a.width / 2 + distance - b.width / 2);
      });

      actorsX = a.x + a.width + a.paddingRight;
    });

    diagram.width = Math.max(actorsX, diagram.width);

    // TODO Refactor a little
    diagram.width  += 2 * DIAGRAM_MARGIN;
    diagram.height += 2 * DIAGRAM_MARGIN + 2 * this.actorsHeight_ + this.signalsHeight_;

    return this;
  },

  // TODO Instead of one textBBox function, create a function for each element type, e.g
  //      layout_title, layout_actor, etc that returns it's bounding box
  textBBox: function(text, font) {},

  drawTitle: function() {
    var title = this.title_;
    if (title) {
      this.drawTextBox(title, title.message, TITLE_MARGIN, TITLE_PADDING, this.font_, ALIGN_LEFT);
    }
  },

  drawActors: function(offsetY) {
    var y = offsetY;
    _.each(this.diagram.actors, _.bind(function(a) {
      var startY = y;
      var endY = y;
      if (a.start > 0) {
        for (var i = 0, n = a.start; i < n; i++) {
          startY += this.diagram.signals[i].height - 0;
        }
        startY += this.actorsHeight_;
      }

      // Top box
      this.drawActor(a, startY, this.actorsHeight_);

      // Bottom box
      if (a.end == 0) {
        this.drawActor(a, endY + this.actorsHeight_ + this.signalsHeight_, this.actorsHeight_);
        endY += this.signalsHeight_;
      } else {
        for (i = 0, n = a.end; i < n; i++) {
          endY += this.diagram.signals[i].height - 0;
        }
        endY -= (SIGNAL_MARGIN + SIGNAL_PADDING) * 2;
        a.y = endY + this.actorsHeight_ + ACTOR_MARGIN;
      }

      // Veritical line
      var aX = getCenterX(a);
      this.drawLine(
       aX, startY + this.actorsHeight_ - ACTOR_MARGIN,
       aX, endY + this.actorsHeight_ + ACTOR_MARGIN);
    }, this));
  },

  drawActor: function(actor, offsetY, height) {
    actor.y      = offsetY;
    actor.height = height;
    this.drawTextBox(actor, actor.name, ACTOR_MARGIN, ACTOR_PADDING, this.font_, ALIGN_CENTER);
  },

  drawExecutions : function (offsetY) {
    var y = offsetY;

    // Calculate the y-positions of each signal before we attempt to draw the executions.
    _.each(this.diagram.signals, _.bind(function(s) {
      if (s.type == "Signal") {
        if (s.isSelf()) {
          s.startY = y + SIGNAL_MARGIN;
          s.endY = s.startY + s.height - SIGNAL_MARGIN;
        } else {
          s.startY = s.endY = y + s.height - SIGNAL_MARGIN - SIGNAL_PADDING;
        }
      }

      y += s.height;
    }, this));

    _.each(this.diagram.actors, _.bind(function(a) {
      this.drawActorsExecutions(a);
    }, this));
  },

  drawActorsExecutions : function (actor) {
    _.each(actor.executions, _.bind(function (e) {
      var aX = getCenterX(actor);
      aX += e.level * OVERLAPPING_EXECUTION_OFFSET;
      var x = aX - EXECUTION_WIDTH / 2.0;
      var y;
      var w = EXECUTION_WIDTH;
      var h;
      if (e.startSignal === e.endSignal) {
        y = e.startSignal.startY;
        h = e.endSignal ? e.endSignal.endY - y : (actor.y - y);
      } else {
        y = e.startSignal.endY;
        h = e.endSignal ? e.endSignal.startY - y : (actor.y - y);
      }

      // Draw actual execution.
      var rect = this.drawRect(x, y, w, h);
      rect.attr(EXECUTION_RECT);
    }, this));
  },

  drawSignals: function(offsetY) {
    var y = offsetY;
    _.each(this.diagram.signals, _.bind(function(s) {
      // TODO Add debug mode, that draws padding/margin box
      if (s.type == 'Signal') {
        if (s.isSelf()) {
          this.drawSelfSignal(s, y);
        } else {
          this.drawSignal(s, y);
        }

      } else if (s.type == 'Note') {
        this.drawNote(s, y);
      }

      y += s.height;
    }, this));
  },

  drawSelfSignal: function(signal, offsetY) {
      assert(signal.isSelf(), 'signal must be a self signal');

      var textBB = signal.textBB;
      var aX = getCenterX(signal.actorA);
      aX += executionMarginRight(signal.maxExecutionLevel());

      var x = aX + SELF_SIGNAL_WIDTH + SIGNAL_PADDING;
      var y = offsetY + SIGNAL_PADDING + signal.height / 2 + textBB.y;

      this.drawText(x, y, signal.message, this.font_, ALIGN_LEFT);

      var x1 = getCenterX(signal.actorA) + executionMarginRight(signal.startLevel);
      var x2 = getCenterX(signal.actorA) + executionMarginRight(signal.endLevel);
      var y1 = offsetY + SIGNAL_MARGIN + SIGNAL_PADDING;
      var y2 = y1 + signal.height - 2 * SIGNAL_MARGIN - SIGNAL_PADDING;

      // Draw three lines, the last one with a arrow
      this.drawLine(x1, y1, aX + SELF_SIGNAL_WIDTH, y1, signal.linetype);
      this.drawLine(aX + SELF_SIGNAL_WIDTH, y1, aX + SELF_SIGNAL_WIDTH, y2, signal.linetype);
      this.drawLine(aX + SELF_SIGNAL_WIDTH, y2, x2, y2, signal.linetype, signal.arrowtype);
    },

  drawSignal: function(signal, offsetY) {
    var aX = getCenterX(signal.actorA);
    var bX = getCenterX(signal.actorB);

    if (bX > aX) {
      aX += executionMarginRight(signal.startLevel);
      bX += executionMarginLeft(signal.endLevel);
    } else {
      aX += executionMarginLeft(signal.startLevel);
      bX += executionMarginRight(signal.endLevel);
    }

    // Mid point between actors
    var x = (bX - aX) / 2 + aX;
    var y = offsetY + SIGNAL_MARGIN + 2 * SIGNAL_PADDING;

    // Draw the text in the middle of the signal
    this.drawText(x, y, signal.message, this.font_, ALIGN_CENTER);

    // Draw the line along the bottom of the signal
    y = offsetY + signal.height - SIGNAL_MARGIN - SIGNAL_PADDING;
    this.drawLine(aX, y, bX, y, signal.linetype, signal.arrowtype, signal.leftarrowtype);
  },

  drawNote: function(note, offsetY) {
    note.y = offsetY;
    var actorA = note.hasManyActors() ? note.actor[0] : note.actor;
    var aX = getCenterX(actorA);
    switch (note.placement) {
    case PLACEMENT.RIGHTOF:
      note.x = aX + ACTOR_MARGIN;
    break;
    case PLACEMENT.LEFTOF:
      note.x = aX - ACTOR_MARGIN - note.width;
    break;
    case PLACEMENT.OVER:
      if (note.hasManyActors()) {
        var bX = getCenterX(note.actor[1]);
        var overlap = NOTE_OVERLAP + NOTE_PADDING;
        note.x = Math.min(aX, bX) - overlap;
        note.width = (Math.max(aX, bX) + overlap) - note.x;
      } else {
        note.x = aX - note.width / 2;
      }
    break;
    default:
      throw new Error('Unhandled note placement: ' + note.placement);
  }
    return this.drawTextBox(note, note.message, NOTE_MARGIN, NOTE_PADDING, this.font_, ALIGN_LEFT);
  },

  /**
   * Draw text surrounded by a box
   */
  drawTextBox: function(box, text, margin, padding, font, align) {
    var x = box.x + margin;
    var y = box.y + margin;
    var w = box.width  - 2 * margin;
    var h = box.height - 2 * margin;

    // Draw inner box
    this.drawRect(x, y, w, h);

    // Draw text (in the center)
    if (align == ALIGN_CENTER) {
      x = getCenterX(box);
      y = getCenterY(box);
    } else {
      x += padding;
      y += padding;
    }

    return this.drawText(x, y, text, font, align);
  }
});

/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
/*global Diagram, Snap, WebFont _ */
// TODO Move defintion of font onto the <svg>, so it can easily be override at each level
if (typeof Snap != 'undefined') {

  var xmlns = 'http://www.w3.org/2000/svg';

  var LINE = {
    'stroke': '#000000',
    'stroke-width': 2, // BUG TODO This gets set as a style, not as a attribute. Look at  eve.on("snap.util.attr"...
    'fill': 'none'
  };

  var RECT = {
    'stroke': '#000000',
    'stroke-width': 2,
    'fill': '#fff'
  };

  var EXECUTION_RECT = {
    'stroke': '#000000',
    'stroke-width': 2,
    'fill': '#e6e6e6' // Color taken from the UML examples
  };

  var LOADED_FONTS = {};

  /******************
   * SnapTheme
   ******************/

  var SnapTheme = function(diagram, options, resume) {
        _.defaults(options, {
            'css-class': 'simple',
            'font-size': 16,
            'font-family': 'Andale Mono, monospace'
          });

        this.init(diagram, options, resume);
      };

  _.extend(SnapTheme.prototype, BaseTheme.prototype, {

    init: function(diagram, options, resume) {
            BaseTheme.prototype.init.call(this, diagram);

            this.paper_  = undefined;
            this.cssClass_ = options['css-class'] || undefined;
            this.font_ = {
                'font-size': options['font-size'],
                'font-family': options['font-family']
              };

            var a = this.arrowTypes_ = {};
            a[ARROWTYPE.FILLED] = 'Block';
            a[ARROWTYPE.OPEN]   = 'Open';

            var l = this.lineTypes_ = {};
            l[LINETYPE.SOLID]  = '';
            l[LINETYPE.DOTTED] = '6,2';

            var that = this;
            this.waitForFont(function() {
              resume(that);
            });
          },

    // Wait for loading of the font
    waitForFont: function(callback) {
      var fontFamily = this.font_['font-family'];

      if (typeof WebFont == 'undefined') {
        throw new Error('WebFont is required (https://github.com/typekit/webfontloader).');
      }

      if (LOADED_FONTS[fontFamily]) {
        // If already loaded, just return instantly.
        callback();
        return;
      }

      WebFont.load({
          custom: {
              families: [fontFamily] // TODO replace this with something that reads the css
            },
          classes: false, // No need to place classes on the DOM, just use JS Events
          active: function() {
              LOADED_FONTS[fontFamily] = true;
              callback();
            },
          inactive: function() {
              // If we fail to fetch the font, still continue.
              LOADED_FONTS[fontFamily] = true;
              callback();
            }
        });
    },

    addDescription: function(svg, description) {
          var desc = document.createElementNS(xmlns, 'desc');
          desc.appendChild(document.createTextNode(description));
          svg.appendChild(desc);
        },

    setupPaper: function(container) {
      // Container must be a SVG element. We assume it's a div, so lets create a SVG and insert
      var svg = document.createElementNS(xmlns, 'svg');
      container.appendChild(svg);

      this.addDescription(svg, this.diagram.title || '');

      this.paper_ = Snap(svg);
      this.paper_.addClass('sequence');

      if (this.cssClass_) {
        this.paper_.addClass(this.cssClass_);
      }

      this.beginGroup();

      // TODO Perhaps only include the markers if we actually use them.
      var a = this.arrowMarkers_ = {};
      var arrow = this.paper_.path('M 0 0 L 5 2.5 L 0 5 z');
      a[ARROWTYPE.FILLED] = arrow.marker(0, 0, 5, 5, 5, 2.5)
       .attr({id: 'markerArrowBlock'});

      arrow = this.paper_.path('M 9.6,8 1.92,16 0,13.7 5.76,8 0,2.286 1.92,0 9.6,8 z');
      a[ARROWTYPE.OPEN] = arrow.marker(0, 0, 9.6, 16, 9.6, 8)
       .attr({markerWidth: '4', id: 'markerArrowOpen'});

      var b = this.leftArrowMarkers_ = {};
      arrow = this.paper_.path('M 0 2.5 L 5 5 L 5 0 z');
      b[Diagram.LEFTARROWTYPE.FILLED] = arrow.marker(0, 0, 5, 5, 0, 2.5)
       .attr({id: 'markerLeftArrowBlock'});

      arrow = this.paper_.path('M 0,8 7.68,16 9.6,13.7 3.84,8 9.6,2.286 7.68,0 0,8 z');
      b[Diagram.LEFTARROWTYPE.OPEN] = arrow.marker(0, 0, 9.6, 16, 0, 8)
       .attr({markerWidth: '4', id: 'markerLeftArrowOpen'});
    },

    layout: function() {
      BaseTheme.prototype.layout.call(this);
      this.paper_.attr({
        width:  this.diagram.width + 'px',
        height: this.diagram.height + 'px'
      });
    },

    textBBox: function(text, font) {
      // TODO getBBox will return the bounds with any whitespace/kerning. This makes some of our aligments screwed up
      var t = this.createText(text, font);
      var bb = t.getBBox();
      t.remove();
      return bb;
    },

    // For each drawn element, push onto the stack, so it can be wrapped in a single outer element
    pushToStack: function(element) {
      this._stack.push(element);
      return element;
    },

    // Begin a group of elements
    beginGroup: function() {
      this._stack = [];
    },

    // Finishes the group, and returns the <group> element
    finishGroup: function(groupName, lineno) {
      var g = this.paper_.group.apply(this.paper_, this._stack);
      this.beginGroup(); // Reset the group
      if (groupName) {
        g.addClass(groupName);
      }
      if (lineno !== void 0) {
        g.attr({'data-lineno': lineno + 1});
      }
      return g;
    },

    createText: function(text, font) {
      text = text.split('\n').map(function(x) {
          return x.trim();
      });
      var t = this.paper_.text(0, 0, text);
      t.attr(font || {});
      if (text.length > 1) {
        // Every row after the first, set tspan to be 1.2em below the previous line
        t.selectAll('tspan:nth-child(n+2)').attr({
          dy: '1.2em',
          x: 0
        });
      }

      return t;
    },

    drawLine: function(x1, y1, x2, y2, linetype, arrowhead, leftarrowhead) {
      var line = this.paper_.line(x1, y1, x2, y2).attr(LINE);
      if (linetype !== undefined) {
        line.attr('strokeDasharray', this.lineTypes_[linetype]);
      }
      if (arrowhead !== undefined) {
        line.attr('markerEnd', this.arrowMarkers_[arrowhead]);
      }
      if (leftarrowhead !== undefined && leftarrowhead != Diagram.LEFTARROWTYPE.NONE) {
        line.attr('markerStart', this.leftArrowMarkers_[leftarrowhead]);
      }
      return this.pushToStack(line);
    },

    drawRect: function(x, y, w, h) {
      var rect = this.paper_.rect(x, y, w, h).attr(RECT);
      return this.pushToStack(rect);
    },

    /**
     * Draws text with a optional white background
     * x,y (int) x,y top left point of the text, or the center of the text (depending on align param)
     * text (string) text to print
     * font (Object)
     * align (string) ALIGN_LEFT or ALIGN_CENTER
     */
    drawText: function(x, y, text, font, align) {
      var t = this.createText(text, font);
      var bb = t.getBBox();

      if (align == ALIGN_CENTER) {
        x = x - bb.width / 2;
        y = y - bb.height / 2;
      }

      // Now move the text into place
      // `y - bb.y` because text(..) is positioned from the baseline, so this moves it down.
      t.attr({x: x - bb.x, y: y - bb.y});
      t.selectAll('tspan').attr({x: x});

      this.pushToStack(t);
      return t;
    },

    drawTitle: function() {
      this.beginGroup();
      BaseTheme.prototype.drawTitle.call(this);
      return this.finishGroup('title', this.title_ ? this.title_.lineno : undefined);
    },

    drawActor: function(actor, offsetY, height) {
      this.beginGroup();
      BaseTheme.prototype.drawActor.call(this, actor, offsetY, height);
      return this.finishGroup('actor', actor.lineno);
    },

    drawSignal: function(signal, offsetY) {
      this.beginGroup();
      BaseTheme.prototype.drawSignal.call(this, signal, offsetY);
      return this.finishGroup('signal', signal.lineno);
    },

    drawSelfSignal: function(signal, offsetY) {
      this.beginGroup();
      BaseTheme.prototype.drawSelfSignal.call(this, signal, offsetY);
      return this.finishGroup('signal', signal.lineno);
    },

    drawNote: function(note, offsetY) {
      this.beginGroup();
      BaseTheme.prototype.drawNote.call(this, note, offsetY);
      return this.finishGroup('note', note.lineno);
    },
  });

  /******************
   * SnapHandTheme
   ******************/

  var SnapHandTheme = function(diagram, options, resume) {
        _.defaults(options, {
            'css-class': 'hand',
            'font-size': 16,
            'font-family': 'danielbd'
          });

        this.init(diagram, options, resume);
      };

  // Take the standard SnapTheme and make all the lines wobbly
  _.extend(SnapHandTheme.prototype, SnapTheme.prototype, {
    drawLine: function(x1, y1, x2, y2, linetype, arrowhead, leftarrowhead) {
      var line = this.paper_.path(handLine(x1, y1, x2, y2)).attr(LINE);
      if (linetype !== undefined) {
        line.attr('strokeDasharray', this.lineTypes_[linetype]);
      }
      if (arrowhead !== undefined) {
        line.attr('markerEnd', this.arrowMarkers_[arrowhead]);
      }
      if (leftarrowhead !== undefined && leftarrowhead != Diagram.LEFTARROWTYPE.NONE) {
        line.attr('markerStart', this.leftArrowMarkers_[leftarrowhead]);
      }
      return this.pushToStack(line);
    },

    drawRect: function(x, y, w, h) {
      var rect = this.paper_.path(handRect(x, y, w, h)).attr(RECT);
      return this.pushToStack(rect);
    }
  });

  registerTheme('snapSimple', SnapTheme);
  registerTheme('snapHand',   SnapHandTheme);
}


/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
/*global Diagram, _ */

if (typeof Raphael == 'undefined' && typeof Snap == 'undefined') {
  throw new Error('Raphael or Snap.svg is required to be included.');
}

if (_.isEmpty(Diagram.themes)) {
  // If you are using stock js-sequence-diagrams you should never see this. This only
  // happens if you have removed the built in themes.
  throw new Error('No themes were registered. Please call registerTheme(...).');
}

// Set the default hand/simple based on which theme is available.
Diagram.themes.hand = Diagram.themes.snapHand || Diagram.themes.raphaelHand;
Diagram.themes.simple = Diagram.themes.snapSimple || Diagram.themes.raphaelSimple;

/* Draws the diagram. Creates a SVG inside the container
* container (HTMLElement|string) DOM element or its ID to draw on
* options (Object)
*/
Diagram.prototype.drawSVG = function(container, options) {
  var defaultOptions = {
    theme: 'hand'
  };

  options = _.defaults(options || {}, defaultOptions);

  if (!(options.theme in Diagram.themes)) {
    throw new Error('Unsupported theme: ' + options.theme);
  }

  // TODO Write tests for this check
  var div = _.isString(container) ? document.getElementById(container) : container;
  if (div === null || !div.tagName) {
    throw new Error('Invalid container: ' + container);
  }

  var Theme = Diagram.themes[options.theme];
  new Theme(this, options, function(drawing) {
      drawing.draw(div);
    });
}; // end of drawSVG
/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
/*global jQuery */
if (typeof jQuery != 'undefined') {
  (function($) {
    $.fn.sequenceDiagram = function(options) {
      return this.each(function() {
        var $this = $(this);
        var diagram = Diagram.parse($this.text());
        $this.html('');
        diagram.drawSVG(this, options);
      });
    };
  })(jQuery);
}

// Taken from underscore.js:
// Establish the root object, `window` (`self`) in the browser, or `global` on the server.
// We use `self` instead of `window` for `WebWorker` support.
var root = (typeof self == 'object' && self.self == self && self) ||
 (typeof global == 'object' && global.global == global && global);

// Export the Diagram object for **Node.js**, with
// backwards-compatibility for their old module API. If we're in
// the browser, add `Diagram` as a global object.
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = Diagram;
  }
  exports.Diagram = Diagram;
} else {
  root.Diagram = Diagram;
}
}());

