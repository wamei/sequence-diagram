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
// #include "build/grammar.js"

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

