/** js sequence diagrams
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2017 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
%lex

%options case-insensitive

%{
	// Pre-lexer code can go here
%}

%%

[\r\n]+           return 'NL';
\s+               /* skip whitespace */
\#[^\r\n]*        /* skip comments */
"participant"     return 'participant';
"left of"         return 'left_of';
"right of"        return 'right_of';
"over"            return 'over';
"note"            return 'note';
"title"           return 'title';
"destroy"         return 'destroy';
","               return ',';
[^\-<>:,\r\n"+]+   return 'ACTOR';
\"[^"]+\"         return 'ACTOR';
"--"              return 'DOTLINE';
"-"               return 'LINE';
"+"               return 'PLUS';
">>"              return 'OPENARROW';
">"               return 'ARROW';
"<<"              return 'LOPENARROW';
"<"               return 'LARROW';
:[^\r\n]+         return 'MESSAGE';
<<EOF>>           return 'EOF';
.                 return 'INVALID';

/lex

%start start

%% /* language grammar */

start
	: document 'EOF' { return yy.parser.yy; } /* returning parser.yy is a quirk of jison >0.4.10 */
	;

document
	: /* empty */
	| document line
	;

line
	: statement { }
	| 'NL'
	;

statement
	: 'participant' actor_alias { $2; }
	| signal               { yy.parser.yy.addSignal($1); }
	| note_statement       { yy.parser.yy.addSignal($1); }
	| 'title' message      { yy.parser.yy.setTitle($2, yylineno);  }
	| 'destroy' actor      { yy.parser.yy.destoryActor($2, yylineno);  }
	;

note_statement
	: 'note' placement actor message   { $$ = new Diagram.Note($3, $2, $4, yylineno); }
	| 'note' 'over' actor_pair message { $$ = new Diagram.Note($3, Diagram.PLACEMENT.OVER, $4, yylineno); }
	;

actor_pair
	: actor             { $$ = $1; }
	| actor ',' actor   { $$ = [$1, $3]; }
	;

placement
	: 'left_of'   { $$ = Diagram.PLACEMENT.LEFTOF; }
	| 'right_of'  { $$ = Diagram.PLACEMENT.RIGHTOF; }
	;

signal
	: execution_modifier actor signaltype execution_modifier actor message
		{ $$ = new Diagram.Signal($2, $3, $5, $6, $1, $4, yylineno); }
	;

execution_modifier
	: /* empty */ { $$ = Diagram.EXECUTION_CHANGE.NONE }
	| LINE { $$ = Diagram.EXECUTION_CHANGE.DECREASE }
	| PLUS { $$ = Diagram.EXECUTION_CHANGE.INCREASE }
	;

actor
	: ACTOR { $$ = yy.parser.yy.getActor(Diagram.unescape($1)); }
	;

actor_alias
	: ACTOR { $$ = yy.parser.yy.getActorWithAlias(Diagram.unescape($1), yylineno); }
	;

signaltype
	: leftarrowtype linetype arrowtype { $$ = $2 | ($3 << 2) | ($1 << 4); }
	| linetype arrowtype               { $$ = $1 | ($2 << 2); }
	| linetype                         { $$ = $1; }
	;

leftarrowtype
	: LARROW     { $$ = Diagram.LEFTARROWTYPE.FILLED; }
	| LOPENARROW { $$ = Diagram.LEFTARROWTYPE.OPEN; }
	;

linetype
	: LINE      { $$ = Diagram.LINETYPE.SOLID; }
	| DOTLINE   { $$ = Diagram.LINETYPE.DOTTED; }
	;

arrowtype
	: ARROW     { $$ = Diagram.ARROWTYPE.FILLED; }
	| OPENARROW { $$ = Diagram.ARROWTYPE.OPEN; }
	;

message
	: MESSAGE { $$ = Diagram.unescape($1.substring(1)); }
	;


%%
