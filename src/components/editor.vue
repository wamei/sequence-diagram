<template>
  <div id="editor"></div>
</template>

<style>
  div#editor {
      font-size: 8pt;
      position: relative;
      width: 100%;
      height: 100%;
  }
</style>

<script>
  import 'ace-min-noconflict';
  import 'ace-min-noconflict/mode-text.js';
  import 'ace-min-noconflict/theme-monokai.js';
  import Event from '../event.js';

  export default {
      props: [
          'value'
      ],
      data: function() {
          return {
              editor: null,
              isInternalChange: false,
              isInternalCursorChange: false,
          }
      },
      watch: {
          'value': function(val) {
              if (this.isInternalChange) {
                  return;
              }
              this.editor.getSession().setValue(val);
          }
      },
      created: function() {
          Event.$on('input_error', function(error) {
              if (!this.editor) {
                  setTimeout(function () {
                      Event.$emit('input_error', error);
                  }, 500);
                  return;
              }
              let annotations = [];
              if (error && error.line != void 0) {
                  annotations.push({
                      row: error.line,
                      type: "error",
                      text: error.message
                  });
              }
              this.editor.getSession().setAnnotations(annotations);
          }.bind(this));
      },
      mounted: function() {
          this.$nextTick(function() {
              this.editor = ace.edit("editor");
              this.editor.setTheme("ace/theme/monokai");
              this.editor.getSession().setMode('ace/mode/text');
              this.editor.commands.bindKey("Ctrl-P", "golineup");

              this.editor.getSession().setValue(this.value);

              this.editor.getSession().on('change', function() {
                  let val = this.editor.getSession().getValue();
                  this.isInternalChange = true;
                  this.$emit('input', val);
                  this.$nextTick(function() {
                      this.isInternalChange = false;
                  });
              }.bind(this));

              this.editor.getSession().getSelection().on('changeCursor', function() {
                  let range = this.editor.getSession().getSelection().getRange();
                  this.isInternalCursorChange = true;
                  Event.$emit('select_line', range.end.row + 1);
                  this.$nextTick(function() {
                      this.isInternalCursorChange = false;
                  });
              }.bind(this));

              Event.$on('select_line', function(lineno) {
                  if (this.isInternalCursorChange) {
                      return;
                  }
                  lineno--;
                  let selection = this.editor.getSession().getSelection();
                  let range = selection.getRange();
                  range.setStart(lineno, 0);
                  range.setEnd(lineno, 0);
                  selection.setSelectionRange(range);
              }.bind(this));

              this.editor.focus();
          });
      }
  }
</script>
